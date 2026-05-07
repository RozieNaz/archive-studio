import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import metadataIndex from "./data/metadata-index.json";
import "./styles.css";

const COLUMNS = ["Author - Title", "DOI", "ISBN", "Bibliography", "Accuracy", "Filename"];
const NOTE_FIELD = "Notes";
const MANUAL_AUTHOR_TITLE_FIELD = "Manual Author - Title";
const EXPORT_COLUMNS = [...COLUMNS, NOTE_FIELD];
const EDITOR_FIELDS = ["Author - Title", "DOI", "ISBN", "Bibliography", "Accuracy", "Filename"];
const COLUMN_LABELS = { DOI: "DOI", ISBN: "ISBN" };
const SORTABLE_COLUMNS = new Set(["Author - Title", "Accuracy", "Filename"]);
const ACCURACY_RANK = { Zero: 0, Low: 1, Medium: 2, High: 3 };
const SUPPORTED_EXTENSIONS = new Set(["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "rtf", "txt", "csv"]);
const DEFAULT_WIDTHS = [300, 130, 130, 320, 105, 260];
const MIN_WIDTHS = [120, 60, 60, 120, 85, 100];
const COLLAPSED_WIDTH = 34;
const ACCURACY_OPTIONS = ["", "High", "Medium", "Low", "Zero"];
const STORAGE_KEY = "archive-studio-project";
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "if", "in", "into", "nor", "of", "on", "or", "the", "to", "with"]);
const NUMBER_WORDS = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };

function cleanFilename(name) {
  return titleCase(
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/\b(z[-_\s]*library|zlib|1lib|libgen|pdf\s*drive|pdfdrive|anna'?s?\s*archive|archive\.org)\b/gi, " ")
      .replace(/\b(single|page|scan|scanned|ocr|retail|ebook|e-book|epub|pdf|mobi|azw3)\b/gi, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\([^)]*(z[-_\s]*library|zlib|1lib|libgen|pdf\s*drive|pdfdrive|anna'?s?\s*archive|epub|pdf|mobi|azw3|ocr|scan)[^)]*\)/gi, " ")
      .replace(/[_+$@#%^~=]+/g, " ")
      .replace(/[{}[\]|\\/:;"<>?*!]+/g, " ")
      .replace(/[-\u2013\u2014]+/g, " - ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function cleanSearchQuery(value) {
  return cleanFilename(value)
    .replace(/\b(second|third|fourth|fifth|edition|edn)\b/gi, " ")
    .replace(/\bvol\.?\s*(\d+|[ivxlcdm]+)\b/gi, "volume $1")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index, words) => {
      if (word === "-") return word;
      const previous = words[index - 1] || "";
      const startsPhrase = index === 0 || previous === "-" || /[:.!?]$/.test(previous);
      if (!startsPhrase && index < words.length - 1 && SMALL_WORDS.has(word)) return word;
      return word.slice(0, 1).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function makeRow(file) {
  const originalFilename = file.name || "";
  const cleanedFilename = cleanFilename(originalFilename);
  const extension = (file.extension || file.name.split(".").pop() || "").toLowerCase();
  return {
    Filename: originalFilename,
    FilePath: file.path || "",
    Extension: extension,
    Title: "",
    Author: "",
    DOI: "",
    ISBN: "",
    "Suggested Filename": cleanedFilename,
    [MANUAL_AUTHOR_TITLE_FIELD]: "",
    Bibliography: "",
    Accuracy: "",
    Notes: "",
    Locked: false,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((value) => stripJunk(value)));
}

function normaliseCsvHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function csvColumnMap(headers) {
  const aliases = {
    author: ["author", "authors", "creator", "creators", "contributor", "contributors"],
    title: ["title", "booktitle", "worktitle", "publicationtitle", "itemtitle"],
    doi: ["doi", "digitalobjectidentifier"],
    isbn: ["isbn", "isbn10", "isbn13", "eisbn", "printisbn", "electronicisbn"],
    publisher: ["publisher", "imprint"],
    pubdate: ["pubdate", "publicationdate", "publisheddate", "published", "date", "year"],
  };
  const normalisedHeaders = headers.map(normaliseCsvHeader);
  return Object.fromEntries(Object.entries(aliases).map(([field, names]) => [
    field,
    normalisedHeaders.findIndex((header) => names.includes(header)),
  ]));
}

function csvField(cells, map, field) {
  const index = map[field];
  return index >= 0 ? stripJunk(cells[index]) : "";
}

function rowFromCsvRecord(file, cells, map, index) {
  const author = titleCase(csvField(cells, map, "author"));
  const title = cleanTitleText(csvField(cells, map, "title"));
  const doi = cleanDoi(csvField(cells, map, "doi"));
  const isbn = stripJunk(csvField(cells, map, "isbn"));
  const publisher = titleCase(csvField(cells, map, "publisher"));
  const pubdate = csvField(cells, map, "pubdate");
  const year = yearFrom(pubdate);
  const bibliography = normaliseBibliographyLabels(makeBibliography({ author, title, publisher, year, doi, isbn }));
  const suggested = makeSuggestedFilename({ author, title, year });
  const accuracy = author && title && (doi || isbn) ? "Medium" : author && title ? "Low" : "Zero";
  return {
    Filename: file.name,
    FilePath: `${file.path || file.name}#csv-${index + 1}`,
    Extension: "csv",
    Title: title,
    Author: author,
    DOI: doi,
    ISBN: isbn,
    Publisher: publisher,
    Pubdate: pubdate,
    "Suggested Filename": suggested,
    [MANUAL_AUTHOR_TITLE_FIELD]: "",
    Bibliography: bibliography,
    Accuracy: accuracy,
    Notes: "",
    Locked: false,
    PdfTextChecked: true,
  };
}

function rowsFromCsv(file, text) {
  const parsed = parseCsv(text);
  if (parsed.length < 2) return [];
  const [headers, ...records] = parsed;
  const map = csvColumnMap(headers);
  return records
    .map((cells, index) => rowFromCsvRecord(file, cells, map, index))
    .filter((row) => row.Author || row.Title || row.DOI || row.ISBN);
}

function normaliseSavedRows(savedRows) {
  return savedRows.map((row) => {
    const normalised = {
      ...row,
      FilePath: row.FilePath || "",
      Extension: row.Extension || "",
      Filename: row.Filename || row["Suggested Filename"] || "",
      "Suggested Filename": row["Suggested Filename"] || cleanFilename(row.Filename || ""),
      [MANUAL_AUTHOR_TITLE_FIELD]: row[MANUAL_AUTHOR_TITLE_FIELD] || "",
      Accuracy: row.Accuracy || row.Confidence || "",
      Bibliography: normaliseBibliographyLabels(row.Bibliography),
      Notes: row.Notes || "",
      Locked: Boolean(row.Locked),
      Confidence: undefined,
    };
    const assessed = assessLocalAccuracy(normalised);
    return {
      ...normalised,
      ...cleanEntry(normalised),
      Accuracy: !normalised.Accuracy || normalised.Accuracy === "Zero" ? assessed : normalised.Accuracy,
    };
  });
}

function normaliseBibliographyLabels(value) {
  const labelled = String(value || "")
    .replace(/\bDoi:/g, "DOI:")
    .replace(/\bIsbn:/g, "ISBN:");
  return normaliseIdentifierFullStops(labelled);
}

function normaliseIdentifierFullStops(value) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  text = text.replace(/\bDOI:\s*(10\.[^\s.;]+(?:[./][^\s.;]+)*)(?=\s+ISBN:|$)/gi, (_match, doi) => `DOI: ${cleanDoi(doi)}.`);
  text = text.replace(/\bISBN:\s*([0-9Xx,\-\s,]+?)(?=$)/gi, (_match, isbn) => {
    const clean = stripJunk(isbn).replace(/[.;]+$/g, "").trim();
    return clean ? `ISBN: ${clean}.` : "";
  });
  return text;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const escape = (value) => `"${String(value || "").replaceAll('"', '""')}"`;
  const headers = EXPORT_COLUMNS.map(displayLabel);
  return [headers.join(","), ...rows.map((row) => EXPORT_COLUMNS.map((column) => escape(cellValue(row, column))).join(","))].join("\n");
}

function rowToText(row) {
  return EXPORT_COLUMNS.map((column) => `${displayLabel(column)}: ${cellValue(row, column)}`).join("\n");
}

function displayLabel(column) {
  return COLUMN_LABELS[column] || column;
}

function authorTitleDisplay(row) {
  const manual = stripJunk(row[MANUAL_AUTHOR_TITLE_FIELD]);
  if (manual) return manual;
  const author = titleCase(stripJunk(row.Author));
  const title = cleanTitleText(row.Title);
  if (author && title && !looksBrokenIdentity(`${author} ${title}`)) {
    return makeSuggestedFilename({ author, title, year: yearFrom(row.Bibliography || row.Title || row["Suggested Filename"]) });
  }
  const suggested = titleCase(stripJunk(row["Suggested Filename"]));
  if (suggested && !looksBrokenIdentity(suggested)) return suggested;
  const identity = authorTitleFromSource(cleanFilename(row.Filename));
  if (identity.author && identity.title) return makeSuggestedFilename({ author: identity.author, title: identity.title, year: yearFrom(row.Bibliography || row.Title) });
  return suggested || cleanTitleText(row.Title || cleanFilename(row.Filename));
}

function cellValue(row, column) {
  if (column === "Author - Title") return authorTitleDisplay(row);
  return column === "Bibliography" ? normaliseBibliographyLabels(row[column]) : row[column] || "";
}

function editorFieldValue(row, column) {
  if (column === "Author - Title") return row[MANUAL_AUTHOR_TITLE_FIELD] || row["Suggested Filename"] || authorTitleDisplay(row);
  return cellValue(row, column);
}

function rowFileKey(row) {
  return row.FilePath || row.Filename || row["Suggested Filename"] || "";
}

function columnHint(column) {
  const label = displayLabel(column);
  return label.includes(" ")
    ? label.split(" ").map((word) => word[0]).join("")
    : label.slice(0, Math.min(label.length, 2));
}

function romanToNumber(value) {
  const roman = String(value || "").toUpperCase();
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let index = 0; index < roman.length; index += 1) {
    const current = map[roman[index]] || 0;
    const next = map[roman[index + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total ? String(total) : "";
}

function extractVolume(value) {
  const text = String(value || "").toLowerCase();
  const match = text.match(/\b(?:vol(?:ume)?\.?|v\.?)\s*(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (!match) return "";
  const raw = match[1].toLowerCase();
  if (/^\d+$/.test(raw)) return raw;
  if (NUMBER_WORDS[raw]) return NUMBER_WORDS[raw];
  return romanToNumber(raw);
}

function volumeLabel(value) {
  const volume = extractVolume(value);
  return volume ? `Volume ${volume}` : "";
}

function renderFormattedText(value) {
  const parts = String(value || "").split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function renderCellText(column, value) {
  const text = column === "Bibliography" ? normaliseBibliographyLabels(value) : value;
  return renderFormattedText(text);
}

function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    folder: <><path {...common} d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path {...common} d="M3 8.5h18" /></>,
    search: <><circle {...common} cx="10.5" cy="10.5" r="6.5" /><path {...common} d="m16 16 5 5" /></>,
    stop: <><circle {...common} cx="12" cy="12" r="9" /><rect {...common} x="8.5" y="8.5" width="7" height="7" rx="1" /></>,
    save: <><path {...common} d="M5 3h12l2 2v16H5z" /><path {...common} d="M8 3v6h8V3" /><path {...common} d="M8 21v-7h8v7" /></>,
    lock: <><rect {...common} x="5" y="10" width="14" height="10" rx="2" /><path {...common} d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    unlock: <><rect {...common} x="5" y="10" width="14" height="10" rx="2" /><path {...common} d="M16 10V7a4 4 0 0 0-7.7-1.5" /></>,
    copy: <><rect {...common} x="8" y="8" width="11" height="11" rx="2" /><path {...common} d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" /></>,
    wand: <><path {...common} d="m4 20 11-11" /><path {...common} d="m13 7 4 4" /><path {...common} d="M19 4v3" /><path {...common} d="M20.5 5.5h-3" /><path {...common} d="M6 4v2" /><path {...common} d="M7 5H5" /></>,
    checkSearch: <><circle {...common} cx="10" cy="10" r="6" /><path {...common} d="m15 15 5 5" /><path {...common} d="m7.5 10 1.8 1.8 3.5-4" /></>,
    done: <path {...common} d="M5 12.5 10 17l9-10" />,
  };
  return <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">{icons[name]}</svg>;
}

function loadLocalRows() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const payload = JSON.parse(saved);
    return Array.isArray(payload.rows) ? normaliseSavedRows(payload.rows) : [];
  } catch {
    return [];
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  return response.json();
}

async function postTextJson(url, text, timeoutMs = 3500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "text/plain" },
      body: text,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|of|in|on|to|for|with|by|from|edition|volume|vol)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(left, right) {
  const a = new Set(normalise(left).split(" ").filter((token) => token.length >= 3));
  const b = new Set(normalise(right).split(" ").filter((token) => token.length >= 3));
  if (!a.size || !b.size) return 0;
  return [...a].filter((token) => b.has(token)).length / Math.max(a.size, b.size);
}

function yearFrom(value) {
  return String(value || "").match(/\b(15|16|17|18|19|20)\d{2}\b/)?.[0] || "";
}

function firstIdentifier(value) {
  return String(value || "")
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

function doiFromText(value) {
  const match = String(value || "").match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return match ? cleanDoi(match[0]) : "";
}

function isbnFromText(value) {
  const matches = String(value || "").match(/\b(?:97[89][-\s]?)?(?:\d[-\s]?){9,12}[\dX]\b/gi) || [];
  return matches
    .map((match) => match.replace(/[-\s]/g, ""))
    .find((match) => match.length === 10 || match.length === 13) || "";
}

function cleanDoi(value) {
  return String(value || "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\bDOI:\s*/i, "")
    .replace(/[_\s]+/g, "_")
    .replace(/[<>;"{}[\]|\\]+/g, "")
    .replace(/[.,]+$/g, "")
    .toLowerCase()
    .trim();
}

function authorTitleFromSource(value) {
  const source = stripJunk(value);
  const byMatch = source.match(/^(.+?)\s+-\s+by\s+-\s+(.+)$/i) || source.match(/^(.+?)\s+\bby\b\s+(.+)$/i);
  if (byMatch) {
    return {
      author: stripJunk(byMatch[2]),
      title: stripJunk(byMatch[1]),
    };
  }
  const parts = source.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { author: "", title: cleanTitleText(source) };

  if (parts.length >= 3) {
    const joinedAuthor = `${parts[0]} - ${parts[1]}`;
    if (looksLikePersonName(joinedAuthor.replace(/\s+-\s+/g, " "))) {
      return {
        author: joinedAuthor,
        title: cleanTitleText(parts.slice(2).join(" - ").replace(/\((15|16|17|18|19|20)\d{2}\)\s*$/, "").trim()),
      };
    }
  }

  const left = parts[0];
  const right = parts.slice(1).join(" - ").replace(/\((15|16|17|18|19|20)\d{2}\)\s*$/, "").trim();
  if (looksLikePersonName(left)) {
    return { author: left, title: cleanTitleText(right) };
  }
  if (!looksLikePersonName(left) && looksLikePersonName(right)) {
    return { author: right, title: cleanTitleText(left) };
  }

  return {
    author: "",
    title: cleanTitleText(source),
  };
}

function authorTitleFromRow(row) {
  const directAuthor = stripJunk(row.Author);
  const directTitle = stripJunk(row.Title);
  if (directAuthor && directTitle && !looksBrokenIdentity(`${directAuthor} ${directTitle}`)) {
    return { author: directAuthor, title: directTitle };
  }
  return authorTitleFromSource(row["Suggested Filename"] || cleanFilename(row.Filename));
}

function looksLikePersonName(value) {
  const text = stripJunk(value).replace(/\b(et al|edited by|ed\.?)\b/gi, "").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (/\b(history|introduction|dictionary|encyclopaedia|studies|journal|review|volume|religion|islam|qur|theory|politics)\b/i.test(text)) return false;
  return words.filter((word) => /^[A-Z][a-z.'-]+$/.test(word) || /^[A-Z]\.?$/.test(word)).length >= Math.min(words.length, 3);
}

function looksBrokenIdentity(value) {
  const text = stripJunk(value);
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  const hyphenParts = text.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (hyphenParts.length >= 3 && !looksLikePersonName(hyphenParts[0]) && !looksLikePersonName(`${hyphenParts[0]} ${hyphenParts[1]}`)) return true;
  if (words.some((word) => /[a-z]{22,}/i.test(word))) return true;
  if (words.length <= 2 && text.length > 35) return true;
  return /[a-z]{8,}[A-Z]/.test(String(value || ""));
}

function cleanTitleText(value) {
  return titleCase(
    stripTrailingYear(stripJunk(value))
      .replace(/\s+-\s+/g, " ")
      .replace(/\bQur\s+Anic\b/gi, "Quranic")
      .replace(/\bQur\s+An\b/gi, "Quran")
      .replace(/\((15|16|17|18|19|20)\d{2}\)\s*\((15|16|17|18|19|20)\d{2}\)/g, "($2)")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function stripTrailingYear(value) {
  return String(value || "").replace(/\s*\((15|16|17|18|19|20)\d{2}\)\s*$/g, "").trim();
}

function titleAuthorFromPdfText(value) {
  const lines = String(value || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => stripJunk(line).replace(/\s+/g, " ").trim())
    .filter((line) =>
      line.length >= 6 &&
      line.length <= 160 &&
      !/\b(doi|isbn|copyright|abstract|contents|references|bibliography|journal|press|university|volume|issue)\b/i.test(line) &&
      !/^\d+$/.test(line)
    );
  const title = lines.find((line) => line.split(/\s+/).length >= 3) || "";
  const titleIndex = title ? lines.indexOf(title) : -1;
  const author = lines
    .slice(Math.max(0, titleIndex + 1), Math.max(0, titleIndex + 5))
    .find((line) =>
      line.split(/\s+/).length <= 8 &&
      !/[.;:]/.test(line) &&
      /\b[A-Z][a-z]+/.test(titleCase(line))
    ) || "";
  return {
    title: title ? titleCase(title) : "",
    author: author ? titleCase(author) : "",
  };
}

function mergePdfClues(row, text) {
  if (!text) return row;
  const extracted = titleAuthorFromPdfText(text);
  const doi = row.DOI || doiFromText(text);
  const isbn = row.ISBN || isbnFromText(text);
  const author = row.Author || extracted.author;
  const title = row.Title || extracted.title;
  const year = yearFrom(text) || yearFrom(row.Bibliography || row["Suggested Filename"]);
  return {
    ...row,
    DOI: doi,
    ISBN: isbn,
    Author: author,
    Title: title,
    "Suggested Filename": author && title ? makeSuggestedFilename({ author, title, year }) : row["Suggested Filename"],
  };
}

function makeSuggestedFilename(item) {
  const author = stripJunk(item.author || "").split(",")[0].trim();
  const title = shortTitle(stripTrailingYear(item.title || ""));
  const year = item.year || yearFrom(item.title);
  if (author && title && year) return titleCase(`${author} - ${title} (${year})`);
  if (author && title) return titleCase(`${author} - ${title}`);
  if (title && year) return titleCase(`${title} (${year})`);
  return titleCase(title);
}

function stripJunk(value) {
  return String(value || "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\b(z[-_\s]*library|zlib|1lib|libgen|pdf\s*drive|pdfdrive|dokumenhub|anna'?s?\s*archive|archive\.org)\b/gi, " ")
    .replace(/\b(pdf|epub|mobi|azw3|djvu|docx?|rtf|txt)\b$/gi, " ")
    .replace(/[_+$@#%^~=]+/g, " ")
    .replace(/[{}[\]|\\;"<>?!]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function authorFromBibliography(value) {
  const firstPart = bibliographyParts(value).author;
  if (!firstPart || /\b(doi|isbn|journal|press|publisher)\b/i.test(firstPart)) return "";
  const commaMatch = firstPart.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) return titleCase(`${commaMatch[2]} ${commaMatch[1]}`);
  return titleCase(firstPart);
}

function titleFromBibliography(value) {
  return titleCase(bibliographyParts(value).title);
}

function shouldReplaceTitle(currentTitle, extractedTitle, author) {
  const current = stripJunk(currentTitle);
  const extracted = stripJunk(extractedTitle);
  if (!extracted) return false;
  if (!current) return true;
  if (current.length < 8 && extracted.length > current.length + 8) return true;
  const authorTokens = normalise(author).split(" ").filter(Boolean);
  const currentTokens = normalise(current).split(" ").filter(Boolean);
  if (currentTokens.length <= 2 && currentTokens.some((token) => authorTokens.includes(token))) return true;
  return tokenOverlap(current, extracted) < 0.25 && extracted.length > current.length + 8;
}

function doiFromBibliography(value) {
  return doiFromText(normaliseBibliographyLabels(value));
}

function splitBibliographySentences(value) {
  const protectedText = stripJunk(value)
    .replace(/\b([A-Z])\./g, "$1<dot>")
    .replace(/\b(no|vol|ed|eds|trans)\./gi, "$1<dot>");
  return protectedText
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.replace(/<dot>/g, ".").replace(/[.!?]+$/g, "").trim())
    .filter(Boolean);
}

function cleanBibliographyTitle(value) {
  return stripJunk(value)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bibliographyParts(value) {
  const raw = normaliseBibliographyLabels(String(value || ""));
  const htmlTitle = raw.match(/<i>([^<]{4,250})<\/i>/i)?.[1] || "";
  const quotedTitle = raw.match(/[“"]([^”"]{4,250})[”"]/)?.[1] || "";
  const markedTitle = cleanBibliographyTitle(htmlTitle || quotedTitle);
  if (markedTitle) {
    const markerIndex = htmlTitle
      ? raw.toLowerCase().indexOf("<i>")
      : Math.max(raw.indexOf("“"), raw.indexOf('"'));
    const author = stripJunk(raw.slice(0, markerIndex)).replace(/[.!?]+$/g, "").trim();
    return { author, title: markedTitle };
  }
  const parts = splitBibliographySentences(raw);
  return {
    author: parts[0] || "",
    title: cleanBibliographyTitle(parts[1] || ""),
  };
}

function extractFromBibliography(row) {
  if (!row.Bibliography) return {};
  return {
    Author: authorFromBibliography(row.Bibliography),
    Title: titleFromBibliography(row.Bibliography),
    DOI: doiFromBibliography(row.Bibliography),
    ISBN: isbnFromText(row.Bibliography),
  };
}

function shortTitle(value) {
  return stripTrailingYear(stripJunk(value))
    .split(":")[0]
    .split(". ")[0]
    .split(", ")[0]
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEntry(row) {
  const extracted = extractFromBibliography(row);
  const filenameIdentity = authorTitleFromRow(row);
  const rawFilenameIdentity = authorTitleFromSource(cleanFilename(row.Filename));
  const hasBibliographyIdentity = Boolean(extracted.Author && extracted.Title);
  const shouldPreferFilename = !hasBibliographyIdentity && rawFilenameIdentity.author && rawFilenameIdentity.title && looksBrokenIdentity(`${row.Author || ""} ${row.Title || ""} ${row["Suggested Filename"] || ""}`);
  const titleOnly = !rawFilenameIdentity.author && rawFilenameIdentity.title ? rawFilenameIdentity.title : "";
  const author = hasBibliographyIdentity
    ? extracted.Author
    : shouldPreferFilename ? titleCase(rawFilenameIdentity.author)
    : row.Author ? titleCase(stripJunk(row.Author)) : extracted.Author || titleCase(filenameIdentity.author);
  const title = hasBibliographyIdentity
    ? extracted.Title
    : shouldPreferFilename ? titleCase(rawFilenameIdentity.title)
    : shouldReplaceTitle(row.Title, extracted.Title, author)
    ? extracted.Title
    : row.Title && !looksBrokenIdentity(row.Title) ? cleanTitleText(row.Title) : extracted.Title || cleanTitleText(filenameIdentity.title || titleOnly);
  const year = yearFrom(row.Bibliography || row["Suggested Filename"] || row.Title || row.Pubdate);
  const currentSuggested = titleCase(stripJunk(row["Suggested Filename"]));
  const suggested = hasBibliographyIdentity
    ? makeSuggestedFilename({ author, title, year })
    : shouldPreferFilename
    ? makeSuggestedFilename({ author, title, year })
    : author && title && tokenOverlap(currentSuggested, title) < 0.5
    ? makeSuggestedFilename({ author, title, year })
    : !author && /\s+-\s+/.test(currentSuggested)
    ? makeSuggestedFilename({ author, title, year })
    : looksBrokenIdentity(currentSuggested) || tokenOverlap(currentSuggested, title) < 0.35
    ? makeSuggestedFilename({ author, title, year })
    : currentSuggested || makeSuggestedFilename({ author, title, year });
  return {
    ...row,
    Filename: row.Filename,
    Title: title,
    Author: author,
    DOI: cleanDoi(row.DOI || extracted.DOI),
    ISBN: stripJunk(row.ISBN || extracted.ISBN),
    [MANUAL_AUTHOR_TITLE_FIELD]: row[MANUAL_AUTHOR_TITLE_FIELD] || "",
    "Suggested Filename": suggested,
    Bibliography: normaliseBibliographyLabels(stripJunk(row.Bibliography)),
    Notes: stripJunk(row.Notes),
  };
}

function usefulFieldCount(row) {
  return ["Title", "Author", "DOI", "ISBN", "Bibliography"].filter((field) => stripJunk(row[field])).length;
}

function assessLocalAccuracy(row) {
  const cleaned = cleanEntry(row);
  const hasIdentity = hasUsableIdentity(cleaned);
  const hasIdentifier = Boolean(cleaned.DOI || cleaned.ISBN);
  const hasBibliography = Boolean(stripJunk(cleaned.Bibliography));
  if (!hasIdentity) return "Zero";
  if (hasIdentifier && hasBibliography) return "Medium";
  if (hasBibliography || hasIdentifier || stripJunk(cleaned["Suggested Filename"])) return "Low";
  return "Zero";
}

function hasMeaningfulMetadata(row) {
  const cleaned = cleanEntry(row);
  const hasFetchedDetail = Boolean(cleaned.DOI || cleaned.ISBN || stripJunk(cleaned.Bibliography));
  return cleaned.Accuracy !== "Zero" && hasFetchedDetail && usefulFieldCount(cleaned) >= 2 && hasUsableIdentity(cleaned);
}

function accuracyValue(row) {
  return row.Accuracy || "Not Set";
}

function waitForUi() {
  return new Promise((resolve) => setTimeout(resolve, 35));
}

function entryWarnings(row) {
  const warnings = [];
  if (!row.Author) warnings.push("missing author");
  if (!row.Title) warnings.push("missing title");
  if (!yearFrom(row.Bibliography || row["Suggested Filename"])) warnings.push("missing year");
  if (!row.DOI && !row.ISBN) warnings.push("missing DOI/ISBN");
  return warnings;
}

function hasUsableIdentity(row) {
  return Boolean(stripJunk(row.Author) && stripJunk(row.Title));
}

function bibliographyAuthor(value) {
  const clean = stripJunk(value);
  const names = clean.split(",").map((name) => name.trim()).filter(Boolean);
  const first = names[0] || clean;
  const parts = first.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return first;
  return `${parts.at(-1)}, ${parts.slice(0, -1).join(" ")}`;
}

function isStrongBibliography(value) {
  const text = stripJunk(value);
  return Boolean(text && yearFrom(text) && /\bDOI:\s*10\./i.test(text) && (/["“”]/.test(text) || /\b\d+\s*,?\s*no\.?\s*\d+/i.test(text) || /:\s*\d+[-–]\d+/.test(text)));
}

function mergeCheckedRow(original, cleaned, checked) {
  if (checked.Accuracy === "Zero") return { ...cleaned, Accuracy: assessLocalAccuracy(cleaned) };
  const keep = (field, fallback = checked[field]) => cleaned[field] || fallback || "";
  return {
    ...cleaned,
    Title: keep("Title"),
    Author: keep("Author"),
    DOI: keep("DOI"),
    ISBN: keep("ISBN"),
    [MANUAL_AUTHOR_TITLE_FIELD]: original[MANUAL_AUTHOR_TITLE_FIELD] || cleaned[MANUAL_AUTHOR_TITLE_FIELD] || "",
    "Suggested Filename": keep("Suggested Filename"),
    Bibliography: cleaned.Bibliography || checked.Bibliography || "",
    Notes: cleaned.Notes || checked.Notes || "",
    Filename: original.Filename,
    Accuracy: checked.Accuracy || assessLocalAccuracy(cleaned),
    Locked: original.Locked,
  };
}

function makeBibliography(item) {
  const author = stripJunk(item.author);
  const title = stripJunk(item.title);
  const publication = stripJunk(item.publication);
  const publisher = stripJunk(item.publisher);
  const year = item.year || "";
  const doi = cleanDoi(item.doi);
  const isbn = stripJunk(item.isbn);
  if (author && title && publication && (item.volume || item.issue || item.pages)) {
    const volumeIssue = [stripJunk(item.volume), item.issue ? `no. ${stripJunk(item.issue)}` : ""].filter(Boolean).join(", ");
    const pages = item.pages ? `: ${stripJunk(item.pages).replace(/--/g, "–").replace(/-/g, "–")}` : "";
    const doiPart = doi ? ` DOI: ${doi}.` : "";
    const isbnPart = isbn ? ` ISBN: ${isbn}.` : "";
    return normaliseBibliographyLabels(`${bibliographyAuthor(author)}. "${title}." ${publication}${volumeIssue ? ` ${volumeIssue}` : ""}${year ? ` (${year})` : ""}${pages}.${doiPart}${isbnPart}`.replace(/\s+/g, " ").trim());
  }
  const parts = [];
  if (author) parts.push(`${author}.`);
  if (title) parts.push(`${title}.`);
  if (publication) parts.push(`${publication}.`);
  if (publisher) parts.push(`${publisher}.`);
  if (year) parts.push(`${year}.`);
  if (doi) parts.push(`DOI: ${doi}.`);
  if (isbn) parts.push(`ISBN: ${isbn}.`);
  return normaliseBibliographyLabels(parts.join(" ").replace(/\s+/g, " ").trim());
}

async function searchGoogleBooks(query) {
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`);
  return (data?.items || []).map((item) => {
    const info = item.volumeInfo || {};
    return {
      source: "Google Books",
      title: info.title || "",
      author: (info.authors || []).join(", "),
      year: yearFrom(info.publishedDate),
      publisher: info.publisher || "",
      publication: "",
      doi: "",
      isbn: (info.industryIdentifiers || []).map((id) => id.identifier).filter(Boolean).join(", "),
    };
  });
}

async function searchGoogleBooksByIsbn(isbn) {
  const cleanIsbn = String(isbn || "").replace(/[-\s]/g, "");
  if (!cleanIsbn) return [];
  return (await searchGoogleBooks(`isbn:${cleanIsbn}`)).map((item) => ({
    ...item,
    source: "Google Books ISBN",
    score: 96,
    accuracy: "High",
  }));
}

async function searchOpenLibrary(query) {
  const data = await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`);
  return (data?.docs || []).map((item) => ({
    source: "Open Library",
    title: item.title || "",
    author: (item.author_name || []).slice(0, 3).join(", "),
    year: item.first_publish_year || "",
    publisher: (item.publisher || [""])[0] || "",
    publication: "",
    doi: "",
    isbn: (item.isbn || []).slice(0, 3).join(", "),
  }));
}

async function searchOpenLibraryByIsbn(isbn) {
  const cleanIsbn = String(isbn || "").replace(/[-\s]/g, "");
  if (!cleanIsbn) return [];
  const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(cleanIsbn)}&format=json&jscmd=data`);
  const item = data?.[`ISBN:${cleanIsbn}`];
  if (!item) return [];
  return [{
    source: "Open Library ISBN",
    title: item.title || "",
    author: (item.authors || []).slice(0, 3).map((author) => author.name).filter(Boolean).join(", "),
    year: yearFrom(item.publish_date),
    publisher: (item.publishers || [])[0]?.name || "",
    publication: "",
    doi: "",
    isbn: cleanIsbn,
    score: 94,
    accuracy: "High",
  }];
}

function firstMetadataValue(value) {
  if (Array.isArray(value)) return firstMetadataValue(value[0]);
  if (value && typeof value === "object") return firstMetadataValue(value.name || value.value || "");
  return stripJunk(value);
}

function metadataValues(value) {
  if (Array.isArray(value)) return value.map(firstMetadataValue).filter(Boolean);
  const first = firstMetadataValue(value);
  return first ? [first] : [];
}

function archiveIdentifierFromRow(row) {
  const text = [row.Filename, row.FilePath, row.Bibliography, row.Notes].filter(Boolean).join(" ");
  const match = text.match(/archive\.org\/(?:details|metadata)\/([A-Za-z0-9_-]{5,120})/i);
  return match ? match[1] : "";
}

function identifiersFromMetadata(metadata) {
  const text = [
    metadata?.identifier,
    metadata?.isbn,
    metadata?.isbn10,
    metadata?.isbn13,
    metadata?.doi,
    metadata?.external_identifier,
    metadata?.["external-identifier"],
  ].flatMap(metadataValues).join(" ");
  return {
    doi: cleanDoi(doiFromText(text)),
    isbn: isbnFromText(text),
  };
}

function mapArchiveMetadata(metadata, score = 0) {
  const identifiers = identifiersFromMetadata(metadata || {});
  const title = firstMetadataValue(metadata?.title);
  if (!title) return null;
  return {
    source: "Internet Archive",
    title,
    author: metadataValues(metadata?.creator).slice(0, 3).join(", "),
    year: yearFrom(firstMetadataValue(metadata?.date) || firstMetadataValue(metadata?.year)),
    publisher: firstMetadataValue(metadata?.publisher),
    publication: firstMetadataValue(metadata?.collection),
    doi: identifiers.doi,
    isbn: identifiers.isbn,
    score,
    accuracy: score >= 80 ? "High" : "Medium",
  };
}

async function searchArchiveByIdentifier(identifier) {
  if (!identifier) return [];
  const data = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
  const item = mapArchiveMetadata(data?.metadata, 86);
  return item ? [item] : [];
}

async function searchArchive(query) {
  const safeQuery = stripJunk(query).replace(/"/g, " ").trim();
  if (!safeQuery) return [];
  const params = new URLSearchParams({
    q: `title:"${safeQuery}" AND mediatype:texts`,
    output: "json",
    rows: "5",
  });
  ["identifier", "title", "creator", "date", "publisher"].forEach((field) => params.append("fl[]", field));
  const data = await fetchJson(`https://archive.org/advancedsearch.php?${params.toString()}`);
  return (data?.response?.docs || []).map((doc) => mapArchiveMetadata(doc, 0)).filter(Boolean);
}

async function searchOpenAlex(author, title) {
  const query = [author, title].filter(Boolean).join(" ");
  if (!query) return [];
  const data = await fetchJson(`https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=5`);
  return (data?.results || []).map((item) => {
    const biblio = item.biblio || {};
    const firstPage = biblio.first_page || "";
    const lastPage = biblio.last_page || "";
    return {
      source: "OpenAlex",
      title: stripJunk(item.title || item.display_name || ""),
      author: (item.authorships || []).slice(0, 3).map((authorship) => authorship.author?.display_name).filter(Boolean).join(", "),
      year: item.publication_year || "",
      publisher: item.primary_location?.source?.host_organization_name || "",
      publication: stripJunk(item.primary_location?.source?.display_name || ""),
      doi: cleanDoi(item.doi || ""),
      isbn: "",
      volume: biblio.volume || "",
      issue: biblio.issue || "",
      pages: firstPage && lastPage ? `${firstPage}-${lastPage}` : firstPage,
    };
  });
}

async function searchCrossref(query) {
  const data = await fetchJson(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=5`);
  return (data?.message?.items || []).map((item) => ({
    source: "Crossref",
    title: stripJunk((item.title || [""])[0] || ""),
    author: (item.author || []).slice(0, 3).map((a) => a.name || [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", "),
    year: item.issued?.["date-parts"]?.[0]?.[0] || "",
    publisher: item.publisher || "",
    publication: stripJunk((item["container-title"] || [""])[0] || ""),
    doi: item.DOI || "",
    isbn: (item.ISBN || []).join(", "),
    volume: item.volume || "",
    issue: item.issue || "",
    pages: item.page || "",
  }));
}

async function searchCrossrefByAuthorTitle(author, title) {
  if (!author || !title) return [];
  const params = new URLSearchParams({
    "query.author": author,
    "query.title": title,
    rows: "5",
  });
  const data = await fetchJson(`https://api.crossref.org/works?${params.toString()}`);
  return (data?.message?.items || []).map((item) => ({
    source: "Crossref Author Title",
    title: stripJunk((item.title || [""])[0] || ""),
    author: (item.author || []).slice(0, 3).map((a) => a.name || [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", "),
    year: item.issued?.["date-parts"]?.[0]?.[0] || "",
    publisher: item.publisher || "",
    publication: stripJunk((item["container-title"] || [""])[0] || ""),
    doi: item.DOI || "",
    isbn: (item.ISBN || []).join(", "),
    volume: item.volume || "",
    issue: item.issue || "",
    pages: item.page || "",
  }));
}

async function searchCrossrefByDoi(doi) {
  const doiValue = cleanDoi(doi);
  if (!doiValue.startsWith("10.")) return [];
  const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doiValue)}`);
  const item = data?.message;
  if (!item) return [];
  return [{
    source: "Crossref DOI",
    title: stripJunk((item.title || [""])[0] || ""),
    author: (item.author || []).slice(0, 3).map((a) => a.name || [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", "),
    year: item.issued?.["date-parts"]?.[0]?.[0] || "",
    publisher: item.publisher || "",
    publication: stripJunk((item["container-title"] || [""])[0] || ""),
    doi: item.DOI || doiValue,
    isbn: (item.ISBN || []).join(", "),
    volume: item.volume || "",
    issue: item.issue || "",
    pages: item.page || "",
    score: 100,
    accuracy: "High",
  }];
}

function zoteroCreatorsToAuthor(creators = []) {
  return creators
    .filter((creator) => !creator.creatorType || ["author", "editor"].includes(creator.creatorType))
    .slice(0, 3)
    .map((creator) => {
      if (creator.name) return creator.name;
      return [creator.firstName, creator.lastName].filter(Boolean).join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function mapZoteroItem(item) {
  return {
    source: "Zotero Translation Server",
    title: stripJunk(item.title || ""),
    author: zoteroCreatorsToAuthor(item.creators || []),
    year: yearFrom(item.date),
    publisher: item.publisher || "",
    publication: stripJunk(item.publicationTitle || item.proceedingsTitle || item.bookTitle || ""),
    doi: cleanDoi(item.DOI || item.doi || ""),
    isbn: item.ISBN || item.isbn || "",
    volume: item.volume || "",
    issue: item.issue || "",
    pages: item.pages || "",
    score: 100,
    accuracy: "High",
  };
}

async function searchZoteroTranslationServer(identifier) {
  const cleanIdentifier = firstIdentifier(identifier);
  if (!cleanIdentifier) return [];
  const data = await postTextJson("http://127.0.0.1:1969/search", cleanIdentifier);
  const items = Array.isArray(data) ? data : [];
  return items.map(mapZoteroItem).filter((item) => item.title);
}

function splitIdentifiers(value) {
  return String(value || "")
    .split(/[,\n;|]/)
    .map((part) => part.replace(/[-\s]/g, "").trim().toLowerCase())
    .filter(Boolean);
}

function isLikelyIsbn(value) {
  return /^(?:97[89])?\d{9}[\dx]$/i.test(String(value || ""));
}

function searchLocalMetadataIndex(row, query, expected = {}) {
  const doi = cleanDoi(row.DOI);
  const isbnSet = new Set(splitIdentifiers(row.ISBN));
  const filename = row["Suggested Filename"] || cleanFilename(row.Filename) || "";
  const titleQuery = expected.title || query || filename;
  return metadataIndex
    .map((record) => {
      const recordDoi = cleanDoi(record.doi);
      const recordIsbns = splitIdentifiers(record.isbn);
      const titleScore = tokenOverlap(titleQuery, record.title);
      const filenameTitleScore = tokenOverlap(filename, record.title);
      const authorScore = expected.author && record.author
        ? tokenOverlap(expected.author, record.author)
        : tokenOverlap(filename, record.author || "");
      const filenameAuthorScore = tokenOverlap(filename, record.author || "");
      const sourceBoost = record.source === "PDF Bibliography" || record.source === "Prepared Bibliography" ? 12 : 0;
      let score = 0;
      if (doi && recordDoi && (doi === recordDoi || doi.includes(recordDoi) || recordDoi.includes(doi))) score = 100;
      if ([...isbnSet].some((isbn) => recordIsbns.includes(isbn))) score = Math.max(score, 95);
      if (!score) {
        const bestTitleScore = Math.max(titleScore, filenameTitleScore);
        const bestAuthorScore = Math.max(authorScore, filenameAuthorScore);
        const trustedIndexHit = sourceBoost && bestTitleScore >= 0.28 && (bestAuthorScore >= 0.2 || tokenOverlap(filename, `${record.author} ${record.title}`) >= 0.38);
        if (!trustedIndexHit && bestTitleScore < 0.36 && bestAuthorScore < 0.35) return null;
        score = bestTitleScore * 68 + bestAuthorScore * 28 + sourceBoost;
        if (record.year && filename.includes(String(record.year))) score += 6;
        if (record.doi || record.isbn) score += 4;
      }
      if (score < 30) return null;
      return {
        source: `Local Index: ${record.source || "Metadata"}`,
        title: record.title || "",
        author: record.author || "",
        year: record.year || "",
        publisher: record.publisher || "",
        publication: record.publication || "",
        doi: record.doi || "",
        isbn: record.isbn || "",
        bibliography: record.bibliography || "",
        score,
        accuracy: score >= 80 ? "High" : score >= 50 ? "Medium" : "Low",
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 20);
}

function chooseBest(filename, query, candidates, expected = {}) {
  const fileVolume = extractVolume(filename);
  const scored = candidates
    .filter((item) => item.title)
    .map((item) => {
      const titleScore = tokenOverlap(query || filename, item.title);
      const authorScore = expected.author ? tokenOverlap(expected.author, item.author) : 0;
      let score = typeof item.score === "number" ? item.score : titleScore * 55;
      const candidateVolume = extractVolume(item.title);
      if (expected.author) score += authorScore * 35;
      else if (item.author && tokenOverlap(filename, item.author) > 0) score += 15;
      if (item.isbn) score += 8;
      if (item.doi) score += 5;
      if (item.year && filename.includes(String(item.year))) score += 8;
      if (fileVolume && candidateVolume && fileVolume === candidateVolume) score += 18;
      if (fileVolume && candidateVolume && fileVolume !== candidateVolume) score -= 45;
      if (expected.author && authorScore < 0.25) score -= 40;
      if (expected.title && titleScore < 0.5) score -= 40;
      const accuracy = score >= 55 ? "High" : score >= 32 ? "Medium" : score >= 12 ? "Low" : "Zero";
      return { ...item, score, accuracy, titleScore, authorScore };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  if (best && expected.author && expected.title && (best.authorScore < 0.25 || best.titleScore < 0.5)) return null;
  return best && best.score >= 55 ? best : null;
}

function metadataRowFromBest(row, best) {
  const sourceName = row["Suggested Filename"] || cleanFilename(row.Filename);
  const fileVolume = extractVolume(sourceName);
  const bestVolume = extractVolume(best.title);
  let title = best.title;
  if (fileVolume && bestVolume && fileVolume !== bestVolume) {
    title = sourceName || best.title;
  } else if (fileVolume && !bestVolume) {
    title = `${best.title}, ${volumeLabel(sourceName)}`;
  }
  const output = { ...best, title };
  const bibliography = best.bibliography || makeBibliography(output);
  const nextRow = {
    ...row,
    Title: titleCase(output.title),
    Author: titleCase(best.author),
    DOI: best.doi,
    ISBN: best.isbn,
    "Suggested Filename": makeSuggestedFilename(output),
    Bibliography: bibliography,
    Accuracy: best.accuracy === "Zero" ? "Low" : best.accuracy,
  };
  if (!hasUsableIdentity(nextRow)) return { ...nextRow, Accuracy: assessLocalAccuracy(nextRow) };
  return {
    ...nextRow,
  };
}

async function fetchMetadataForRow(row) {
  const cleanedInput = cleanEntry(row);
  const query = cleanSearchQuery(cleanedInput.Title || cleanedInput["Suggested Filename"] || cleanedInput.Filename || cleanedInput.Bibliography);
  const authorTitle = authorTitleFromRow(cleanedInput);
  const sourceIdentity = cleanedInput["Suggested Filename"] || cleanFilename(cleanedInput.Filename) || cleanedInput.Bibliography || "";
  const candidates = [];
  const localCandidates = searchLocalMetadataIndex(cleanedInput, query, authorTitle);
  const localBest = chooseBest(sourceIdentity, authorTitle.title || query, localCandidates, authorTitle);
  if (localBest && localBest.score >= 70) return metadataRowFromBest(cleanedInput, localBest);
  candidates.push(...localCandidates);
  for (const identifier of [cleanedInput.DOI, cleanedInput.ISBN].map(firstIdentifier).filter(Boolean)) {
    try {
      candidates.push(...(await searchZoteroTranslationServer(identifier)));
    } catch {
      // Zotero Translation Server is optional; fall back if it is not running.
    }
  }
  if (cleanedInput.DOI) {
    try {
      candidates.push(...(await searchCrossrefByDoi(cleanedInput.DOI)));
    } catch {
      // Keep going if DOI lookup fails.
    }
  }
  for (const isbn of splitIdentifiers(cleanedInput.ISBN).filter(isLikelyIsbn).slice(0, 3)) {
    try {
      candidates.push(...(await searchGoogleBooksByIsbn(isbn)));
      candidates.push(...(await searchOpenLibraryByIsbn(isbn)));
    } catch {
      // Keep going if ISBN lookup fails.
    }
  }
  try {
    candidates.push(...(await searchArchiveByIdentifier(archiveIdentifierFromRow(cleanedInput))));
  } catch {
    // Internet Archive identifiers are optional clues.
  }
  try {
    candidates.push(...(await searchOpenAlex(authorTitle.author, authorTitle.title)));
    candidates.push(...(await searchCrossrefByAuthorTitle(authorTitle.author, authorTitle.title)));
    candidates.push(...(await searchArchive(authorTitle.title)));
  } catch {
    // Keep going if author-title lookup fails.
  }
  for (const search of [query, query.replace(/\b(review of|review|book review)\b/gi, "").trim()].filter(Boolean)) {
    try {
      candidates.push(...(await searchCrossref(search)));
      candidates.push(...(await searchGoogleBooks(search)));
      candidates.push(...(await searchOpenLibrary(search)));
      candidates.push(...(await searchArchive(search)));
    } catch {
      // Keep fetching other rows if one public source blocks or times out.
    }
  }
  const best = chooseBest(sourceIdentity, authorTitle.title || query, candidates, authorTitle);
  if (!best) {
    return { ...cleanedInput, Accuracy: assessLocalAccuracy(cleanedInput) };
  }
  return metadataRowFromBest(cleanedInput, best);
}

function App() {
  const [rows, setRows] = useState(loadLocalRows);
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [status, setStatus] = useState("Choose a folder to begin.");
  const [isDark, setIsDark] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [colWidths, setColWidths] = useState(DEFAULT_WIDTHS);
  const [sortConfig, setSortConfig] = useState({ column: "", direction: "asc" });
  const [formatMenu, setFormatMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [accuracyFilter, setAccuracyFilter] = useState("All");
  const [collapsedColumns, setCollapsedColumns] = useState([]);
  const [openMenu, setOpenMenu] = useState("");
  const searchInput = useRef(null);
  const projectInput = useRef(null);
  const stopFetch = useRef(false);
  const rowsRef = useRef(rows);

  const collapsedSet = useMemo(() => new Set(collapsedColumns), [collapsedColumns]);
  const activeWidths = colWidths.map((width, index) => collapsedSet.has(index) ? COLLAPSED_WIDTH : width);
  const gridTemplateColumns = activeWidths.map((width) => `${width}px`).join(" ");
  const tableWidth = activeWidths.reduce((sum, width) => sum + width, 0);
  const selectedRows = selectedIndexes.map((index) => rows[index]).filter(Boolean);
  const selected = selectedIndexes.length === 1 ? selectedRows[0] : null;
  const selectedLocked = selectedRows.length > 0 && selectedRows.every((row) => row.Locked);
  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        (accuracyFilter === "All" || (accuracyFilter === "Locked" ? row.Locked : accuracyValue(row) === accuracyFilter)) &&
        (!query || EXPORT_COLUMNS.some((column) => String(cellValue(row, column) || "").toLowerCase().includes(query)))
      );
  }, [rows, searchQuery, accuracyFilter]);
  const counts = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        summary.total += 1;
        summary[accuracyValue(row)] += 1;
        if (row.Locked) summary.locked += 1;
        return summary;
      },
      { total: 0, High: 0, Medium: 0, Low: 0, Zero: 0, "Not Set": 0, locked: 0 }
    );
  }, [rows]);

  useEffect(() => {
    rowsRef.current = rows;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows }));
  }, [rows]);

  useEffect(() => {
    const closeMenu = () => {
      setFormatMenu(null);
      setOpenMenu("");
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenu);
    };
  }, []);

  function beginResize(index, event) {
    event.preventDefault();
    if (collapsedSet.has(index)) return;
    const startX = event.clientX;
    const startWidth = colWidths[index];
    const onMove = (moveEvent) => {
      const next = [...colWidths];
      next[index] = Math.max(MIN_WIDTHS[index], startWidth + moveEvent.clientX - startX);
      setColWidths(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function toggleColumnCollapse(index, event) {
    event.stopPropagation();
    setCollapsedColumns((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
    );
  }

  async function addScannedFiles(files) {
    const existing = new Set(rows.map(rowFileKey));
    const scannedRows = [];
    let csvRows = 0;
    for (const file of Array.from(files)) {
      const extension = (file.extension || file.name.split(".").pop() || "").toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
      if (extension === "csv" && file.path) {
        try {
          const text = await invoke("read_text_file", { path: file.path });
          const imported = rowsFromCsv(file, text);
          csvRows += imported.length;
          scannedRows.push(...imported);
        } catch {
          scannedRows.push(makeRow(file));
        }
      } else {
        scannedRows.push(makeRow(file));
      }
    }
    const next = [...rows];
    let added = 0;
    let updated = 0;

    scannedRows.forEach((row) => {
        const key = rowFileKey(row);
        if (!existing.has(key)) {
          next.push(row);
          existing.add(key);
          added += 1;
          return;
        }
        const existingIndex = next.findIndex((item) => rowFileKey(item) === key);
        if (existingIndex >= 0 && row.FilePath && !next[existingIndex].FilePath) {
          next[existingIndex] = {
            ...next[existingIndex],
            FilePath: row.FilePath,
            Extension: row.Extension,
            PdfTextChecked: false,
          };
          updated += 1;
        }
      });

    setRows(next);
    setStatus(`Scan complete. Added ${added} entries${csvRows ? `, including ${csvRows} from CSV` : ""}, updated ${updated} existing file paths. Total: ${next.length}.`);
  }

  async function chooseFolderAndScan() {
    if (isFetching) return;
    setStatus("Choose a folder to scan...");
    try {
      const files = await invoke("scan_folder");
      if (!files.length) {
        setStatus("No folder selected, or no supported files found.");
        return;
      }
      await addScannedFiles(files);
    } catch (error) {
      setStatus(`Folder scan failed: ${error}`);
    }
  }

  function selectRow(index, event) {
    if (event.ctrlKey || event.metaKey) {
      setSelectedIndexes((current) =>
        current.includes(index) ? current.filter((item) => item !== index) : [...current, index]
      );
      return;
    }
    setSelectedIndexes([index]);
  }

  function selectAllVisibleRows() {
    setSelectedIndexes(visibleRows.map(({ index }) => index));
    setStatus(`Selected ${visibleRows.length} visible entr${visibleRows.length === 1 ? "y" : "ies"}.`);
  }

  function sortBy(column) {
    if (!SORTABLE_COLUMNS.has(column)) return;
    const direction =
      sortConfig.column === column
        ? sortConfig.direction === "asc" ? "desc" : "asc"
        : column === "Accuracy" ? "desc" : "asc";
    setRows((current) =>
      [...current].sort((left, right) => {
        const a =
          column === "Accuracy"
            ? (ACCURACY_RANK[left[column]] ?? -1) - (ACCURACY_RANK[right[column]] ?? -1)
            : String(cellValue(left, column) || "").localeCompare(String(cellValue(right, column) || ""), undefined, { sensitivity: "base" });
        return direction === "asc" ? a : -a;
      })
    );
    setSortConfig({ column, direction });
    setSelectedIndexes([]);
    setStatus(`Sorted by ${displayLabel(column)} ${direction === "asc" ? "A-Z" : "Z-A"}.`);
  }

  async function fetchMetadata() {
    if (!rows.length || isFetching) return;
    stopFetch.current = false;
    setIsFetching(true);
    const queue = visibleRows
      .filter(({ row }) => !row.Locked)
      .filter(({ row }) => accuracyValue(row) !== "High")
      .map(({ row }) => ({ row: { ...row }, key: rowFileKey(row) }));
    if (!queue.length) {
      setIsFetching(false);
      setStatus("No unlocked entries need metadata for this filter.");
      return;
    }
    for (let index = 0; index < queue.length; index += 1) {
      if (stopFetch.current) {
        setStatus("Metadata fetch stopped.");
        break;
      }
      const current = queue[index];
      if (!rowsRef.current.some((row) => rowFileKey(row) === current.key && !row.Locked)) continue;
      setStatus(`Reading PDF text ${index + 1}/${queue.length}`);
      const enriched = await enrichRowWithPdfText(current.row);
      if (!rowsRef.current.some((row) => rowFileKey(row) === current.key && !row.Locked)) continue;
      setStatus(`Fetching metadata ${index + 1}/${queue.length}`);
      const fetched = await fetchMetadataForRow(enriched);
      if (stopFetch.current) {
        setStatus("Metadata fetch stopped.");
        break;
      }
      setRows((current) =>
        current.map((row) => (rowFileKey(row) === queue[index].key && !row.Locked ? { ...fetched, Filename: row.Filename, FilePath: row.FilePath } : row))
      );
    }
    setIsFetching(false);
    if (!stopFetch.current) setStatus("Metadata fetch complete.");
  }

  function stopCurrentJob() {
    if (!isFetching) return;
    stopFetch.current = true;
    setStatus("Stopping metadata fetch...");
  }

  async function enrichRowWithPdfText(row) {
    if (row.PdfTextChecked || row.Extension !== "pdf" || !row.FilePath) return row;
    try {
      const text = await invoke("extract_pdf_text", { path: row.FilePath, maxPages: 5 });
      return {
        ...mergePdfClues(row, text),
        PdfTextChecked: true,
      };
    } catch {
      return {
        ...row,
        PdfTextChecked: true,
      };
    }
  }

  function updateSelected(field, value) {
    if (selectedIndexes.length !== 1) return;
    if (field === "Filename") return;
    const selectedIndex = selectedIndexes[0];
    if (rows[selectedIndex]?.Locked) return;
    setRows((current) =>
      current.map((row, index) =>
        index === selectedIndex ? updateRowField(row, field, value) : row
      )
    );
  }

  function updateRowField(row, field, value) {
    const next = { ...row, [field]: value };
    if (field === "Author - Title") {
      const identity = authorTitleFromSource(value);
      next.Author = identity.author ? titleCase(stripJunk(identity.author)) : "";
      next.Title = cleanTitleText(identity.title || value);
      next[MANUAL_AUTHOR_TITLE_FIELD] = value;
      delete next["Author - Title"];
      return next;
    }
    if (field === "Author" || field === "Title") {
      const author = titleCase(stripJunk(next.Author));
      const title = cleanTitleText(next.Title);
      next["Suggested Filename"] = makeSuggestedFilename({
        author,
        title,
        year: yearFrom(next.Bibliography || value || next["Suggested Filename"]),
      });
    }
    return next;
  }

  function openFormatMenu(event, field) {
    if (event.currentTarget.selectionStart === event.currentTarget.selectionEnd) return;
    event.preventDefault();
    setFormatMenu({
      field,
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function applyFormat(marker) {
    if (!formatMenu || selectedIndexes.length !== 1) return;
    const selectedIndex = selectedIndexes[0];
    if (rows[selectedIndex]?.Locked) return;
    const field = formatMenu.field;
    if (field === "Filename") return;
    setRows((current) =>
      current.map((row, index) => {
        if (index !== selectedIndex) return row;
        const value = String(row[field] || "");
        const before = value.slice(0, formatMenu.start);
        const middle = value.slice(formatMenu.start, formatMenu.end);
        const after = value.slice(formatMenu.end);
        return { ...row, [field]: `${before}${marker}${middle}${marker}${after}` };
      })
    );
    setFormatMenu(null);
    setStatus(marker === "**" ? "Bold formatting added." : "Italic formatting added.");
  }

  async function copySelection(kind) {
    if (!kind) return;
    if (!selectedRows.length) {
      setStatus("Select one or more entries to copy.");
      return;
    }
    const text = selectedRows
      .map((row) => {
        if (kind === "bibliography") return row.Bibliography || "";
        if (kind === "authorTitle") return authorTitleDisplay(row);
        return rowToText(row);
      })
      .filter(Boolean)
      .join(kind === "entry" ? "\n\n" : "\n");
    if (!text) {
      setStatus("Nothing to copy for this selection.");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus(`Copied ${selectedRows.length} selected entr${selectedRows.length === 1 ? "y" : "ies"}.`);
  }

  async function exportCsv() {
    if (!rows.length) return;
    try {
      const path = await invoke("save_csv", { filename: "metadata-log.csv", contents: toCsv(rows) });
      setStatus(`CSV saved to ${path}.`);
    } catch (error) {
      setStatus(`CSV export failed: ${error}`);
    }
  }

  async function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows }));
    if (!rows.length) {
      setStatus("Project saved on this device.");
      return;
    }
    try {
      const path = await invoke("save_csv", { filename: "metadata-log.csv", contents: toCsv(rows) });
      setStatus(`Project saved. CSV updated at ${path}.`);
    } catch (error) {
      setStatus(`Project saved locally. CSV save failed: ${error}`);
    }
  }

  function deleteSelectedEntries() {
    if (!selectedIndexes.length) return;
    const remove = new Set(selectedIndexes);
    const lockedCount = selectedRows.filter((row) => row.Locked).length;
    setRows((current) => current.filter((row, index) => row.Locked || !remove.has(index)));
    setSelectedIndexes([]);
    const deletedCount = selectedIndexes.length - lockedCount;
    setStatus(`Deleted ${deletedCount} entr${deletedCount === 1 ? "y" : "ies"}.`);
  }

  function toggleSelectedLocks() {
    const indexes = selectedIndexes.length
      ? selectedIndexes
      : accuracyFilter === "All" ? [] : visibleRows.map(({ index }) => index);
    if (!indexes.length) {
      setStatus("Select entries, or choose an accuracy filter before locking a group.");
      return;
    }
    const selectedSet = new Set(indexes);
    const targetRows = indexes.map((index) => rows[index]).filter(Boolean);
    const nextLocked = !targetRows.every((row) => row.Locked);
    setRows((current) =>
      current.map((row, index) => (selectedSet.has(index) ? { ...row, Locked: nextLocked } : row))
    );
    setSelectedIndexes(indexes);
    setStatus(`${nextLocked ? "Locked" : "Unlocked"} ${indexes.length} entr${indexes.length === 1 ? "y" : "ies"}.`);
  }

  function clearUnlockedEntries() {
    if (!rows.length) return;
    if (!window.confirm("Clear all entries? Locked entries will stay.")) return;
    const lockedRows = rows.filter((row) => row.Locked);
    const removed = rows.length - lockedRows.length;
    stopFetch.current = true;
    setRows(lockedRows);
    setSelectedIndexes([]);
    setStatus(`Cleared ${removed} entr${removed === 1 ? "y" : "ies"}.`);
  }

  async function openProject(file) {
    const payload = JSON.parse(await file.text());
    setRows(Array.isArray(payload.rows) ? normaliseSavedRows(payload.rows) : []);
    setSelectedIndexes([]);
    setStatus(`Opened project: ${file.name}`);
  }

  function closeSelectedEntry() {
    setSelectedIndexes([]);
    setStatus("Entry saved.");
  }

  function chooseCopy(kind) {
    copySelection(kind);
    setOpenMenu("");
  }

  function chooseAccuracy(value) {
    updateSelected("Accuracy", value);
    setOpenMenu("");
  }

  function chooseAccuracyFilter(value) {
    const nextFilter = accuracyFilter === value ? "All" : value;
    setAccuracyFilter(nextFilter);
    setSelectedIndexes([]);
    setOpenMenu("");
    setStatus(nextFilter === "All" ? "Showing all entries." : `Showing ${nextFilter.toLowerCase()} entries.`);
  }

  function cleanSelectedEntry() {
    if (selectedIndexes.length !== 1) return;
    const selectedIndex = selectedIndexes[0];
    if (rows[selectedIndex]?.Locked) return;
    setRows((current) =>
      current.map((row, index) => (index === selectedIndex ? cleanEntry(row) : row))
    );
    setStatus("Selected entry cleaned up.");
  }

  function cleanUnlockedEntries() {
    if (!rows.length) return;
    let cleanedCount = 0;
    setRows((current) =>
      current.map((row) => {
        if (row.Locked) return row;
        cleanedCount += 1;
        return cleanEntry(row);
      })
    );
    setStatus(`Cleaned ${cleanedCount} entr${cleanedCount === 1 ? "y" : "ies"}.`);
  }

  async function quickCheckSelectedEntry() {
    if (selectedIndexes.length !== 1 || isFetching) return;
    const selectedIndex = selectedIndexes[0];
    const row = rows[selectedIndex];
    if (!row || row.Locked) return;
    setIsFetching(true);
    try {
      setStatus("Quick Check: reading PDF text...");
      await waitForUi();
      const enriched = await enrichRowWithPdfText({ ...row, PdfTextChecked: false });
      const cleaned = cleanEntry(enriched);
      setStatus("Quick Check: searching DOI, ISBN, title, and author...");
      await waitForUi();
      const lookupText = [cleaned.DOI, cleaned.ISBN, cleaned.Author, cleaned.Title, cleaned.Bibliography, cleaned["Suggested Filename"], cleaned.Filename]
        .filter(Boolean)
        .join(" ");
      const lookupRow = {
        ...cleaned,
        Filename: lookupText,
        "Suggested Filename": lookupText,
      };
      const checked = await fetchMetadataForRow(lookupRow);
      const finalRow = mergeCheckedRow(row, cleaned, checked);
      setRows((current) =>
        current.map((item, index) => (index === selectedIndex ? finalRow : item))
      );
      const changed = ["Title", "Author", "DOI", "ISBN", "Bibliography", "Suggested Filename", "Accuracy"]
        .some((field) => String(finalRow[field] || "") !== String(row[field] || ""));
      setStatus(changed ? `Quick Check updated entry. Accuracy: ${finalRow.Accuracy || "Not Set"}.` : "Quick Check complete. No updates found.");
    } catch {
      const cleaned = cleanEntry(row);
      setRows((current) =>
        current.map((item, index) => (index === selectedIndex ? cleaned : item))
      );
      setStatus("Quick Check failed. No updates found.");
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
      const commandKey = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (commandKey && key === "a") {
        event.preventDefault();
        selectAllVisibleRows();
        return;
      }
      if (commandKey && key === "c") {
        event.preventDefault();
        copySelection("entry");
        return;
      }
      if (commandKey && key === "s") {
        event.preventDefault();
        saveProject();
        return;
      }
      if (commandKey && key === "f") {
        event.preventDefault();
        searchInput.current?.focus();
        return;
      }
      if ((event.key === "Delete" || (commandKey && key === "x")) && selectedIndexes.length) {
        event.preventDefault();
        deleteSelectedEntries();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndexes, rows, visibleRows]);

  return (
    <main className={isDark ? "app dark" : "app"}>
      <header className="topbar">
        <div className="brand">
          <h1>Archive Studio</h1>
          <p className="status-line">{status}</p>
          {counts.total > 0 && (
            <div className="accuracy-summary" aria-label="Accuracy counts">
              {["High", "Medium", "Low", "Zero", "Not Set"].map((value) => (
                <button key={value} className={accuracyFilter === value ? "active" : ""} onClick={() => chooseAccuracyFilter(value)}>
                  {value}: {counts[value]}
                </button>
              ))}
              {counts.locked > 0 && (
                <button className={accuracyFilter === "Locked" ? "active" : ""} onClick={() => chooseAccuracyFilter("Locked")}>
                  Locked: {counts.locked}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="actions">
          <div className="search-box">
            <input ref={searchInput} className="search-input" value={searchQuery} placeholder="Search" onChange={(event) => setSearchQuery(event.target.value)} />
            {searchQuery && (
              <button className="clear-search" title="Clear Search" onClick={() => {
                setSearchQuery("");
                searchInput.current?.focus();
              }}>x</button>
            )}
          </div>
          <button title="Open Folder" onClick={chooseFolderAndScan}><Icon name="folder" /></button>
          <button title="Fetch Metadata" onClick={fetchMetadata} disabled={!rows.length || isFetching}><Icon name="search" /></button>
          <button title="Stop Fetch" onClick={stopCurrentJob} disabled={!isFetching}><Icon name="stop" /></button>
          <button title="Save" onClick={saveProject} disabled={!rows.length}><Icon name="save" /></button>
          <button title={selectedRows.length ? (selectedLocked ? "Unlock Selected" : "Lock Selected") : "Lock Current Accuracy Filter"} onClick={toggleSelectedLocks} disabled={!selectedRows.length && accuracyFilter === "All"}><Icon name={selectedLocked ? "unlock" : "lock"} /></button>
          <button className="csv-button" title="Export CSV" onClick={exportCsv} disabled={!rows.length}>CSV</button>
          <button className={wrap ? "wrap-button active" : "wrap-button"} title="Wrap Text" onClick={() => setWrap((current) => !current)}>|↩|</button>
          <div className="select-menu compact-select">
            <button title="Copy" disabled={!selectedRows.length} onClick={(event) => {
              event.stopPropagation();
              setOpenMenu(openMenu === "copy" ? "" : "copy");
            }}><Icon name="copy" /></button>
            {openMenu === "copy" && (
              <div className="select-list">
                <button onClick={() => chooseCopy("bibliography")}>Bibliography</button>
                <button onClick={() => chooseCopy("authorTitle")}>Author - Title</button>
                <button onClick={() => chooseCopy("entry")}>Entry</button>
              </div>
            )}
          </div>
          <button title="Clean Up" onClick={cleanUnlockedEntries} disabled={!rows.length}><Icon name="wand" /></button>
          <button className="icon" title={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setIsDark(!isDark)}>
            {isDark ? "☀" : "☾"}
          </button>
          <button className="danger" onClick={clearUnlockedEntries} disabled={!rows.length}>Clear</button>
        </div>
        <input ref={projectInput} hidden type="file" accept=".json,.archive-studio.json" onChange={(event) => event.target.files?.[0] && openProject(event.target.files[0])} />
      </header>

      <section className={selected ? "workspace has-editor" : "workspace"}>
        <div className={wrap ? "table wrap" : "table"}>
          <div className="table-scroll">
            <div className="grid header" style={{ gridTemplateColumns, minWidth: tableWidth }}>
              {COLUMNS.map((column, index) => (
                <strong key={column} className={`${SORTABLE_COLUMNS.has(column) ? "sortable" : ""}${collapsedSet.has(index) ? " collapsed-column" : ""}`} onClick={(event) => {
                  if (!event.target.classList.contains("resize-handle")) sortBy(column);
                }}>
                  <button className="collapse-column" title={collapsedSet.has(index) ? `Show ${displayLabel(column)}` : `Collapse ${displayLabel(column)}`} onClick={(event) => toggleColumnCollapse(index, event)}>
                    {collapsedSet.has(index) ? ">" : "<"}
                  </button>
                  <span className="header-label">{collapsedSet.has(index) ? columnHint(column) : displayLabel(column)}</span>
                  {!collapsedSet.has(index) && sortConfig.column === column && (
                    <span className="sort-mark">
                      {column === "Accuracy" ? (sortConfig.direction === "asc" ? "Worst" : "Best") : sortConfig.direction === "asc" ? "A-Z" : "Z-A"}
                    </span>
                  )}
                  {!collapsedSet.has(index) && <span className="resize-handle" onMouseDown={(event) => beginResize(index, event)} />}
                </strong>
              ))}
            </div>
            <div className="rows">
              {visibleRows.length === 0 ? (
                <div className="empty">{rows.length ? "No entries match your search." : "Choose a folder to scan academic files."}</div>
              ) : (
                visibleRows.map(({ row, index }) => (
                  <button key={`${rowFileKey(row)}-${index}`} className={`${selectedIndexes.includes(index) ? "grid row selected" : "grid row"}${row.Locked ? " locked" : ""}`} style={{ gridTemplateColumns, minWidth: tableWidth }} onClick={(event) => selectRow(index, event)}>
                    {COLUMNS.map((column, columnIndex) => <span key={column} className={collapsedSet.has(columnIndex) ? "collapsed-cell" : ""}>{collapsedSet.has(columnIndex) ? "" : renderCellText(column, cellValue(row, column))}</span>)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {selected && (
          <aside className="editor">
            <h2>Selected Entry {selected.Locked ? "(Locked)" : ""}</h2>
            {EDITOR_FIELDS.map((column) => (
              column === "Bibliography" ? (
                <label key={column}>
                  <span>{displayLabel(column)}</span>
                  <textarea value={editorFieldValue(selected, column)} disabled={selected.Locked} onContextMenu={(event) => openFormatMenu(event, column)} onChange={(event) => updateSelected(column, event.target.value)} />
                </label>
              ) : (
                <label key={column}>
                  <span>{displayLabel(column)}</span>
                  {column === "Accuracy" ? (
                    <div className="select-menu">
                      <button disabled={selected.Locked} onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenu(openMenu === "accuracy" ? "" : "accuracy");
                      }}>{selected[column] || "Not Set"} <span>⌄</span></button>
                      {openMenu === "accuracy" && (
                        <div className="select-list">
                          {ACCURACY_OPTIONS.map((option) => (
                            <button key={option || "not-set"} className={(selected[column] || "") === option ? "selected-option" : ""} onClick={() => chooseAccuracy(option)}>
                              {option || "Not Set"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <input value={editorFieldValue(selected, column)} disabled={selected.Locked || column === "Filename"} onContextMenu={column === "Filename" ? undefined : (event) => openFormatMenu(event, column)} onChange={(event) => updateSelected(column, event.target.value)} />
                  )}
                </label>
              )
            ))}
            <label>
              <span>Notes</span>
              <textarea value={selected.Notes || ""} disabled={selected.Locked} onContextMenu={(event) => openFormatMenu(event, NOTE_FIELD)} onChange={(event) => updateSelected(NOTE_FIELD, event.target.value)} />
            </label>
            <div className="editor-actions">
              <button className="done-button" title="Quick Check Entry" disabled={selected.Locked || isFetching} onClick={quickCheckSelectedEntry}><Icon name="checkSearch" /></button>
              <button className="done-button" title="Done" onClick={closeSelectedEntry}><Icon name="done" /></button>
            </div>
          </aside>
        )}
      </section>
      {formatMenu && (
        <div className="format-menu" style={{ left: formatMenu.x, top: formatMenu.y }}>
          <button onClick={() => applyFormat("**")}>Bold</button>
          <button onClick={() => applyFormat("*")}>Italic</button>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
