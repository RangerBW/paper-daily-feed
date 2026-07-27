import type { AppConfig, ZoteroInterestConfig } from "./app-config.js";
import { buildProfileInterestDocuments } from "./interest-profile.js";
import type { InterestDocument } from "./types.js";
import { fetchZoteroInterestDocuments } from "./zotero.js";

export async function buildInterestCorpus(
  interests: AppConfig["interests"],
  env: Record<string, string | undefined>,
  fetchZoteroDocuments: (
    config: ZoteroInterestConfig,
    env: Record<string, string | undefined>
  ) => Promise<InterestDocument[]> = fetchZoteroInterestDocuments
): Promise<InterestDocument[]> {
  const documents = buildProfileInterestDocuments(interests.profile);
  console.log(`Built ${documents.length} profile interest documents.`);

  if (interests.zotero.enabled) {
    console.log("Fetching Zotero interest documents...");
    try {
      const zoteroDocuments = await fetchZoteroDocuments(interests.zotero, env);
      console.log(`Fetched ${zoteroDocuments.length} Zotero interest documents.`);
      documents.push(...zoteroDocuments);
    } catch (error) {
      if (documents.length === 0) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Zotero interest documents unavailable; continuing with ${documents.length} profile documents. Cause: ${message}`
      );
    }
  } else {
    console.log("Skipping Zotero interest documents.");
  }

  return documents;
}
