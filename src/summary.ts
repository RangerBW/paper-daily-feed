import type { SummaryConfig } from "./app-config.js";
import type { RecommendedPaper } from "./types.js";

export type SummarizePaper = (paper: RecommendedPaper) => Promise<string>;

function fallbackSummary(paper: RecommendedPaper): string {
  if (paper.abstract.trim()) return paper.abstract;
  return `该论文题为《${paper.title}》，当前 RSS 或元数据源未提供摘要，因此暂时无法可靠判断其研究背景、方法、结果和贡献。建议打开原文页面进一步确认具体内容。`;
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
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: `You write accurate academic paper summaries. Follow these output requirements exactly: ${config.language}`
          },
          {
            role: "user",
            content: `Title: ${paper.title}\n\nAbstract: ${paper.abstract || "No abstract provided."}`
          }
        ],
        temperature: 0.2,
        ...(config.maxTokens ? { max_tokens: config.maxTokens } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`Generation API request failed (${response.status} ${response.statusText}).`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return payload.choices?.[0]?.message?.content?.trim() || paper.abstract;
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
        `[summary] generation failed for "${paper.title}"; using original abstract: ${
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
