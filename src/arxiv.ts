import { stripHtml } from "./text.js";

export type ArxivMetadata = {
  id: string;
  title?: string;
  abstract?: string;
  authors?: string[];
  publishedAt?: Date | null;
  url?: string;
  doi?: string;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const DEFAULT_TIMEOUT_MS = 8_000;

async function fetchWithTimeout(
  fetcher: Fetcher,
  input: string | URL | Request,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeXml(text: string): string {
  return stripHtml(
    text
      .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
  );
}

function tagValue(xml: string, tag: string): string | undefined {
  const value = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml)?.[1];
  return value ? decodeXml(value) : undefined;
}

function arxivIdFromEntry(entry: string, fallbackId?: string): string | undefined {
  return normalizeArxivId(tagValue(entry, "id")?.match(/\/abs\/([^?\s#]+)/i)?.[1] ?? fallbackId ?? "");
}

function metadataFromEntry(entry: string, fallbackId?: string): ArxivMetadata | null {
  const id = arxivIdFromEntry(entry, fallbackId);
  if (!id) return null;

  const title = tagValue(entry, "title");
  const abstract = tagValue(entry, "summary");
  const authors = Array.from(entry.matchAll(/<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/gi), (match) =>
    tagValue(match[1] ?? "", "name")
  ).filter((value): value is string => Boolean(value));
  const published = tagValue(entry, "published");
  const publishedAt = published ? new Date(published) : null;
  const doi = tagValue(entry, "arxiv:doi") ?? tagValue(entry, "doi");

  return {
    id,
    ...(title ? { title } : {}),
    ...(abstract ? { abstract } : {}),
    ...(authors.length ? { authors } : {}),
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    url: `https://arxiv.org/abs/${id}`,
    ...(doi ? { doi } : {})
  };
}

function normalizeArxivId(value: string): string | undefined {
  const trimmed = value.trim().replace(/^arxiv:/i, "");
  const modern = trimmed.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/i)?.[1];
  if (modern) return modern;
  return trimmed.match(/^([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i)?.[1];
}

export function findArxivId(text: string): string | undefined {
  const candidates = [
    ...Array.from(text.matchAll(/arxiv\.org\/(?:abs|pdf)\/([^?\s#)]+)(?:\.pdf)?/gi), (match) => match[1] ?? ""),
    ...Array.from(text.matchAll(/10\.48550\/arxiv\.([^?\s#)]+)/gi), (match) => match[1] ?? ""),
    ...Array.from(text.matchAll(/\barxiv:([a-z-]+(?:\.[A-Z]{2})?\/\d{7}|\d{4}\.\d{4,5})(?:v\d+)?\b/gi), (match) => match[1] ?? "")
  ];

  return candidates.map(normalizeArxivId).find((value): value is string => Boolean(value));
}

export async function fetchArxivMetadata(
  id: string,
  options: { fetcher?: Fetcher; timeoutMs?: number } = {}
): Promise<ArxivMetadata | null> {
  const normalizedId = normalizeArxivId(id);
  if (!normalizedId) return null;

  const fetcher = options.fetcher ?? fetch;
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("id_list", normalizedId);

  const response = await fetchWithTimeout(
    fetcher,
    url,
    {
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml, */*;q=0.8",
        "User-Agent": "paper-daily-feed/0.1.4 (metadata enrichment)"
      }
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const body = await response.text();
  const entry = body.match(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/i)?.[1];
  if (!entry) return null;

  return metadataFromEntry(entry, normalizedId);
}

export async function fetchArxivMetadataByTitle(
  title: string,
  options: { fetcher?: Fetcher; timeoutMs?: number } = {}
): Promise<ArxivMetadata[]> {
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  if (!normalizedTitle) return [];

  const fetcher = options.fetcher ?? fetch;
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `ti:"${normalizedTitle.replace(/"/g, "")}"`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", "5");

  const response = await fetchWithTimeout(
    fetcher,
    url,
    {
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml, */*;q=0.8",
        "User-Agent": "paper-daily-feed/0.1.4 (metadata enrichment)"
      }
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const body = await response.text();
  return Array.from(body.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi), (match) =>
    metadataFromEntry(match[1] ?? "")
  ).filter((metadata): metadata is ArxivMetadata => metadata !== null);
}
