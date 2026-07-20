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
    expect(String(requestInit?.body)).toContain("specific technical terms in the title");
    expect(String(requestInit?.body)).toContain("Chinese");
    expect(String(requestInit?.body)).toContain("Journal: Nature");
    expect(String(requestInit?.body)).toContain("URL: https://example.test/paper");
    expect(String(requestInit?.body)).toContain('"max_tokens":2048');
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

  it("uses a title-specific Chinese fallback when summary generation fails and no abstract is available", async () => {
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
    expect(first?.tldr).toContain("遥感变化字幕生成");
    expect(first?.tldr).toContain("大语言模型");
    expect(first?.tldr).toContain("视觉模型");
  });
});
