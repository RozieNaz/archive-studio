import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const COLUMNS = ["Title", "Author", "DOI", "ISBN", "Suggested Filename", "Bibliography", "Accuracy"];
const NOTE_FIELD = "Notes";
const EXPORT_COLUMNS = [...COLUMNS, NOTE_FIELD];
const COLUMN_LABELS = { DOI: "DOI", ISBN: "ISBN" };
const SORTABLE_COLUMNS = new Set(["Title", "Author", "Accuracy"]);
const ACCURACY_RANK = { Zero: 0, Low: 1, Medium: 2, High: 3 };
const SUPPORTED_EXTENSIONS = new Set(["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "rtf", "txt"]);
const DEFAULT_WIDTHS = [170, 140, 130, 130, 205, 290, 105];
const MIN_WIDTHS = [70, 80, 60, 60, 140, 120, 85];
const COLLAPSED_WIDTH = 34;
const ACCURACY_OPTIONS = ["", "High", "Medium", "Low", "Zero"];
const STORAGE_KEY = "archive-studio-project";
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "the", "to", "with"]);
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
      if (index > 0 && index < words.length - 1 && SMALL_WORDS.has(word)) return word;
      return word.slice(0, 1).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function makeRow(file) {
  const filename = cleanFilename(file.name);
  return {
    Filename: filename,
    Title: "",
    Author: "",
    DOI: "",
    ISBN: "",
    "Suggested Filename": filename,
    Bibliography: "",
    Accuracy: "",
    Notes: "",
    Locked: false,
  };
}

function normaliseSavedRows(savedRows) {
  return savedRows.map((row) => ({
    ...row,
    Accuracy: row.Accuracy || row.Confidence || "",
    Bibliography: normaliseBibliographyLabels(row.Bibliography),
    Notes: row.Notes || "",
    Locked: Boolean(row.Locked),
    Confidence: undefined,
  }));
}

function normaliseBibliographyLabels(value) {
  return String(value || "")
    .replace(/\bDoi:/g, "DOI:")
    .replace(/\bIsbn:/g, "ISBN:");
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
  return [headers.join(","), ...rows.map((row) => EXPORT_COLUMNS.map((column) => escape(row[column])).join(","))].join("\n");
}

function rowToText(row) {
  return EXPORT_COLUMNS.map((column) => `${displayLabel(column)}: ${row[column] || ""}`).join("\n");
}

function displayLabel(column) {
  return COLUMN_LABELS[column] || column;
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

function makeSuggestedFilename(item) {
  const author = (item.author || "").split(",")[0].trim();
  const title = (item.title || "").split(":")[0].trim();
  const year = item.year || "";
  if (author && title && year) return titleCase(`${author} - ${title} (${year})`);
  if (author && title) return titleCase(`${author} - ${title}`);
  if (title && year) return titleCase(`${title} (${year})`);
  return titleCase(title);
}

function makeBibliography(item) {
  const parts = [];
  if (item.author) parts.push(`${item.author}.`);
  if (item.title) parts.push(`${item.title}.`);
  if (item.publication) parts.push(`${item.publication}.`);
  if (item.publisher) parts.push(`${item.publisher}.`);
  if (item.year) parts.push(`${item.year}.`);
  if (item.doi) parts.push(`DOI: ${item.doi}.`);
  else if (item.isbn) parts.push(`ISBN: ${item.isbn}.`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
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

async function searchCrossref(query) {
  const data = await fetchJson(`https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=5`);
  return (data?.message?.items || []).map((item) => ({
    source: "Crossref",
    title: (item.title || [""])[0] || "",
    author: (item.author || []).slice(0, 3).map((a) => a.name || [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean).join(", "),
    year: item.issued?.["date-parts"]?.[0]?.[0] || "",
    publisher: item.publisher || "",
    publication: (item["container-title"] || [""])[0] || "",
    doi: item.DOI || "",
    isbn: (item.ISBN || []).join(", "),
  }));
}

function chooseBest(filename, query, candidates) {
  const fileVolume = extractVolume(filename);
  const scored = candidates
    .filter((item) => item.title)
    .map((item) => {
      let score = tokenOverlap(query || filename, item.title) * 60;
      const candidateVolume = extractVolume(item.title);
      if (item.author && tokenOverlap(filename, item.author) > 0) score += 15;
      if (item.isbn) score += 8;
      if (item.doi) score += 5;
      if (item.year && filename.includes(String(item.year))) score += 8;
      if (fileVolume && candidateVolume && fileVolume === candidateVolume) score += 18;
      if (fileVolume && candidateVolume && fileVolume !== candidateVolume) score -= 45;
      const accuracy = score >= 55 ? "High" : score >= 32 ? "Medium" : score >= 12 ? "Low" : "Zero";
      return { ...item, score, accuracy };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] || null;
}

async function fetchMetadataForRow(row) {
  const query = cleanSearchQuery(row.Filename || row["Suggested Filename"]);
  const candidates = [];
  for (const search of [query, query.replace(/\b(review of|review|book review)\b/gi, "").trim()].filter(Boolean)) {
    try {
      candidates.push(...(await searchGoogleBooks(search)));
      candidates.push(...(await searchOpenLibrary(search)));
      candidates.push(...(await searchCrossref(search)));
    } catch {
      // Keep fetching other rows if one public source blocks or times out.
    }
  }
  const best = chooseBest(row.Filename || "", query, candidates);
  if (!best) return { ...row, Accuracy: "Zero" };
  const fileVolume = extractVolume(row.Filename || row["Suggested Filename"]);
  const bestVolume = extractVolume(best.title);
  let title = best.title;
  if (fileVolume && bestVolume && fileVolume !== bestVolume) {
    title = row.Filename || best.title;
  } else if (fileVolume && !bestVolume) {
    title = `${best.title}, ${volumeLabel(row.Filename || row["Suggested Filename"])}`;
  }
  const output = { ...best, title };
  const bibliography = makeBibliography(output);
  return {
    ...row,
    Title: titleCase(output.title),
    Author: titleCase(best.author),
    DOI: best.doi,
    ISBN: best.isbn,
    "Suggested Filename": makeSuggestedFilename(output),
    Bibliography: bibliography,
    Accuracy: best.accuracy === "Zero" ? "Low" : best.accuracy,
  };
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
  const [collapsedColumns, setCollapsedColumns] = useState([]);
  const folderInput = useRef(null);
  const projectInput = useRef(null);
  const stopFetch = useRef(false);

  const collapsedSet = useMemo(() => new Set(collapsedColumns), [collapsedColumns]);
  const activeWidths = colWidths.map((width, index) => collapsedSet.has(index) ? COLLAPSED_WIDTH : width);
  const gridTemplateColumns = activeWidths.map((width) => `${width}px`).join(" ");
  const tableWidth = activeWidths.reduce((sum, width) => sum + width, 0);
  const selectedRows = selectedIndexes.map((index) => rows[index]).filter(Boolean);
  const selected = selectedIndexes.length === 1 ? selectedRows[0] : null;
  const selectedLocked = selectedRows.length > 0 && selectedRows.every((row) => row.Locked);
  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows.map((row, index) => ({ row, index }));
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) =>
        [...EXPORT_COLUMNS, "Filename"].some((column) => String(row[column] || "").toLowerCase().includes(query))
      );
  }, [rows, searchQuery]);
  const counts = useMemo(() => {
    const total = rows.length;
    const done = rows.filter((row) => row.Accuracy).length;
    return { total, done };
  }, [rows]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows }));
  }, [rows]);

  useEffect(() => {
    const closeMenu = () => setFormatMenu(null);
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

  function scanFiles(files) {
    const existing = new Set(rows.map((row) => row.Filename));
    const next = [...rows];
    let added = 0;

    Array.from(files)
      .filter((file) => SUPPORTED_EXTENSIONS.has((file.name.split(".").pop() || "").toLowerCase()))
      .forEach((file) => {
        const row = makeRow(file);
        if (!existing.has(row.Filename)) {
          next.push(row);
          existing.add(row.Filename);
          added += 1;
        }
      });

    setRows(next);
    setStatus(`Scan complete. Added ${added} new files. Total: ${next.length}.`);
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
            : String(left[column] || "").localeCompare(String(right[column] || ""), undefined, { sensitivity: "base" });
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
    const queue = rows.map((row) => ({ ...row }));
    for (let index = 0; index < queue.length; index += 1) {
      if (stopFetch.current) {
        setStatus("Metadata fetch stopped.");
        break;
      }
      if (queue[index].Title && queue[index].Accuracy) continue;
      setStatus(`Fetching metadata ${index + 1}/${queue.length}`);
      const fetched = await fetchMetadataForRow(queue[index]);
      if (stopFetch.current) {
        setStatus("Metadata fetch stopped.");
        break;
      }
      setRows((current) =>
        current.map((row) => (row.Filename === fetched.Filename ? fetched : row))
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

  function updateSelected(field, value) {
    if (selectedIndexes.length !== 1) return;
    const selectedIndex = selectedIndexes[0];
    if (rows[selectedIndex]?.Locked) return;
    setRows((current) =>
      current.map((row, index) =>
        index === selectedIndex
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
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
        if (kind === "filename") return row["Suggested Filename"] || "";
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

  function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows }));
    setStatus("Project saved on this device.");
  }

  function deleteSelectedEntries() {
    if (!selectedIndexes.length) return;
    stopFetch.current = true;
    const remove = new Set(selectedIndexes);
    const lockedCount = selectedRows.filter((row) => row.Locked).length;
    setRows((current) => current.filter((row, index) => row.Locked || !remove.has(index)));
    setSelectedIndexes([]);
    const deletedCount = selectedIndexes.length - lockedCount;
    setStatus(`Deleted ${deletedCount} entr${deletedCount === 1 ? "y" : "ies"}.`);
  }

  function toggleSelectedLocks() {
    if (!selectedIndexes.length) return;
    const selectedSet = new Set(selectedIndexes);
    const nextLocked = !selectedLocked;
    setRows((current) =>
      current.map((row, index) => (selectedSet.has(index) ? { ...row, Locked: nextLocked } : row))
    );
    setStatus(`${nextLocked ? "Locked" : "Unlocked"} ${selectedIndexes.length} entr${selectedIndexes.length === 1 ? "y" : "ies"}.`);
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

  useEffect(() => {
    const onKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
      if (event.key === "Delete" && selectedIndexes.length) {
        event.preventDefault();
        deleteSelectedEntries();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndexes, rows]);

  return (
    <main className={isDark ? "app dark" : "app"}>
      <header className="topbar">
        <div className="brand">
          <h1>Archive Studio</h1>
          <p>{counts.total ? `${counts.done}/${counts.total} entries have metadata - ${status}` : status}</p>
        </div>
        <div className="actions">
          <button onClick={() => folderInput.current?.click()}>Open</button>
          <button onClick={fetchMetadata} disabled={!rows.length || isFetching}>{isFetching ? "Fetching" : "Fetch"}</button>
          <button onClick={stopCurrentJob} disabled={!isFetching}>Stop</button>
          <button onClick={saveProject} disabled={!rows.length}>Save</button>
          <button onClick={toggleSelectedLocks} disabled={!selectedRows.length}>{selectedLocked ? "Unlock" : "Lock"}</button>
          <button onClick={deleteSelectedEntries} disabled={!selectedRows.length}>Delete</button>
          <button onClick={exportCsv} disabled={!rows.length}>CSV</button>
          <label className="check compact-check" title="Wrap Text"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} /> W</label>
          <input className="search-input" value={searchQuery} placeholder="Search" onChange={(event) => setSearchQuery(event.target.value)} />
          <select className="copy-select" disabled={!selectedRows.length} defaultValue="" onChange={(event) => {
            copySelection(event.target.value);
            event.target.value = "";
          }}>
            <option value="">Copy</option>
            <option value="bibliography">Bibliography</option>
            <option value="filename">Filename</option>
            <option value="entry">Entry</option>
          </select>
          <button className="icon" title={isDark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setIsDark(!isDark)}>
            {isDark ? "Light" : "Dark"}
          </button>
          <button className="danger" onClick={clearUnlockedEntries} disabled={!rows.length}>Clear</button>
        </div>
        <input ref={folderInput} hidden type="file" webkitdirectory="true" multiple onChange={(event) => scanFiles(event.target.files)} />
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
                  <button key={`${row.Filename}-${index}`} className={`${selectedIndexes.includes(index) ? "grid row selected" : "grid row"}${row.Locked ? " locked" : ""}`} style={{ gridTemplateColumns, minWidth: tableWidth }} onClick={(event) => selectRow(index, event)}>
                    {COLUMNS.map((column, columnIndex) => <span key={column} className={collapsedSet.has(columnIndex) ? "collapsed-cell" : ""}>{collapsedSet.has(columnIndex) ? "" : renderCellText(column, row[column])}</span>)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {selected && (
          <aside className="editor">
            <h2>Selected Entry {selected.Locked ? "(Locked)" : ""}</h2>
            {COLUMNS.map((column) => (
              column === "Bibliography" ? (
                <label key={column}>
                  <span>{displayLabel(column)}</span>
                  <textarea value={selected[column] || ""} disabled={selected.Locked} onContextMenu={(event) => openFormatMenu(event, column)} onChange={(event) => updateSelected(column, event.target.value)} />
                </label>
              ) : (
                <label key={column}>
                  <span>{displayLabel(column)}</span>
                  {column === "Accuracy" ? (
                    <select value={selected[column] || ""} disabled={selected.Locked} onChange={(event) => updateSelected(column, event.target.value)}>
                      {ACCURACY_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option || "Not Set"}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={selected[column] || ""} disabled={selected.Locked} onContextMenu={(event) => openFormatMenu(event, column)} onChange={(event) => updateSelected(column, event.target.value)} />
                  )}
                </label>
              )
            ))}
            <label>
              <span>Notes</span>
              <textarea value={selected.Notes || ""} disabled={selected.Locked} onContextMenu={(event) => openFormatMenu(event, NOTE_FIELD)} onChange={(event) => updateSelected(NOTE_FIELD, event.target.value)} />
            </label>
            <button className="done-button" onClick={closeSelectedEntry}>Done</button>
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
