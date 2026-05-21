export function toolError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error ${action}: ${message}` }],
    isError: true as const,
  };
}
