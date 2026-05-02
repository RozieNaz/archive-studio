import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const COLUMNS = ["Title", "Author", "DOI", "ISBN", "Suggested Filename", "Bibliography", "Accuracy"];
const NOTE_FIELD = "Notes";
const EXPORT_COLUMNS = [...COLUMNS, NOTE_FIELD];
const SORTABLE_COLUMNS = new Set(["Title", "Author", "Accuracy"]);
const ACCURACY_RANK = { Zero: 0, Low: 1, Medium: 2, High: 3 };
const SUPPORTED_EXTENSIONS = new Set(["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "rtf", "txt"]);
const DEFAULT_WIDTHS = [170, 140, 130, 130, 205, 290, 105];
const MIN_WIDTHS = [70, 80, 60, 60, 140, 120, 85];
const ACCURACY_OPTIONS = ["", "High", "Medium", "Low", "Zero"];
const STORAGE_KEY = "archive-studio-project";
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "the", "to", "with"]);
const NUMBER_WORDS = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };

// ... (rest of the code remains unchanged)

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
    Accuracy: best.accuracy, // Preserve exact accuracy from chooseBest()
  };
}

// ... (rest of the code remains unchanged)

createRoot(document.getElementById("root")).render(<App />);
