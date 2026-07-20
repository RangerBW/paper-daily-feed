export type OpenAlexMetadata = {
  id: string;
  title?: string;
  abstract?: string;
  authors?: string[];
  publishedAt?: Date | null;
  url?: string;
  doi?: string;
  journal?: string;
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

type OpenAlexAuthorship = {
  author?: {
    display_name?: string;
  };
};

type OpenAlexWork = {
  id?: string;
  title?: string;
  display_name?: string;
  doi?: string;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: OpenAlexAuthorship[];
  publication_date?: string;
  primary_location?: {
    source?: {
      display_name?: string;
    };
    landing_page_url?: string;
  };
};

type OpenAlexWorksResponse = {
  results?: OpenAlexWork[];
};

function reconstructAbstract(index: Record<string, number[]> | undefined): string | undefined {
  if (!index) return undefined;

  const words: Array<{ word: string; position: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      words.push({ word, position });
    }
  }
  const abstract = words
    .sort((left, right) => left.position - right.position)
    .map(({ word }) => word)
    .join(" ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();

  return abstract || undefined;
}

function normalizeWork(work: OpenAlexWork): OpenAlexMetadata | null {
  if (!work.id) return null;

  const title = work.title ?? work.display_name;
  const authors = work.authorships
    ?.map((authorship) => authorship.author?.display_name?.trim())
    .filter((author): author is string => Boolean(author));
  const publishedAt = work.publication_date ? new Date(work.publication_date) : null;
  const doi = work.doi?.replace(/^https:\/\/doi\.org\//i, "");

  return {
    id: work.id,
    ...(title ? { title } : {}),
    ...(reconstructAbstract(work.abstract_inverted_index) ? { abstract: reconstructAbstract(work.abstract_inverted_index) } : {}),
    ...(authors?.length ? { authors } : {}),
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    ...(work.primary_location?.landing_page_url ? { url: work.primary_location.landing_page_url } : {}),
    ...(doi ? { doi } : {}),
    ...(work.primary_location?.source?.display_name ? { journal: work.primary_location.source.display_name } : {})
  };
}

export async function fetchOpenAlexMetadataByTitle(
  title: string,
  options: { fetcher?: Fetcher; timeoutMs?: number } = {}
): Promise<OpenAlexMetadata[]> {
  const normalizedTitle = title.replace(/\s+/g, " ").trim();
  if (!normalizedTitle) return [];

  const fetcher = options.fetcher ?? fetch;
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", normalizedTitle);
  url.searchParams.set("per-page", "5");
  url.searchParams.set("select", "id,title,display_name,doi,abstract_inverted_index,authorships,publication_date,primary_location");

  const response = await fetchWithTimeout(
    fetcher,
    url,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "paper-daily-feed/0.1.4 (metadata enrichment)"
      }
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  const payload = (await response.json()) as OpenAlexWorksResponse;
  return (payload.results ?? []).map(normalizeWork).filter((work): work is OpenAlexMetadata => work !== null);
}
