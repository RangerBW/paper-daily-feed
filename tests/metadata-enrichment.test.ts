import { describe, expect, it, mock } from "bun:test";
import { enrichFeedPaperMetadata } from "../src/paper-metadata.js";
import type { FeedPaper } from "../src/types.js";

function paper(overrides: Partial<FeedPaper> = {}): FeedPaper {
  return {
    journal: "AAAG",
    title: "RSS title",
    abstract: "RSS abstract",
    url: "https://www.tandfonline.com/doi/full/10.1080/24694452.2025.2592754?af=R",
    publishedAt: null,
    ...overrides
  };
}

describe("metadata enrichment", () => {
  it("uses Crossref metadata to supplement and correct RSS paper fields", async () => {
    const fetchCrossref = mock(async () => ({
      doi: "10.1080/24694452.2025.2592754",
      title: "Crossref title",
      abstract: "Crossref abstract with enough detail to replace the RSS description.",
      authors: ["Ada Lovelace"],
      journal: "Annals of the American Association of Geographers",
      publishedAt: new Date("2026-04-21T00:00:00.000Z"),
      url: "https://doi.org/10.1080/24694452.2025.2592754"
    }));

    const enriched = await enrichFeedPaperMetadata(
      [paper()],
      { enabled: true, crossref: { enabled: true, mailto: "" } },
      { fetchCrossref }
    );

    expect(fetchCrossref).toHaveBeenCalledWith("10.1080/24694452.2025.2592754");
    expect(enriched).toEqual([
      {
        journal: "Annals of the American Association of Geographers",
        title: "Crossref title",
        abstract: "Crossref abstract with enough detail to replace the RSS description.",
        url: "https://www.tandfonline.com/doi/full/10.1080/24694452.2025.2592754?af=R",
        doi: "10.1080/24694452.2025.2592754",
        publishedAt: new Date("2026-04-21T00:00:00.000Z"),
        authors: ["Ada Lovelace"]
      }
    ]);
  });

  it("leaves RSS metadata unchanged when no DOI is available", async () => {
    const fetchCrossref = mock();

    const enriched = await enrichFeedPaperMetadata(
      [paper({ url: "https://example.test/no-doi" })],
      { enabled: true, crossref: { enabled: true, mailto: "" } },
      { fetchCrossref }
    );

    expect(fetchCrossref).not.toHaveBeenCalled();
    expect(enriched).toEqual([paper({ url: "https://example.test/no-doi" })]);
  });

  it("does not replace RSS abstracts with Crossref placeholder text", async () => {
    const fetchCrossref = mock(async () => ({
      doi: "10.1080/24694452.2025.2592754",
      abstract: "."
    }));

    const enriched = await enrichFeedPaperMetadata(
      [paper({ abstract: "RSS abstract with useful text." })],
      { enabled: true, crossref: { enabled: true, mailto: "" } },
      { fetchCrossref }
    );

    expect(enriched[0]?.abstract).toBe("RSS abstract with useful text.");
  });

  it("uses arXiv metadata when an arXiv DOI has no useful Crossref abstract", async () => {
    const fetchCrossref = mock(async () => ({
      doi: "10.48550/arXiv.2603.21507",
      title: "Delineating hierarchical activity space from high-resolution urban mobility flows"
    }));
    const fetchArxiv = mock(async () => ({
      id: "2603.21507",
      title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
      abstract:
        "High-resolution urban mobility flows reveal activity spaces that can be organized into nested spatial hierarchies.",
      authors: ["Ada Lovelace"],
      publishedAt: new Date("2026-03-27T00:00:00.000Z"),
      url: "https://arxiv.org/abs/2603.21507"
    }));

    const enriched = await enrichFeedPaperMetadata(
      [
        paper({
          title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
          abstract: "",
          url: "https://doi.org/10.48550/arXiv.2603.21507"
        })
      ],
      { enabled: true, crossref: { enabled: true, mailto: "" } },
      { fetchCrossref, fetchArxiv }
    );

    expect(fetchCrossref).toHaveBeenCalledWith("10.48550/arXiv.2603.21507");
    expect(fetchArxiv).toHaveBeenCalledWith("2603.21507");
    expect(enriched[0]?.abstract).toContain("nested spatial hierarchies");
    expect(enriched[0]?.authors).toEqual(["Ada Lovelace"]);
    expect(enriched[0]?.doi).toBe("10.48550/arXiv.2603.21507");
  });

  it("uses title lookup metadata when RSS has no DOI or abstract", async () => {
    const fetchCrossref = mock();
    const fetchArxivByTitle = mock(async () => []);
    const fetchOpenAlexByTitle = mock(async () => [
      {
        id: "https://openalex.org/W123",
        title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
        abstract:
          "High-resolution urban mobility flows are used to delineate hierarchical activity spaces across nested city scales.",
        authors: ["Ada Lovelace"],
        publishedAt: new Date("2026-03-27T00:00:00.000Z"),
        url: "https://arxiv.org/abs/2603.21507",
        doi: "10.48550/arXiv.2603.21507",
        journal: "arXiv"
      }
    ]);

    const enriched = await enrichFeedPaperMetadata(
      [
        paper({
          title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
          abstract: "",
          url: "https://example.test/paper"
        })
      ],
      { enabled: true, crossref: { enabled: true, mailto: "" } },
      { fetchCrossref, fetchArxivByTitle, fetchOpenAlexByTitle }
    );

    expect(fetchCrossref).not.toHaveBeenCalled();
    expect(fetchArxivByTitle).toHaveBeenCalledWith(
      "Delineating hierarchical activity space from high-resolution urban mobility flows"
    );
    expect(fetchOpenAlexByTitle).toHaveBeenCalledWith(
      "Delineating hierarchical activity space from high-resolution urban mobility flows"
    );
    expect(enriched[0]?.abstract).toContain("hierarchical activity spaces");
    expect(enriched[0]?.doi).toBe("10.48550/arXiv.2603.21507");
  });
});
