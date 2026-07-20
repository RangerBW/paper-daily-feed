import { describe, expect, it, mock } from "bun:test";
import { fetchArxivMetadata, findArxivId } from "../src/arxiv.js";

describe("arXiv metadata", () => {
  it("finds arXiv IDs in DOI and URL text", () => {
    expect(findArxivId("https://doi.org/10.48550/arXiv.2603.21507")).toBe("2603.21507");
    expect(findArxivId("https://arxiv.org/abs/2603.21507v2")).toBe("2603.21507");
    expect(findArxivId("arXiv:cs/9901001v1")).toBe("cs/9901001");
  });

  it("normalizes arXiv Atom API metadata", async () => {
    const fetcher = mock(async () => {
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
          <entry>
            <id>http://arxiv.org/abs/2603.21507v1</id>
            <published>2026-03-27T12:00:00Z</published>
            <title>Delineating hierarchical activity space from high-resolution urban mobility flows</title>
            <summary>
              High-resolution mobility flows can reveal hierarchical urban activity spaces across scales.
            </summary>
            <author><name>Ada Lovelace</name></author>
            <arxiv:doi>10.48550/arXiv.2603.21507</arxiv:doi>
          </entry>
        </feed>`,
        { status: 200, headers: { "Content-Type": "application/atom+xml" } }
      );
    });

    const metadata = await fetchArxivMetadata("2603.21507v1", { fetcher });

    expect(fetcher).toHaveBeenCalled();
    expect(metadata).toEqual({
      id: "2603.21507",
      title: "Delineating hierarchical activity space from high-resolution urban mobility flows",
      abstract: "High-resolution mobility flows can reveal hierarchical urban activity spaces across scales.",
      authors: ["Ada Lovelace"],
      publishedAt: new Date("2026-03-27T12:00:00.000Z"),
      url: "https://arxiv.org/abs/2603.21507",
      doi: "10.48550/arXiv.2603.21507"
    });
  });
});
