import type { SummaryConfig } from "./app-config.js";
import { hasMeaningfulAbstract } from "./text.js";
import type { RecommendedPaper } from "./types.js";

export type SummarizePaper = (paper: RecommendedPaper) => Promise<string>;

const NO_SUMMARY = "NO_SUMMARY_AVAILABLE";
const UNSUPPORTED_SUMMARY_MARKERS = [
  "核心关注点是题名中所指的研究对象",
  "大概率围绕",
  "基于标题的保守概括",
  "由于当前数据源未提供摘要",
  "未提供摘要正文",
  "请提供论文摘要",
  "建议打开原文进一步确认",
  "may focus on key problems",
  "based on the title",
  "reliable summary cannot be generated"
];

function looksLikeUnsupportedSummary(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim().toLowerCase();
  return (
    normalized.includes(NO_SUMMARY.toLowerCase()) ||
    /(?:无法|不能|不足以)\s*(?:生成|提供|撰写|支持)[^，。；]{0,20}摘要/u.test(normalized) ||
    UNSUPPORTED_SUMMARY_MARKERS.some((marker) => normalized.includes(marker))
  );
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

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function summaryEndpoint(baseUrl: string): string {
  const normalized = unquote(baseUrl);
  if (!normalized) {
    throw new Error("Missing summary base URL. Set OPENAI_BASE_URL to an absolute URL, for example https://api.openai.com/v1.");
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(
      "Invalid summary base URL. Set OPENAI_BASE_URL to an absolute URL, for example https://api.openai.com/v1."
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid summary base URL. OPENAI_BASE_URL must start with http:// or https://.");
  }

  const basePath = parsed.pathname.replace(/\/+$/, "");
  return new URL("chat/completions", `${parsed.origin}${basePath}/`).toString();
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
    if (!hasMeaningfulAbstract(paper.abstract)) return "";

    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error("Missing summary API key.");
    }

    const endpoint = summaryEndpoint(config.baseUrl);
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
              "Use only claims supported by the supplied abstract. Use the title, journal, and DOI only to identify the article.",
              `If the supplied abstract contains only bibliographic information or does not support a summary, reply with exactly ${NO_SUMMARY}. Never write an explanation or request more information. In all cases, do not infer methods, results, contributions, or conclusions from the title alone.`,
              "When the requested language is Chinese, write one concise paragraph of about 180-240 Chinese characters covering the background, method, key results, and contribution, but include only details supported by the supplied source.",
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
              `Abstract: ${paper.abstract}`
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
    let tldr = "";
    if (hasMeaningfulAbstract(paper.abstract)) {
      try {
        tldr = await summarizePaper(paper);
      } catch (error) {
        console.log(
          `[summary] generation failed for "${paper.title}"; showing the original abstract excerpt: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    } else {
      console.log(`[summary] skipped "${paper.title}"; no usable abstract.`);
    }
    summarized.push({
      ...paper,
      tldr
    });
  }

  return summarized;
}
