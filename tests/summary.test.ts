import { afterEach, describe, expect, it, mock } from "bun:test";
import { createOpenAISummarizer, summarizeRecommendedPapers } from "../src/summary.js";
import type { SummaryConfig } from "../src/app-config.js";
import type { RecommendedPaper } from "../src/types.js";
import { stubFetch } from "./test-support.js";

const summaryConfig: SummaryConfig = {
  enabled: true,
  baseUrl: "https://example.test/v1",
  model: "Qwen/Qwen3-8B",
  apiKey: "llm-key",
  language: "Chinese",
  maxTokens: 2048
};

describe("createOpenAISummarizer", () => {
  afterEach(() => {
    mock.restore();
  });

  it("passes the configured generation model as the chat completion model parameter", async () => {
    const fetchMock = mock(async (_url: string, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A concise TLDR." } }]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });
    stubFetch(fetchMock);

    const summarize = createOpenAISummarizer(summaryConfig);

    await summarize({
      journal: "Nature",
      title: "Urban mobility",
      abstract: "A paper about urban mobility.",
      url: "https://example.test/paper",
      publishedAt: null,
      score: 0.9,
      matchContext: {
        bestMatchSource: "zotero",
        bestMatchTitle: "Transport equity",
        bestMatchTopics: ["transport"]
      }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer llm-key"
        }),
        body: expect.stringContaining('"model":"Qwen/Qwen3-8B"')
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(String(requestInit?.body)).toContain("You write accurate academic paper summaries");
    expect(String(requestInit?.body)).toContain("Use only claims supported");
    expect(String(requestInit?.body)).toContain("do not infer methods, results, contributions");
    expect(String(requestInit?.body)).toContain("180-240 Chinese characters");
    expect(String(requestInit?.body)).toContain("Chinese");
    expect(String(requestInit?.body)).toContain("Journal: Nature");
    expect(String(requestInit?.body)).toContain("URL: https://example.test/paper");
    expect(String(requestInit?.body)).toContain('"max_tokens":2048');
  });

  it("normalizes quoted and padded summary base URLs before calling the API", async () => {
    const fetchMock = mock(async (_url: string, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "A concise TLDR." } }]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });
    stubFetch(fetchMock);

    const summarize = createOpenAISummarizer({
      ...summaryConfig,
      baseUrl: ' "https://example.test/v1/" '
    });

    await summarize({
      journal: "Nature",
      title: "Urban mobility",
      abstract: "A paper about urban mobility.",
      url: "https://example.test/paper",
      publishedAt: null,
      score: 0.9,
      matchContext: null
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.any(Object)
    );
  });

  it("throws a clear error when the configured summary base URL is invalid", async () => {
    const summarize = createOpenAISummarizer({ ...summaryConfig, baseUrl: "" });

    await expect(
      summarize({
        journal: "Nature",
        title: "Urban mobility",
        abstract: "A paper about urban mobility.",
        url: "https://example.test/paper",
        publishedAt: null,
        score: 0.9,
        matchContext: null
      })
    ).rejects.toThrow("Missing summary base URL");
  });

  it("throws a clear error when the configured summary API key is missing", async () => {
    const summarize = createOpenAISummarizer({ ...summaryConfig, apiKey: "" });

    await expect(
      summarize({
        journal: "Nature",
        title: "Urban mobility",
        abstract: "A paper about urban mobility.",
        url: "https://example.test/paper",
        publishedAt: null,
        score: 0.9,
        matchContext: null
      })
    ).rejects.toThrow("Missing summary API key.");
  });

  it("adds TLDR summaries to ranked papers", async () => {
    const papers: RecommendedPaper[] = [
      {
        journal: "Nature",
        title: "Urban mobility",
        abstract: "A paper about urban mobility.",
        url: "https://example.test/paper",
        publishedAt: null,
        score: 0.9,
        matchContext: {
          bestMatchSource: "zotero",
          bestMatchTitle: "Transport equity",
          bestMatchTopics: ["transport"]
        }
      }
    ];

    const summarized = await summarizeRecommendedPapers(papers, async () => "A concise TLDR.");

    expect(summarized[0]!.tldr).toBe("A concise TLDR.");
  });

  it("leaves TLDR empty when summary generation fails and no abstract is available", async () => {
    const papers: RecommendedPaper[] = [
      {
        journal: "Nature",
        title: "Remote sensing change captioning meets large language and vision models",
        abstract: "",
        url: "https://example.test/paper",
        publishedAt: null,
        score: 0.9,
        matchContext: null
      }
    ];

    const summarized = await summarizeRecommendedPapers(papers, async () => {
      throw new Error("unavailable");
    });

    const first = summarized[0];
    expect(first).toBeDefined();
    expect(first?.tldr).toBe("");
  });

  it("rejects title-based generated summaries instead of sending them as TLDR", async () => {
    const fetchMock = mock(async (_url: string, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "该论文题为《Urban analytics》，核心关注点是题名中所指的研究对象。由于当前数据源未提供摘要，以下为基于标题的保守概括。"
              }
            }
          ]
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });
    stubFetch(fetchMock);

    const summarize = createOpenAISummarizer(summaryConfig);

    await expect(
      summarize({
        journal: "Cities",
        title: "Urban analytics: Definitions, disciplines, diversity and data",
        abstract: "",
        url: "https://example.test/paper",
        publishedAt: null,
        score: 0.9,
        matchContext: null
      })
    ).rejects.toThrow("unsupported title-based summary");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
