import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../src/app-config.js";
import type { FeedPaper, InterestDocument, RecommendedPaper } from "../src/types.js";

const corpusMock = vi.hoisted(() => ({
  buildInterestCorpus: vi.fn()
}));
const feedMock = vi.hoisted(() => ({
  fetchRecentFeedPapers: vi.fn()
}));
const matchingMock = vi.hoisted(() => ({
  rankPapers: vi.fn(),
  resolveMatchingProvider: vi.fn(() => ({
    active: "api",
    model: "text-embedding-test",
    label: "API embeddings"
  }))
}));
const metadataEnrichmentMock = vi.hoisted(() => ({
  enrichFeedPaperMetadata: vi.fn()
}));
const metadataRepairMock = vi.hoisted(() => ({
  repairRecommendationMetadata: vi.fn()
}));
const emailMock = vi.hoisted(() => ({
  sendEmail: vi.fn()
}));
const historySessionMock = vi.hoisted(() => ({
  filterUndeliveredPapers: vi.fn(),
  confirmSuccessfulDelivery: vi.fn()
}));
const historyMock = vi.hoisted(() => ({
  openDeliveryHistory: vi.fn(() => historySessionMock)
}));

vi.mock("../src/interest-corpus.js", () => corpusMock);
vi.mock("../src/feed-ingestion.js", () => feedMock);
vi.mock("../src/matching.js", () => matchingMock);
vi.mock("../src/paper-metadata.js", () => ({
  ...metadataEnrichmentMock,
  ...metadataRepairMock
}));
vi.mock("../src/email.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/email.js")>();
  return {
    ...actual,
    sendEmail: emailMock.sendEmail
  };
});
vi.mock("../src/delivery-history.js", () => historyMock);

const { runDailyFeed } = await import("../src/daily-feed.js");

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    interests: {
      profile: {
        enabled: true,
        summary: "urban mobility",
        topics: [],
        methods: [],
        favoriteJournals: [],
        avoidTopics: [],
        referencePapers: []
      },
      zotero: {
        enabled: false,
        userId: "",
        apiKey: "",
        libraryType: "user",
        includeCollections: [],
        excludeCollections: []
      }
    },
    feeds: {
      catalogSelections: ["Nature"],
      customRss: []
    },
    matching: {
      provider: "api",
      api: {
        baseUrl: "https://example.test/v1",
        model: "text-embedding-test",
        apiKey: "embedding-key",
        batchSize: 2
      },
      local: {
        model: "local-embedding-test",
        batchSize: 2
      },
      paperLimit: 10,
      maxPaperAgeDays: 90,
      minScore: 0.35,
      clusterSimilarityThreshold: 0.7,
      avoidPenaltyWeight: 0.35
    },
    metadataRepair: {
      enabled: false,
      model: "onnx-community/bert-base-NER-ONNX",
      timeoutMs: 300000
    },
    metadataEnrichment: {
      enabled: true,
      crossref: {
        enabled: true,
        mailto: ""
      }
    },
    summary: {
      enabled: false,
      baseUrl: "https://example.test/v1",
      model: "summary-test",
      apiKey: "",
      language: "English",
      maxTokens: 1024
    },
    delivery: {
      mode: "smtp",
      from: "sender@example.test",
      to: "receiver@example.test",
      smtpHost: "smtp.example.test",
      smtpPort: 465,
      smtpPassword: "smtp-secret"
    },
    runtime: {
      debug: false,
      sendEmpty: false
    },
    ...overrides
  };
}

function paper(title: string): FeedPaper {
  return {
    journal: "Nature",
    title,
    abstract: "Abstract",
    url: `https://example.test/${title}`,
    publishedAt: new Date("2026-05-11T00:00:00Z")
  };
}

function recommended(title: string): RecommendedPaper {
  return {
    ...paper(title),
    score: 0.8,
    matchContext: null
  };
}

const interest: InterestDocument = {
  source: "profile",
  title: "Profile",
  text: "Urban mobility",
  topics: ["urban mobility"]
};

describe("runDailyFeed delivery history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historySessionMock.filterUndeliveredPapers.mockImplementation((papers: FeedPaper[]) => papers.slice(1));
    corpusMock.buildInterestCorpus.mockResolvedValue([interest]);
    feedMock.fetchRecentFeedPapers.mockResolvedValue([paper("Delivered"), paper("Fresh")]);
    metadataEnrichmentMock.enrichFeedPaperMetadata.mockImplementation(async (papers) =>
      papers.map((candidate: FeedPaper) => ({ ...candidate, abstract: `Enriched ${candidate.abstract}` }))
    );
    matchingMock.rankPapers.mockResolvedValue([recommended("Fresh")]);
    metadataRepairMock.repairRecommendationMetadata.mockImplementation(async (recommendations) => recommendations);
    emailMock.sendEmail.mockResolvedValue({ messageId: "message-id" });
  });

  it("filters delivered papers before ranking and saves history after successful delivery", async () => {
    const result = await runDailyFeed("run", {}, config());

    expect(historyMock.openDeliveryHistory).toHaveBeenCalledWith({ env: {} });
    expect(historySessionMock.filterUndeliveredPapers).toHaveBeenCalledWith([
      paper("Delivered"),
      paper("Fresh")
    ]);
    expect(metadataEnrichmentMock.enrichFeedPaperMetadata).toHaveBeenCalledWith(
      [paper("Fresh")],
      config().metadataEnrichment
    );
    expect(matchingMock.rankPapers).toHaveBeenCalledWith(
      config().matching,
      [{ ...paper("Fresh"), abstract: "Enriched Abstract" }],
      [interest],
      {}
    );
    expect(metadataRepairMock.repairRecommendationMetadata).toHaveBeenCalledWith(
      [recommended("Fresh")],
      config().metadataRepair
    );
    expect(emailMock.sendEmail).toHaveBeenCalledWith(
      config().delivery,
      expect.any(String),
      expect.stringMatching(/^Paper feed for \d{1,2}(?:st|nd|rd|th) [A-Z][a-z]+ \d{4}$/)
    );
    expect(historySessionMock.confirmSuccessfulDelivery).toHaveBeenCalledWith(
      [recommended("Fresh")],
      expect.any(Date)
    );
    expect(result.sent).toBe(true);
  });

  it("does not save history for preview or debug runs", async () => {
    await runDailyFeed("preview-email", {}, config());
    await runDailyFeed("run", {}, config({ runtime: { debug: true, sendEmpty: false } }));

    expect(historySessionMock.filterUndeliveredPapers).toHaveBeenCalledTimes(2);
    expect(historySessionMock.confirmSuccessfulDelivery).not.toHaveBeenCalled();
  });

  it("does not save history when delivery fails", async () => {
    emailMock.sendEmail.mockRejectedValue(new Error("smtp down"));

    await expect(runDailyFeed("run", {}, config())).rejects.toThrow("smtp down");

    expect(historySessionMock.confirmSuccessfulDelivery).not.toHaveBeenCalled();
  });

  it("reports possible delivery when Delivery History persistence fails after SMTP success", async () => {
    historySessionMock.confirmSuccessfulDelivery.mockImplementation(() => {
      throw new Error("Delivery may have succeeded, but Delivery History could not be saved: disk full");
    });

    await expect(runDailyFeed("run", {}, config())).rejects.toThrow(
      "Delivery may have succeeded, but Delivery History could not be saved"
    );

    expect(emailMock.sendEmail).toHaveBeenCalledOnce();
  });
});
