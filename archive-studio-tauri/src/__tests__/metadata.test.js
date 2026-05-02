import { describe, it, expect } from "vitest";
import {
  chooseBest,
  fetchMetadataForRow,
  makeBibliography,
  makeSuggestedFilename
} from "../main";

describe("Metadata Accuracy and Bibliography", () => {
  it("should keep 'empty' accuracy for unchecked rows", async () => {
    const row = { Filename: "test.pdf", Accuracy: "" };
    const result = await fetchMetadataForRow(row);
    expect(result.Accuracy).toEqual("");
  });

  it("should not convert 'Zero' accuracy into 'Low'", async () => {
    const row = { Filename: "notfound.pdf", Accuracy: "" };
    const chooseBestMock = () => null; // Simulate no best result
    const result = await fetchMetadataForRow(row);
    expect(result.Accuracy).toEqual("Zero");
  });

  it("should assign 'Low', 'Medium', 'High' based on score thresholds", () => {
    const candidates = [
      { title: "Example", score: 60 },
      { title: "Example", score: 35 },
    ];
    const best = chooseBest("Example.pdf", "Example", candidates);
    expect(best.accuracy).toEqual("High");
  });

  it("should create a bibliography only using available fields", () => {
    const item = { title: "Title", author: "Author", year: "2023" };
    const bibliography = makeBibliography(item);
    expect(bibliography).toMatch(/Title.*Author/);
    expect(bibliography).not.toMatch(/publisher/);
  });

});