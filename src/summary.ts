import type { SummaryConfig } from "./app-config.js";
import type { RecommendedPaper } from "./types.js";

export type SummarizePaper = (paper: RecommendedPaper) => Promise<string>;

function fallbackSummary(paper: RecommendedPaper): string {
  return paper.abstract.trim();
}

function looksLikeUnsupportedSummary(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  return [
    "核心关注点是题名中所指的研究对象",
    "大概率围绕",
    "基于标题的保守概括",
    "由于当前数据源未提供摘要",
    "建议打开原文进一步确认",
    "无法生成可靠摘要",
    "不能生成可靠摘要",
    "may focus on key problems",
    "based on the title",
    "reliable summary cannot be generated"
  ].some((marker) => normalized.includes(marker.toLowerCase()));
}

function validateSummary(value: string | undefined): string {
  const summary = value?.trim() ?? "";
  if (!summary) {
    throw new Error("Generation API returned an empty summary.");
  }
  if (looksLikeUnsupportedSummary(summary)) {
    throw new Error("Generation API returned an unsupported title-based summary.");
  }
  return summary;
}

async function requestSummary(endpoint: string, apiKey: string, body: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body
      });

      if (!response.ok) {
        throw new Error(`Generation API request failed (${response.status} ${response.statusText}).`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return validateSummary(payload.choices?.[0]?.message?.content);
    } catch (error) {
      lastError = error;
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function createOpenAISummarizer(
  config: SummaryConfig,
  _env: Record<string, string | undefined> = process.env
): SummarizePaper {
  return async (paper: RecommendedPaper) => {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error("Missing summary API key.");
    }

    const endpoint = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    return requestSummary(
      endpoint,
      apiKey,
      JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: [
              "You write accurate academic paper summaries for a researcher screening new papers.",
              `Follow these output requirements exactly: ${config.language}`,
              "Use only claims supported by the supplied abstract or reliable source metadata.",
              "If no abstract or reliable source content is supplied, say that a reliable summary cannot be generated; do not infer methods, results, contributions, or conclusions from the title alone.",
              "Do not write generic placeholders such as 'related field', 'core concepts', 'may focus on key problems', or 'method system/application scenario'."
            ].join(" ")
          },
          {
            role: "user",
            content: [
              `Title: ${paper.title}`,
              `Journal: ${paper.journal}`,
              paper.doi ? `DOI: ${paper.doi}` : "",
              `URL: ${paper.url}`,
              paper.matchContext
                ? `Why it matched my interests: ${[
                    paper.matchContext.bestMatchTitle,
                    ...paper.matchContext.bestMatchTopics
                  ]
                    .filter(Boolean)
                    .join("; ")}`
                : "",
              `Abstract: ${
                paper.abstract ||
                "No abstract provided. Do not infer the paper's methods, results, contributions, or conclusions from the title alone."
              }`
            ]
              .filter(Boolean)
              .join("\n")
          }
        ],
        temperature: 0.2,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
      })
    );
  };
}

export async function summarizeRecommendedPapers(
  papers: RecommendedPaper[],
  summarizePaper: SummarizePaper
): Promise<RecommendedPaper[]> {
  const summarized: RecommendedPaper[] = [];

  for (const paper of papers) {
    let tldr: string;
    try {
      tldr = await summarizePaper(paper);
    } catch (error) {
      console.log(
        `[summary] generation failed for "${paper.title}"; using fallback summary: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      tldr = fallbackSummary(paper);
    }
    summarized.push({
      ...paper,
      tldr
    });
  }

  return summarized;
}
