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

export interface User {
  id: number;
  email?: string;
  name?: string;
  balance?: number;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_expiry?: string;
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

export interface Token {
  id: string;
  name: string;
  key?: string;
  remaining_quota?: number;
  total_quota?: number;
  created_at?: string;
  status?: string;
  last_used?: string;
}

export interface UsageStat {
  period: string;
  total_tokens?: number;
  total_cost?: number;
  models?: Array<{
    model: string;
    tokens: number;
    cost: number;
  }>;
  daily_breakdown?: Array<{
    date: string;
    tokens: number;
    cost: number;
  }>;
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
  pagination: { total: number };
}

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
        // Use /api/v2/models which has pricing, context_length, provider
        const response = await this.request(
          "/api/v2/models?page=1&page_size=500",
        );
        if (!response.ok) {
          throw new Error(
            `Failed to fetch models: ${response.status} ${response.statusText}`,
          );
        }

        const body = (await response.json()) as {
          data?: ApiModelsResponse;
        } & ApiModelsResponse;
        const entries = body.data?.models || body.models || [];

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

  async getUserSelf(): Promise<User> {
    // Uses /v1/token/info — works with API key auth (no JWT needed)
    const response = await this.request("/v1/token/info");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch token info: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as {
      success: boolean;
      data: Record<string, unknown>;
    };
    const d = body.data || body;
    const owner = d.owner as Record<string, string> | undefined;
    const sub = d.subscription as Record<string, unknown> | undefined;

    return {
      id: d.id as number,
      email: owner?.email,
      name: owner?.username || (d.name as string),
      balance: d.remain_quota_usd as number | undefined,
      subscription_plan: sub?.plan as string | undefined,
      subscription_status: sub?.status as string | undefined,
      subscription_expiry: sub?.expiry as string | undefined,
    };
  }

  async getUsageStats(
    period: "today" | "week" | "month" = "today",
  ): Promise<UsageStat> {
    const response = await this.request(
      `/v1/token/usage?period=${encodeURIComponent(period)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch usage stats: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as UsageStat;
    return data;
  }

  async getTokens(): Promise<Token[]> {
    const response = await this.request("/v1/token/keys");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tokens: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as unknown;
    const result = body as { success: boolean; data: Token[] };
    return result.data || (Array.isArray(body) ? (body as Token[]) : []);
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

  async createToken(name: string, quota?: number): Promise<Token> {
    const payload = { name, ...(quota && { quota }) };
    const response = await this.request("/v1/token/keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create token: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as { success: boolean; data: Token };
    return body.data || (body as unknown as Token);
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
