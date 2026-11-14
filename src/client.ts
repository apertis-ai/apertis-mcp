export interface Model {
  id: string;
  name: string;
  provider: string;
  pricing?: {
    input_per_million?: number;
    output_per_million?: number;
    cache_read_per_million?: number;
    cache_write_per_million?: number;
  };
  context_window?: number;
  description?: string;
  capabilities?: string[];
  group?: string;
  is_free?: boolean;
  category?: string;
  features?: string[];
}

/** GET /v1/token/info `data`. Optional keys are absent when not applicable. */
export interface TokenInfo {
  id?: number;
  name?: string;
  status?: string;
  created_at?: number | string;
  last_used_at?: number | string;
  expired_at?: number | string;
  unlimited_quota?: boolean;
  remain_quota_usd?: number;
  used_quota_usd?: number;
  monthly_limit_usd?: number;
  monthly_used_usd?: number;
  subscription?: {
    plan?: string;
    status?: string;
    expiry?: number | string;
  };
}

export type RecommendTask =
  | "coding"
  | "long-context"
  | "fast-chat"
  | "reasoning"
  | "vision";

export type RecommendBudget = "low" | "medium" | "high";

export interface RecommendAlternative {
  model: string;
  input_price_per_1m: number;
  note: string;
}

export interface Recommendation {
  model: string;
  task: RecommendTask;
  budget: RecommendBudget;
  input_price_per_1m: number;
  output_price_per_1m: number;
  reason: string;
  alternatives: RecommendAlternative[];
}

/** One entry of GET /v1/token/keys `data` (key is masked by the gateway). */
export interface Token {
  id?: number;
  name?: string;
  key?: string;
  status?: string;
  created_at?: number | string;
  last_used_at?: number | string;
  unlimited_quota?: boolean;
  remain_quota_usd?: number;
  used_quota_usd?: number;
}

/** GET /v1/token/usage `data`: all-time totals for the calling key. */
export interface UsageStat {
  token_name?: string;
  total_quota_usd?: number;
  total_tokens?: number;
  total_requests?: number;
  remain_quota_usd?: number;
  used_quota_usd?: number;
}

// Raw response from /api/v2/models
interface ApiModelEntry {
  model_id: string;
  display_name: string;
  provider: string;
  category: string;
  charge_type: string;
  input_price: number;
  output_price: number;
  context_length: number | null;
  features: string[];
  tasks: string[];
  description: string | null;
  is_enabled: boolean;
  is_deprecated: boolean;
}

interface ApiModelsResponse {
  models: ApiModelEntry[];
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
    has_more?: boolean;
  };
}

export const MODELS_PAGE_SIZE = 100;
export const MODELS_MAX_PAGES = 50;

export class ApertisClient {
  private apiKey: string;
  private baseUrl: string;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private modelsFetching: Promise<Model[]> | null = null;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    return fetch(url, { ...options, headers });
  }

  async getModels(): Promise<Model[]> {
    const cached = this.getCached<Model[]>("models");
    if (cached) return cached;

    // Deduplicate concurrent requests
    if (this.modelsFetching) return this.modelsFetching;

    this.modelsFetching = (async () => {
      try {
        // /api/v2/models is paginated (limit is clamped to 100): walk it
        // with offset until the gateway reports has_more: false.
        const entries: ApiModelEntry[] = [];
        const seenIds = new Set<string>();
        let offset = 0;
        for (let page = 0; ; page++) {
          if (page >= MODELS_MAX_PAGES) {
            throw new Error(
              `Model catalog exceeded the ${MODELS_MAX_PAGES}-page cap (${MODELS_PAGE_SIZE} models per page); stopping`,
            );
          }
          // Trailing slash: the gateway answers the bare path with a redirect.
          const response = await this.request(
            `/api/v2/models/?limit=${MODELS_PAGE_SIZE}&offset=${offset}`,
          );
          if (!response.ok) {
            throw new Error(
              `Failed to fetch models: ${response.status} ${response.statusText}`,
            );
          }
          const body = (await response.json()) as {
            data?: ApiModelsResponse;
          } & Partial<ApiModelsResponse>;
          const pageData = body.data ?? body;
          const pageEntries = pageData.models || [];
          // A catalog refresh between pages can repeat a model: keep the first.
          for (const e of pageEntries) {
            if (seenIds.has(e.model_id)) continue;
            seenIds.add(e.model_id);
            entries.push(e);
          }
          if (pageData.pagination?.has_more !== true) break;
          // Advance by the page size the gateway actually served, which can
          // be smaller than the one requested.
          const step = pageData.pagination?.limit || pageEntries.length;
          if (step <= 0) break;
          offset += step;
        }

        const models: Model[] = entries
          .filter((e) => e.is_enabled && !e.is_deprecated)
          .map((e) => ({
            id: e.model_id,
            name: e.display_name || e.model_id,
            provider: e.provider || "Unknown",
            pricing: {
              input_per_million: e.input_price,
              output_per_million: e.output_price,
            },
            context_window: e.context_length ?? undefined,
            description: e.description ?? undefined,
            capabilities: e.features || [],
            category: e.category,
            features: e.tasks || [],
            is_free:
              e.charge_type === "free" ||
              (e.input_price === 0 && e.output_price === 0),
          }));

        this.setCache("models", models);
        return models;
      } finally {
        this.modelsFetching = null;
      }
    })();

    return this.modelsFetching;
  }

  async getModelInfo(modelId: string): Promise<Model> {
    // Try from cache first
    const allModels = await this.getModels();
    const found = allModels.find((m) => m.id === modelId);
    if (found) return found;

    throw new Error(`Model '${modelId}' not found`);
  }

  private async getData<T>(endpoint: string, what: string): Promise<T> {
    const response = await this.request(endpoint);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${what}: ${response.status} ${response.statusText}`,
      );
    }
    const body = (await response.json()) as { data?: T } & Record<
      string,
      unknown
    >;
    return (body.data ?? body) as T;
  }

  async getTokenInfo(): Promise<TokenInfo> {
    // Works with API key auth (no JWT needed)
    return this.getData<TokenInfo>("/v1/token/info", "token info");
  }

  async getUsageStats(): Promise<UsageStat> {
    // The gateway accepts no query parameters: totals are all-time for this key.
    return this.getData<UsageStat>("/v1/token/usage", "usage stats");
  }

  async getTokens(): Promise<Token[]> {
    const data = await this.getData<Token[]>("/v1/token/keys", "tokens");
    return Array.isArray(data) ? data : [];
  }

  async getRecommendation(
    task: RecommendTask,
    budget: RecommendBudget = "medium",
  ): Promise<Recommendation> {
    const params = new URLSearchParams({ task, budget });
    const response = await this.request(`/v1/recommend?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Failed to fetch recommendation: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
      );
    }
    return (await response.json()) as Recommendation;
  }

  async chatCompletion(
    model: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  ): Promise<string> {
    const response = await this.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Chat completion failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`,
      );
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error(
        "Chat completion response missing choices[0].message.content",
      );
    }
    return content;
  }
}
