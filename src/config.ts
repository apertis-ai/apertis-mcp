export interface Config {
  apiKey: string;
  baseUrl: string;
}

export function getConfig(): Config {
  const apiKey = process.env.APERTIS_API_KEY;
  if (!apiKey) {
    throw new Error("APERTIS_API_KEY environment variable is required");
  }

  return {
    apiKey,
    baseUrl: process.env.APERTIS_BASE_URL || "https://api.apertis.ai",
  };
}
