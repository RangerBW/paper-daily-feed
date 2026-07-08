import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestFeedPapers } from "../src/feed-ingestion.js";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("feed ingestion failures", () => {
  it("fails the run when every configured Feed Source fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));

    const result = ingestFeedPapers(
      [],
      {
        includeCatalog: false,
        catalogSelections: [],
        customRss: [{ name: "Broken feed", rss: "https://example.test/feed.xml" }]
      },
      7
    );
    const expectation = expect(result).rejects.toThrow("All 1 configured Feed Sources failed");
    await vi.runAllTimersAsync();
    await expectation;
  });
});
