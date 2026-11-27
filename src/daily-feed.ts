import journals from "../data/journals.config.js";
import type { AppConfig } from "./app-config.js";
import { loadAppConfig } from "./app-config.js";
import { configSummaryLines } from "./config-summary.js";
import { openDeliveryHistory, paperIdentityKeys } from "./delivery-history.js";
import { sendEmail } from "./email.js";
import { buildInterestCorpus } from "./interest-corpus.js";
import { rankPapers, resolveMatchingProvider } from "./matching.js";
import {
  enrichFeedPaperMetadata,
  enrichRecommendationPaperMetadata,
  repairRecommendationMetadata
} from "./paper-metadata.js";
import {
  deliverRecommendations,
  type RecommendationDeliveryDependencies
} from "./recommendation-delivery.js";
import { fetchRecentFeedPapers } from "./feed-ingestion.js";
import { hasMeaningfulAbstract } from "./text.js";
import type { RecommendedPaper } from "./types.js";

type Env = Record<string, string | undefined>;

export type DailyFeedMode = "run" | "preview-email";

export type DailyFeedResult = {
  recommendationCount: number;
  html: string;
  sent: boolean;
  deliveryDetails: string;
};

export type DailyFeedDependencies = {
  buildInterestCorpus: typeof buildInterestCorpus;
  fetchRecentFeedPapers: typeof fetchRecentFeedPapers;
  openDeliveryHistory: typeof openDeliveryHistory;
  enrichFeedPaperMetadata: typeof enrichFeedPaperMetadata;
  enrichRecommendationPaperMetadata: typeof enrichRecommendationPaperMetadata;
  resolveMatchingProvider: typeof resolveMatchingProvider;
  rankPapers: typeof rankPapers;
  repairRecommendationMetadata: typeof repairRecommendationMetadata;
  delivery: RecommendationDeliveryDependencies;
};

const defaultDependencies: DailyFeedDependencies = {
  buildInterestCorpus,
  fetchRecentFeedPapers,
  openDeliveryHistory,
  enrichFeedPaperMetadata,
  enrichRecommendationPaperMetadata,
  resolveMatchingProvider,
  rankPapers,
  repairRecommendationMetadata,
  delivery: { sendEmail }
};

export async function runDailyFeed(
  mode: DailyFeedMode,
  env: Env = process.env,
  config: AppConfig = loadAppConfig(env),
  dependencies: DailyFeedDependencies = defaultDependencies
): Promise<DailyFeedResult> {
  console.log("Loaded app config.");
  for (const line of configSummaryLines(config)) {
    console.log(line);
  }

  console.log("Building interest corpus...");
  const interestCorpus = await dependencies.buildInterestCorpus(config.interests, env);
  if (interestCorpus.length === 0) {
    throw new Error("Interest corpus is empty. Enable profile or Zotero interests in app config.");
  }
  console.log(`Built ${interestCorpus.length} interest documents.`);

  const recentPapers = await dependencies.fetchRecentFeedPapers(journals, config.feeds, config.matching.maxPaperAgeDays);
  const deliveryHistory = dependencies.openDeliveryHistory({ env });
  const eligiblePapers = deliveryHistory.filterUndeliveredPapers(recentPapers);
  console.log(
    `Filtered ${recentPapers.length - eligiblePapers.length} already delivered papers; ${eligiblePapers.length} candidates remain.`
  );
  const enrichedPapers = await dependencies.enrichFeedPaperMetadata(eligiblePapers, config.metadataEnrichment);
  const matchingProvider = dependencies.resolveMatchingProvider(config.matching);
  const fallback = matchingProvider.fallbackReason ? ` (${matchingProvider.fallbackReason})` : "";
  console.log(
    `Ranking ${enrichedPapers.length} papers against ${interestCorpus.length} interest documents with ${matchingProvider.label}${fallback}...`
  );
  const { paperLimit } = config.matching;
  const ranked = await dependencies.rankPapers(
    { ...config.matching, paperLimit: paperLimit * 3 }, enrichedPapers, interestCorpus, env
  );
  console.log(`Ranked ${ranked.length} papers for a digest of up to ${paperLimit}.`);

  const recommendations: RecommendedPaper[] = [];
  const seen = new Set<string>();
  let missingAbstracts = 0;
  for (let start = 0; start < ranked.length && recommendations.length < paperLimit; start += paperLimit) {
    const batch = ranked.slice(start, start + paperLimit);
    const checked = await dependencies.enrichRecommendationPaperMetadata(batch, config.metadataEnrichment);
    for (const paper of deliveryHistory.filterUndeliveredPapers(checked)) {
      const keys = paperIdentityKeys(paper);
      if (keys.some((key) => seen.has(key))) continue;
      if (!hasMeaningfulAbstract(paper.abstract)) {
        missingAbstracts += 1;
        continue;
      }
      keys.forEach((key) => seen.add(key));
      recommendations.push(paper);
      if (recommendations.length === paperLimit) break;
    }
  }
  console.log(`Selected ${recommendations.length} undelivered papers with usable abstracts; skipped ${missingAbstracts} without one.`);
  const repaired = await dependencies.repairRecommendationMetadata(recommendations, config.metadataRepair);
  return deliverRecommendations(repaired, mode, config, deliveryHistory, env, new Date(), dependencies.delivery);
}
