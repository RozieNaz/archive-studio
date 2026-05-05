import csv
import json
import re
from collections import Counter
from pathlib import Path


SOURCE_DIR = Path(r"C:\Users\gakay\Downloads\Academic Title Lists\Distribution Safe CSV")
PROJECT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_DIR / "src" / "data"
INDEX_PATH = OUTPUT_DIR / "metadata-index.json"
REPORT_PATH = OUTPUT_DIR / "metadata-index-report.json"

TOPIC_PATTERN = re.compile(
    r"\b("
    r"islam|islamic|muslim|qur'?an|quranic|muhammad|prophet|hadith|sharia|"
    r"arab|arabic|arabia|middle east|mena|orientalis[mt]|colonial|colonialism|"
    r"empire|ottoman|mughal|palestine|israel|zion|jewish|judaism|talmud|"
    r"christian|christianity|bible|biblical|jesus|religion|religious|theology|"
    r"secular|liberal|politic|philosophy|race|racial|ethnic|gender|women|"
    r"medieval|ancient|late antique|islamophobia|radicali[sz]ation|nationalism"
    r")\b",
    re.IGNORECASE,
)


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalise(value):
    return re.sub(r"[^a-z0-9]+", " ", clean(value).lower()).strip()


def year_from(value):
    match = re.search(r"\b(15|16|17|18|19|20)\d{2}\b", str(value or ""))
    return match.group(0) if match else ""


def is_topic_match(*values):
    return bool(TOPIC_PATTERN.search(" ".join(clean(value) for value in values)))


def read_csv(name):
    path = SOURCE_DIR / name
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        yield from csv.DictReader(handle)


def compact_record(**values):
    return {key: clean(value) for key, value in values.items() if clean(value)}


def build_index():
    records = []
    report = []
    seen = set()

    def add(record):
        record = compact_record(**record)
        title = record.get("title", "")
        if not title:
            return False
        key = record.get("doi") or record.get("isbn") or "|".join(
            [normalise(title), normalise(record.get("author")), normalise(record.get("year"))]
        )
        if key in seen:
            return False
        seen.add(key)
        records.append(record)
        return True

    for row in read_csv("Bibliography - Sheet1.csv"):
        author = clean(row.get("Author"))
        title = clean(row.get("Title"))
        publication = clean(row.get("Publication/Source"))
        year = year_from(row.get("Year"))
        bibliography = ". ".join(part for part in [author, title, publication, year] if part) + "."
        add(
            {
                "title": title,
                "author": author,
                "year": year,
                "publication": publication,
                "source": "Prepared Bibliography",
                "bibliography": bibliography,
            }
        )

    for row_number, row in enumerate(read_csv("Pdf Bibliography.csv"), start=2):
        author = clean(row.get("author"))
        title = clean(row.get("title"))
        bibliography = clean(row.get("full Chicago citation"))
        reasons = []
        if len(author) < 3:
            reasons.append("missing/short author")
        if len(title) < 4:
            reasons.append("missing/short title")
        if bibliography and title and normalise(title) not in normalise(bibliography):
            reasons.append("citation may not contain title")
        author_first = normalise(author).split()
        if bibliography and author_first and author_first[0] not in normalise(bibliography):
            reasons.append("citation may not contain author")
        if reasons:
            report.append(
                {
                    "file": "Pdf Bibliography.csv",
                    "row": row_number,
                    "author": author,
                    "title": title,
                    "reason": "; ".join(reasons),
                }
            )
            continue
        add(
            {
                "title": title,
                "author": author,
                "year": year_from(bibliography),
                "source": "PDF Bibliography",
                "bibliography": bibliography,
            }
        )

    for row in read_csv("OAPEN Library Title List - OAPENLibrary.csv"):
        title = clean(row.get("dc.title"))
        author = clean(row.get("dc.contributor.author") or row.get("dc.contributor.editor"))
        subject = clean(row.get("dc.subject.other") or row.get("dc.subject.classification.description"))
        abstract = clean(row.get("dc.description.abstract"))[:800]
        if not is_topic_match(title, author, subject, abstract):
            continue
        add(
            {
                "title": title,
                "author": author,
                "year": year_from(row.get("dc.date.issued")),
                "doi": clean(row.get("oapen.identifier.doi")),
                "isbn": clean(row.get("BITSTREAM_ISBN") or row.get("oapen.relation.isbn")),
                "publisher": clean(row.get("oapen.relation.isPublishedBy_publisher.name")),
                "publication": clean(row.get("oapen.imprint")),
                "source": "OAPEN",
            }
        )

    for row in read_csv("DOAB-Repository_export.csv"):
        title = clean(row.get("dc.title"))
        author = clean(row.get("dc.contributor.author") or row.get("dc.contributor.editor"))
        subject = clean(row.get("dc.subject.other") or row.get("dc.subject") or row.get("dc.subject.classification"))
        abstract = clean(row.get("dc.description.abstract"))[:800]
        if not is_topic_match(title, author, subject, abstract):
            continue
        add(
            {
                "title": title,
                "author": author,
                "year": year_from(row.get("dc.date.issued")),
                "doi": clean(row.get("oapen.identifier.doi") or row.get("grantor.doi")),
                "isbn": clean(row.get("dc.identifier.isbn") or row.get("BITSTREAM ISBN") or row.get("oapen.relation.isbn")),
                "publisher": clean(row.get("dc.publisher") or row.get("publisher.name")),
                "publication": clean(row.get("dc.source")),
                "source": "DOAB",
            }
        )

    for row in read_csv("doaj_journalcsv_20260404_0820_utf8.csv"):
        title = clean(row.get("Journal title"))
        keywords = clean(row.get("Keywords"))
        subjects = clean(row.get("Subjects"))
        if not is_topic_match(title, keywords, subjects):
            continue
        add(
            {
                "title": title,
                "publication": title,
                "isbn": clean(row.get("Journal ISSN (print version)") or row.get("Journal EISSN (online version)")),
                "publisher": clean(row.get("Publisher")),
                "source": "DOAJ Journal",
            }
        )

    records.sort(key=lambda item: (item.get("source", ""), item.get("title", "")))
    return records, report


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    records, report = build_index()
    summary = {
        "record_count": len(records),
        "sources": Counter(record.get("source", "Unknown") for record in records),
        "warnings": report,
    }
    INDEX_PATH.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    REPORT_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(records)} records to {INDEX_PATH}")
    print(f"Wrote {len(report)} warning(s) to {REPORT_PATH}")


if __name__ == "__main__":
    main()
