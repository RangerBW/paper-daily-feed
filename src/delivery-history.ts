import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { FeedPaper } from "./types.js";

export const DELIVERY_HISTORY_PATH = ".delivery-history.json";
export const DEFAULT_DELIVERY_HISTORY_SALT = "paper-daily-feed:v1:delivery-history";
const DELIVERY_HISTORY_RETENTION_DAYS = 180;

export type DeliveryHistoryEntry = {
  fingerprint: string;
  deliveredAt: string;
};

export type DeliveryHistory = {
  version: 1;
  delivered: DeliveryHistoryEntry[];
};

type Env = Record<string, string | undefined>;

function emptyHistory(): DeliveryHistory {
  return { version: 1, delivered: [] };
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.toLowerCase();

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.startsWith("utm_") || normalizedKey === "dgcid") {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();
    return url.toString().toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function historySalt(env: Env): string {
  return env.DELIVERY_HISTORY_SALT?.trim() || DEFAULT_DELIVERY_HISTORY_SALT;
}

function isValidEntry(value: unknown): value is DeliveryHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<DeliveryHistoryEntry>;
  return (
    typeof entry.fingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(entry.fingerprint) &&
    typeof entry.deliveredAt === "string" &&
    !Number.isNaN(new Date(entry.deliveredAt).getTime())
  );
}

export function createPaperFingerprint(paper: Pick<FeedPaper, "title" | "url">, env: Env = process.env): string {
  return createHash("sha256")
    .update(`${historySalt(env)}::${normalizeUrl(paper.url)}::${normalizeTitle(paper.title)}`)
    .digest("hex");
}

export function loadDeliveryHistory(path = DELIVERY_HISTORY_PATH): DeliveryHistory {
  if (!existsSync(path)) {
    return emptyHistory();
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<DeliveryHistory>;
    const delivered = Array.isArray(parsed.delivered) ? parsed.delivered.filter(isValidEntry) : [];
    return { version: 1, delivered };
  } catch {
    return emptyHistory();
  }
}

export function saveDeliveryHistory(path: string, history: DeliveryHistory): void {
  writeFileSync(path, `${JSON.stringify(history, null, 2)}\n`);
}

export function filterUndeliveredPapers<T extends Pick<FeedPaper, "title" | "url">>(
  papers: T[],
  history: DeliveryHistory,
  env: Env = process.env
): T[] {
  const delivered = new Set(history.delivered.map((entry) => entry.fingerprint));
  return papers.filter((paper) => !delivered.has(createPaperFingerprint(paper, env)));
}

export function recordDeliveredPapers(
  history: DeliveryHistory,
  papers: Pick<FeedPaper, "title" | "url">[],
  deliveredAt: Date,
  env: Env = process.env
): DeliveryHistory {
  const retentionCutoff = deliveredAt.getTime() - DELIVERY_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const records = history.delivered.filter((entry) => new Date(entry.deliveredAt).getTime() >= retentionCutoff);
  const seen = new Set(records.map((entry) => entry.fingerprint));

  for (const paper of papers) {
    const fingerprint = createPaperFingerprint(paper, env);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      records.push({ fingerprint, deliveredAt: deliveredAt.toISOString() });
    }
  }

  return { version: 1, delivered: records };
}
