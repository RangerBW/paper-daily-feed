import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPaperFingerprint,
  filterUndeliveredPapers,
  loadDeliveryHistory,
  recordDeliveredPapers,
  saveDeliveryHistory
} from "../src/delivery-history.js";
import type { FeedPaper } from "../src/types.js";

const tempDirs: string[] = [];

function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "paper-daily-feed-history-"));
  tempDirs.push(dir);
  return join(dir, ".delivery-history.json");
}

function paper(overrides: Partial<FeedPaper> = {}): FeedPaper {
  return {
    journal: "Nature",
    title: " Transit Accessibility and Equity ",
    abstract: "Public transit access.",
    url: " HTTPS://Example.test/Paper?utm_source=rss&id=42 ",
    publishedAt: new Date("2026-05-11T00:00:00.000Z"),
    ...overrides
  };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("delivery history", () => {
  it("creates stable fingerprints from normalized URL and title with an optional salt", () => {
    const first = createPaperFingerprint(paper(), {});
    const second = createPaperFingerprint(
      paper({
        title: "Transit   Accessibility and Equity",
        url: "https://example.test/Paper?id=42&utm_medium=email"
      }),
      {}
    );
    const salted = createPaperFingerprint(paper(), { DELIVERY_HISTORY_SALT: "private-salt" });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(salted).not.toBe(first);
  });

  it("loads missing or malformed history files as empty history", () => {
    const path = tempPath();

    expect(loadDeliveryHistory(path)).toEqual({ version: 1, delivered: [] });

    saveDeliveryHistory(path, { version: 1, delivered: [{ fingerprint: "abc", deliveredAt: "bad-date" }] });

    expect(loadDeliveryHistory(path)).toEqual({ version: 1, delivered: [] });
  });

  it("filters papers already present in delivery history", () => {
    const delivered = paper();
    const fresh = paper({ title: "Fresh paper", url: "https://example.test/fresh" });
    const history = recordDeliveredPapers({ version: 1, delivered: [] }, [delivered], new Date("2026-05-11T00:00:00Z"), {});

    expect(filterUndeliveredPapers([delivered, fresh], history, {})).toEqual([fresh]);
  });

  it("records final delivered papers once and prunes entries older than retention", () => {
    const recent = createPaperFingerprint(paper({ title: "Recent", url: "https://example.test/recent" }), {});
    const old = createPaperFingerprint(paper({ title: "Old", url: "https://example.test/old" }), {});
    const deliveredAt = new Date("2026-05-11T00:00:00Z");
    const updated = recordDeliveredPapers(
      {
        version: 1,
        delivered: [
          { fingerprint: recent, deliveredAt: "2026-05-10T00:00:00.000Z" },
          { fingerprint: old, deliveredAt: "2025-01-01T00:00:00.000Z" }
        ]
      },
      [paper({ title: "Recent", url: "https://example.test/recent" }), paper({ title: "New", url: "https://example.test/new" })],
      deliveredAt,
      {}
    );

    expect(updated.delivered).toHaveLength(2);
    expect(updated.delivered.map((entry) => entry.fingerprint)).toEqual([
      recent,
      createPaperFingerprint(paper({ title: "New", url: "https://example.test/new" }), {})
    ]);
    expect(updated.delivered.every((entry) => entry.deliveredAt !== "2025-01-01T00:00:00.000Z")).toBe(true);
  });
});
