import type { MetadataRepairConfig } from "./app-config.js";
import type { RecommendedPaper } from "./types.js";

type NerEntity = {
  entity?: string;
  entity_group?: string;
  word?: string;
};

type NerPipeline = (text: string) => Promise<NerEntity[]>;
type LoadNerPipeline = (model: string) => Promise<NerPipeline>;

const ORG_WORDS =
  /\b(?:University|Department|School|Institute|Laboratory|Centre|Center|Research|College|Faculty|Business)\b/i;

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

function metadataText(paper: RecommendedPaper): string {
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

async function repair(
  recommendations: RecommendedPaper[],
  loadNerPipeline: LoadNerPipeline,
  model: string
): Promise<RecommendedPaper[]> {
  console.log(`[metadata-repair] loading NER model ${model}`);
  const ner = await loadNerPipeline(model);
  console.log(`[metadata-repair] loaded NER model; repairing ${recommendations.length} recommendations`);
  const repaired: RecommendedPaper[] = [];
  let repairedAuthors = 0;
  let repairedAffiliations = 0;

  for (const paper of recommendations) {
    const entities = await ner(metadataText(paper));
    const authors = groups(entities, "PER");
    const affiliation = groups(entities, "ORG")
      .sort((left, right) => right.length - left.length)
      .find((value) => shouldUseAffiliation(value, paper.firstAffiliation));
    const useAuthors = shouldUseAuthors(authors, paper.authors);
    if (useAuthors) {
      repairedAuthors += 1;
    }
    if (affiliation) {
      repairedAffiliations += 1;
    }
    if (useAuthors || affiliation) {
      console.log(
        `[metadata-repair] repaired "${paper.title}": authors="${(useAuthors ? authors : paper.authors ?? []).join(", ")}"; firstAffiliation="${affiliation ?? paper.firstAffiliation ?? ""}"`
      );
    }
    repaired.push({
      ...paper,
      ...(useAuthors ? { authors } : {}),
      ...(affiliation ? { firstAffiliation: affiliation } : {})
    });
  }

  console.log(
    `[metadata-repair] done; authors repaired for ${repairedAuthors}/${recommendations.length}, affiliations repaired for ${repairedAffiliations}/${recommendations.length}`
  );
  return repaired;
}

export async function repairRecommendationMetadata(
  recommendations: RecommendedPaper[],
  config: MetadataRepairConfig,
  loadNerPipeline: LoadNerPipeline = defaultLoadNerPipeline
): Promise<RecommendedPaper[]> {
  if (!config.enabled || recommendations.length === 0) {
    return recommendations;
  }

  try {
    return await withTimeout(repair(recommendations, loadNerPipeline, config.model), config.timeoutMs);
  } catch (error) {
    console.log(`[metadata-repair] skipped: ${error instanceof Error ? error.message : String(error)}`);
    return recommendations;
  }
}
