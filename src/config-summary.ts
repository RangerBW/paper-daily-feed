import type { AppConfig } from "./app-config.js";
import { resolveMatchingProvider } from "./matching.js";

function enabledInterestSources(config: AppConfig): string {
  const sources = [
    config.interests.profile.enabled ? "profile" : "",
    config.interests.zotero.enabled ? "zotero" : ""
  ].filter(Boolean);

  return sources.length > 0 ? sources.join(", ") : "none";
}

export function configSummaryLines(config: AppConfig): string[] {
  const matching = resolveMatchingProvider(config.matching);
  const fallback = matching.fallbackReason ? `, fallback=${matching.fallbackReason}` : "";

  return [
    "Config summary:",
    `- interests: ${enabledInterestSources(config)}`,
    `- feeds: catalog=${config.feeds.includeCatalog === false ? "disabled" : config.feeds.catalogSelections.length || "all"}, customRss=${config.feeds.customRss.length}`,
    `- matching: provider=${config.matching.provider}, active=${matching.active}, model=${matching.model}${fallback}, paperLimit=${config.matching.paperLimit}, minScore=${config.matching.minScore}, maxPaperAgeDays=${config.matching.maxPaperAgeDays}, clusterSimilarityThreshold=${config.matching.clusterSimilarityThreshold}, avoidPenaltyWeight=${config.matching.avoidPenaltyWeight}`,
    `- metadataRepair: enabled=${config.metadataRepair.enabled}, model=${config.metadataRepair.model}, timeoutMs=${config.metadataRepair.timeoutMs}`,
    `- metadataEnrichment: enabled=${config.metadataEnrichment.enabled}, crossref=${config.metadataEnrichment.crossref.enabled}`,
    `- summary: enabled=${config.summary.enabled}, model=${config.summary.model}, language=${config.summary.language}`,
    `- delivery: mode=${config.delivery.mode}, from=${config.delivery.from || "(empty)"}, to=${config.delivery.to || "(empty)"}, smtpHost=${config.delivery.smtpHost || "(empty)"}, smtpPort=${config.delivery.smtpPort}`,
    `- runtime: debug=${config.runtime.debug}, sendEmpty=${config.runtime.sendEmpty}`
  ];
}
