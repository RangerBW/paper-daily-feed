import type { MetadataEnrichmentConfig, MetadataRepairConfig } from "./app-config.js";
import { fetchArxivMetadata, fetchArxivMetadataByTitle, findArxivId, type ArxivMetadata } from "./arxiv.js";
import { fetchCrossrefWork, findDoi, type CrossrefMetadata } from "./crossref.js";
import { fetchOpenAlexMetadataByTitle, type OpenAlexMetadata } from "./openalex.js";
import type { FeedPaper, RecommendedPaper } from "./types.js";

type EnrichmentDependencies = {
  fetchCrossref?: (doi: string) => Promise<CrossrefMetadata | null>;
  fetchArxiv?: (id: string) => Promise<ArxivMetadata | null>;
  fetchArxivByTitle?: (title: string) => Promise<ArxivMetadata[]>;
  fetchOpenAlexByTitle?: (title: string) => Promise<OpenAlexMetadata[]>;
};

type NerEntity = {
  entity?: string;
  entity_group?: string;
  word?: string;
};

type NerPipeline = (text: string) => Promise<NerEntity[]>;
type LoadNerPipeline = (model: string) => Promise<NerPipeline>;

const ORG_WORDS =
  /\b(?:University|Department|School|Institute|Laboratory|Centre|Center|Research|College|Faculty|Business)\b/i;

function paperDoi(paper: FeedPaper): string | undefined {
  return paper.doi ?? findDoi([paper.url, paper.metadataText, paper.title].filter(Boolean).join(" "));
}

function paperArxivId(paper: FeedPaper): string | undefined {
  return findArxivId([paper.url, paper.doi, paper.metadataText, paper.title].filter(Boolean).join(" "));
}

function meaningfulAbstract(value: string | undefined): value is string {
  return Boolean(value && /[A-Za-z0-9]/.test(value) && value.replace(/\W/g, "").length >= 20);
}

function normalizedTitle(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleMatches(left: string, right: string | undefined): boolean {
  const normalizedLeft = normalizedTitle(left);
  const normalizedRight = normalizedTitle(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft))
  );
}

function mergeCrossrefMetadata(paper: FeedPaper, metadata: CrossrefMetadata): FeedPaper {
  return {
    ...paper,
    doi: metadata.doi,
    title: metadata.title ?? paper.title,
    journal: metadata.journal ?? paper.journal,
    abstract: meaningfulAbstract(metadata.abstract) ? metadata.abstract : paper.abstract,
    publishedAt: metadata.publishedAt ?? paper.publishedAt,
    ...(metadata.authors?.length ? { authors: metadata.authors } : {})
  };
}

function mergeArxivMetadata(paper: FeedPaper, metadata: ArxivMetadata): FeedPaper {
  return {
    ...paper,
    doi: paper.doi ?? metadata.doi ?? `10.48550/arXiv.${metadata.id}`,
    title: metadata.title ?? paper.title,
    abstract: meaningfulAbstract(metadata.abstract) ? metadata.abstract : paper.abstract,
    publishedAt: metadata.publishedAt ?? paper.publishedAt,
    url: paper.url || metadata.url || `https://arxiv.org/abs/${metadata.id}`,
    ...(metadata.authors?.length ? { authors: metadata.authors } : {})
  };
}

function mergeOpenAlexMetadata(paper: FeedPaper, metadata: OpenAlexMetadata): FeedPaper {
  return {
    ...paper,
    doi: paper.doi ?? metadata.doi,
    title: metadata.title ?? paper.title,
    journal: metadata.journal ?? paper.journal,
    abstract: meaningfulAbstract(metadata.abstract) ? metadata.abstract : paper.abstract,
    publishedAt: metadata.publishedAt ?? paper.publishedAt,
    url: paper.url || metadata.url || paper.url,
    ...(metadata.authors?.length ? { authors: metadata.authors } : {})
  };
}

function bestTitleMatch<T extends { title?: string; abstract?: string }>(paper: FeedPaper, candidates: T[]): T | undefined {
  return candidates.find((candidate) => titleMatches(paper.title, candidate.title) && meaningfulAbstract(candidate.abstract));
}

/** Applies inexpensive metadata precedence before matching. */
export async function enrichFeedPaperMetadata(
  papers: FeedPaper[],
  config: MetadataEnrichmentConfig,
  dependencies: EnrichmentDependencies = {}
): Promise<FeedPaper[]> {
  if (!config.enabled || !config.crossref.enabled || papers.length === 0) return papers;

  const fetchCrossref =
    dependencies.fetchCrossref ?? ((doi: string) => fetchCrossrefWork(doi, { mailto: config.crossref.mailto }));
  const fetchArxiv = dependencies.fetchArxiv ?? ((id: string) => fetchArxivMetadata(id));
  const fetchArxivByTitle = dependencies.fetchArxivByTitle ?? ((title: string) => fetchArxivMetadataByTitle(title));
  const fetchOpenAlexByTitle =
    dependencies.fetchOpenAlexByTitle ?? ((title: string) => fetchOpenAlexMetadataByTitle(title));
  const enriched: FeedPaper[] = [];
  let repaired = 0;
  let arxivRepaired = 0;
  let openAlexRepaired = 0;
  for (const paper of papers) {
    let nextPaper = paper;
    const doi = paperDoi(paper);
    if (doi) {
      try {
        const metadata = await fetchCrossref(doi);
        if (metadata) {
          nextPaper = mergeCrossrefMetadata(nextPaper, metadata);
          repaired += 1;
        }
      } catch (error) {
        console.log(`[paper-metadata] Crossref skipped for ${doi}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!meaningfulAbstract(nextPaper.abstract)) {
      const arxivId = paperArxivId(nextPaper);
      if (arxivId) {
        try {
          const metadata = await fetchArxiv(arxivId);
          if (metadata) {
            const enrichedPaper = mergeArxivMetadata(nextPaper, metadata);
            if (meaningfulAbstract(enrichedPaper.abstract) && enrichedPaper.abstract !== nextPaper.abstract) {
              arxivRepaired += 1;
            }
            nextPaper = enrichedPaper;
          }
        } catch (error) {
          console.log(
            `[paper-metadata] arXiv skipped for ${arxivId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    if (!meaningfulAbstract(nextPaper.abstract)) {
      try {
        const metadata = bestTitleMatch(nextPaper, await fetchArxivByTitle(nextPaper.title));
        if (metadata) {
          const enrichedPaper = mergeArxivMetadata(nextPaper, metadata);
          if (meaningfulAbstract(enrichedPaper.abstract) && enrichedPaper.abstract !== nextPaper.abstract) {
            arxivRepaired += 1;
          }
          nextPaper = enrichedPaper;
        }
      } catch (error) {
        console.log(
          `[paper-metadata] arXiv title lookup skipped for "${nextPaper.title}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (!meaningfulAbstract(nextPaper.abstract)) {
      try {
        const metadata = bestTitleMatch(nextPaper, await fetchOpenAlexByTitle(nextPaper.title));
        if (metadata) {
          const enrichedPaper = mergeOpenAlexMetadata(nextPaper, metadata);
          if (meaningfulAbstract(enrichedPaper.abstract) && enrichedPaper.abstract !== nextPaper.abstract) {
            openAlexRepaired += 1;
          }
          nextPaper = enrichedPaper;
        }
      } catch (error) {
        console.log(
          `[paper-metadata] OpenAlex title lookup skipped for "${nextPaper.title}": ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    enriched.push(nextPaper);
  }
  console.log(`[paper-metadata] Crossref enriched ${repaired}/${papers.length} papers`);
  if (arxivRepaired > 0) {
    console.log(`[paper-metadata] arXiv enriched abstracts for ${arxivRepaired}/${papers.length} papers`);
  }
  if (openAlexRepaired > 0) {
    console.log(`[paper-metadata] OpenAlex enriched abstracts for ${openAlexRepaired}/${papers.length} papers`);
  }
  return enriched;
}

function compact(value: string): string {
  return value.replace(/^##/, "").replace(/\s+/g, " ").trim();
}

function entityKind(entity: NerEntity): string {
  return (entity.entity_group ?? entity.entity ?? "").replace(/^[BI]-/, "").toUpperCase();
}

function groups(entities: NerEntity[], kind: "PER" | "ORG"): string[] {
  const values: string[] = [];
  let current = "";
  for (const entity of entities) {
    if (entityKind(entity) !== kind || !entity.word) {
      if (current) values.push(current);
      current = "";
      continue;
    }
    const word = compact(entity.word);
    if (!word) continue;
    const startsGroup = entity.entity?.startsWith("B-") || Boolean(entity.entity_group && !entity.entity);
    if (startsGroup && current) {
      values.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) values.push(current);
  return values.map(compact).filter(Boolean);
}

function shouldUseAuthors(authors: string[] | undefined, current: string[] | undefined): authors is string[] {
  return Boolean(
    authors?.length &&
      authors.length >= (current?.length ?? 0) &&
      authors.every((author) => author.split(/\s+/).length >= 2) &&
      authors.join(" ").length >= (current?.join(" ").length ?? 0) * 0.6
  );
}

function shouldUseAffiliation(affiliation: string | undefined, current: string | undefined): affiliation is string {
  return Boolean(affiliation && ORG_WORDS.test(affiliation) && affiliation.length > Math.max(12, current?.length ?? 0));
}

function rawMetadata(paper: RecommendedPaper): string {
  return paper.metadataText || [paper.authors?.join(", "), paper.firstAffiliation].filter(Boolean).join(" ");
}

async function defaultLoadNerPipeline(model: string): Promise<NerPipeline> {
  const { pipeline } = await import("@huggingface/transformers");
  return (await pipeline("token-classification", model)) as NerPipeline;
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("metadata repair timeout")), timeoutMs);
    work.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

async function repairSelectedMetadata(
  recommendations: RecommendedPaper[],
  loadNerPipeline: LoadNerPipeline,
  model: string
): Promise<RecommendedPaper[]> {
  console.log(`[paper-metadata] loading NER model ${model}`);
  const ner = await loadNerPipeline(model);
  const repaired: RecommendedPaper[] = [];
  let repairedAuthors = 0;
  let repairedAffiliations = 0;
  for (const paper of recommendations) {
    const entities = await ner(rawMetadata(paper));
    const authors = groups(entities, "PER");
    const affiliation = groups(entities, "ORG")
      .sort((left, right) => right.length - left.length)
      .find((value) => shouldUseAffiliation(value, paper.firstAffiliation));
    const useAuthors = shouldUseAuthors(authors, paper.authors);
    if (useAuthors) repairedAuthors += 1;
    if (affiliation) repairedAffiliations += 1;
    repaired.push({
      ...paper,
      ...(useAuthors ? { authors } : {}),
      ...(affiliation ? { firstAffiliation: affiliation } : {})
    });
  }
  console.log(
    `[paper-metadata] NER repaired authors for ${repairedAuthors}/${recommendations.length}, affiliations for ${repairedAffiliations}/${recommendations.length}`
  );
  return repaired;
}

/** Applies expensive NER repair only after Recommendations have been selected. */
export async function repairRecommendationMetadata(
  recommendations: RecommendedPaper[],
  config: MetadataRepairConfig,
  loadNerPipeline: LoadNerPipeline = defaultLoadNerPipeline
): Promise<RecommendedPaper[]> {
  if (!config.enabled || recommendations.length === 0) return recommendations;
  try {
    return await withTimeout(
      repairSelectedMetadata(recommendations, loadNerPipeline, config.model),
      config.timeoutMs
    );
  } catch (error) {
    console.log(`[paper-metadata] NER skipped: ${error instanceof Error ? error.message : String(error)}`);
    return recommendations;
  }
}
