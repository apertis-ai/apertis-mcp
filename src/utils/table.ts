export function formatTable(
  headers: string[],
  rows: (string | number)[][],
): string {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)),
  );

  const sep = "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const head =
    "| " + headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") + " |";
  const body = rows
    .map(
      (row) =>
        "| " +
        row
          .map((cell, i) => String(cell ?? "").padEnd(colWidths[i]))
          .join(" | ") +
        " |",
    )
    .join("\n");

  return [head, sep, body].join("\n");
}
