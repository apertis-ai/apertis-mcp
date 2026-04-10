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
}

export interface User {
  id: number;
  email: string;
  name?: string;
  balance?: number;
  subscription_plan?: string;
  subscription_status?: string;
  subscription_expiry?: string;
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

export class ApertisClient {
  private apiKey: string;
  private baseUrl: string;
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
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

  private async fetch(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      ...((options.headers as Record<string, string>) || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    return response;
  }

  async getModels(): Promise<Model[]> {
    const cached = this.getCached<Model[]>("models");
    if (cached) return cached;

    const response = await this.fetch("/api/models");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch models: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as unknown;
    const models = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).data as Model[]);
    this.setCache("models", models);
    return models;
  }

  async getModelInfo(modelId: string): Promise<Model> {
    const response = await this.fetch(
      `/api/models/${encodeURIComponent(modelId)}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch model info: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Model;
    return data;
  }

  async getUserSelf(): Promise<User> {
    const response = await this.fetch("/api/user/self");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch user info: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as User;
    return data;
  }

  async getUsageStats(
    period: "today" | "week" | "month" = "today",
  ): Promise<UsageStat> {
    const response = await this.fetch(
      `/api/log/stat?period=${encodeURIComponent(period)}`,
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
    const response = await this.fetch("/api/token/");
    if (!response.ok) {
      throw new Error(
        `Failed to fetch tokens: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as unknown;
    const tokens = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>).data as Token[]);
    return tokens;
  }

  async createToken(name: string, quota?: number): Promise<Token> {
    const body = { name, ...(quota && { quota }) };
    const response = await this.fetch("/api/token/", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create token: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as Token;
    return data;
  }
}
