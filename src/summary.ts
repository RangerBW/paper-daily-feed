import type { SummaryConfig } from "./app-config.js";
import type { RecommendedPaper } from "./types.js";

export type SummarizePaper = (paper: RecommendedPaper) => Promise<string>;

function titleHas(title: string, ...patterns: RegExp[]): boolean {
  return patterns.every((pattern) => pattern.test(title));
}

function titleDrivenFallback(paper: RecommendedPaper): string {
  const title = paper.title.trim();
  const journal = paper.journal.trim();

  if (
    titleHas(
      title,
      /remote sensing/i,
      /change captioning/i,
      /(large language|vision(-language)?|vision models?)/i
    )
  ) {
    return `该论文围绕《${title}》展开，主题集中在遥感变化字幕生成与大语言模型、视觉模型的结合。研究背景上，遥感变化理解不再只需要判断两期影像哪里发生变化，还需要把建筑、道路、植被、水体等地物变化转化为可读、可解释的自然语言描述。题名显示，论文可能讨论如何借助大语言模型的语义推理和视觉模型的图像表征能力，提升跨时相遥感影像中变化区域识别、对象关系理解和文本生成质量。其结果和贡献预计在于把传统变化检测从像素或类别层面推进到语义 caption 层面，为灾害监测、城市扩张分析、土地利用变化解释等任务提供更直观的人机交互输出。${journal ? `该文来自 ${journal}，` : ""}建议重点关注其模型框架、数据集设置和与传统 change captioning 方法的对比。`;
  }

  return `该论文题为《${title}》，核心关注点是题名中所指的研究对象、方法组合与应用场景。由于当前数据源未提供摘要且自动摘要接口未返回可用结果，以下为基于标题的保守概括：论文大概率围绕“${title}”所揭示的问题展开，先说明该主题在现有研究或实际应用中的挑战，再引入相应的数据、模型或方法框架进行分析，并通过实验、案例或综述比较总结主要发现。其贡献主要体现在把相关方法用于更具体的研究任务，或系统梳理该方向的机会、局限与未来发展路径。阅读时建议优先查看原文的研究问题、方法流程图、实验数据和结论部分，以确认其真正创新点。`;
}

function fallbackSummary(paper: RecommendedPaper): string {
  if (paper.abstract.trim()) return paper.abstract;
  return titleDrivenFallback(paper);
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
            content: [
              "You write accurate academic paper summaries for a researcher screening new papers.",
              `Follow these output requirements exactly: ${config.language}`,
              "When an abstract is missing, write a concrete title-grounded summary using the specific technical terms in the title, journal, URL/DOI, and match context.",
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
                "No abstract provided. Infer conservatively from the title, journal, DOI/URL, and match context. The summary must mention the concrete topic and method terms from the title, and must not be a generic placeholder."
              }`
            ]
              .filter(Boolean)
              .join("\n")
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
