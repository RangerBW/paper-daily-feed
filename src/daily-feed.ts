import journals from "../data/journals.config.js";
import type { AppConfig } from "./app-config.js";
import { loadAppConfig } from "./app-config.js";
import { configSummaryLines } from "./config-summary.js";
import { filterUndeliveredPapers, loadDeliveryHistory } from "./delivery-history.js";
import { buildInterestCorpus } from "./interest-corpus.js";
import { rankPapers, resolveMatchingProvider } from "./matching.js";
import { enrichFeedPaperMetadata, repairRecommendationMetadata } from "./paper-metadata.js";
import { deliverRecommendations } from "./recommendation-delivery.js";
import { fetchRecentFeedPapers } from "./feed-ingestion.js";

type Env = Record<string, string | undefined>;

export type DailyFeedMode = "run" | "preview-email";

export type DailyFeedResult = {
  recommendationCount: number;
  html: string;
  sent: boolean;
  deliveryDetails: string;
};

export async function runDailyFeed(
  mode: DailyFeedMode,
  env: Env = process.env,
  config: AppConfig = loadAppConfig(env)
): Promise<DailyFeedResult> {
  console.log("Loaded app config.");
  for (const line of configSummaryLines(config)) {
    console.log(line);
  }

  console.log("Building interest corpus...");
  const interestCorpus = await buildInterestCorpus(config.interests, env);
  if (interestCorpus.length === 0) {
    throw new Error("Interest corpus is empty. Enable profile or Zotero interests in app config.");
  }
  console.log(`Built ${interestCorpus.length} interest documents.`);

  const recentPapers = await fetchRecentFeedPapers(journals, config.feeds, config.matching.maxPaperAgeDays);
  const deliveryHistory = loadDeliveryHistory();
  const eligiblePapers = filterUndeliveredPapers(recentPapers, deliveryHistory, env);
  console.log(
    `Filtered ${recentPapers.length - eligiblePapers.length} already delivered papers; ${eligiblePapers.length} candidates remain.`
  );
  const enrichedPapers = await enrichFeedPaperMetadata(eligiblePapers, config.metadataEnrichment);
  const matchingProvider = resolveMatchingProvider(config.matching);
  const fallback = matchingProvider.fallbackReason ? ` (${matchingProvider.fallbackReason})` : "";
  console.log(
    `Ranking ${enrichedPapers.length} papers against ${interestCorpus.length} interest documents with ${matchingProvider.label}${fallback}...`
  );
  let recommendations = await rankPapers(config.matching, enrichedPapers, interestCorpus, env);
  console.log(`Ranked ${recommendations.length} recommended papers.`);
  recommendations = await repairRecommendationMetadata(recommendations, config.metadataRepair);

  return deliverRecommendations(recommendations, mode, config, deliveryHistory, env);
}
