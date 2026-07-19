import type { SummaryConfig } from "./app-config.js";
import type { RecommendedPaper } from "./types.js";

export type SummarizePaper = (paper: RecommendedPaper) => Promise<string>;

function fallbackSummary(paper: RecommendedPaper): string {
  if (paper.abstract.trim()) return paper.abstract;
  return `该论文题为《${paper.title}》。从题名来看，研究聚焦于相关领域的关键问题，可能围绕核心概念、方法体系或应用场景展开分析。由于当前 RSS 或元数据源未提供摘要，以下概括仅基于标题作谨慎推断：该研究可能梳理已有方法或提出新的分析框架，用于解释数据、模型或实际场景中的主要挑战，并总结其潜在结果与应用价值。其贡献在于为读者快速判断论文主题、方法取向和研究意义提供初步线索，具体实验设计、结论强度和创新点仍建议打开原文进一步确认。`;
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
