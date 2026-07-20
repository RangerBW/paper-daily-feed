import { describe, expect, it, mock } from "bun:test";
import { fetchOpenAlexMetadataByTitle } from "../src/openalex.js";

describe("OpenAlex metadata", () => {
  it("searches works by title and reconstructs abstracts", async () => {
    const fetcher = mock(async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: "https://openalex.org/W123",
              title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
              doi: "https://doi.org/10.48550/arXiv.2603.21507",
              publication_date: "2026-03-27",
              abstract_inverted_index: {
                High: [0],
                resolution: [1],
                mobility: [2],
                reveals: [3],
                hierarchy: [4],
                ".": [5]
              },
              authorships: [{ author: { display_name: "Ada Lovelace" } }],
              primary_location: {
                landing_page_url: "https://arxiv.org/abs/2603.21507",
                source: { display_name: "arXiv" }
              }
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const metadata = await fetchOpenAlexMetadataByTitle(
      "Delineating hierarchical activity space from high-resolution urban mobility flows",
      { fetcher }
    );

    expect(fetcher).toHaveBeenCalled();
    expect(metadata[0]).toEqual({
      id: "https://openalex.org/W123",
      title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
      doi: "10.48550/arXiv.2603.21507",
      publishedAt: new Date("2026-03-27T00:00:00.000Z"),
      abstract: "High resolution mobility reveals hierarchy.",
      authors: ["Ada Lovelace"],
      url: "https://arxiv.org/abs/2603.21507",
      journal: "arXiv"
    });
  });
});
