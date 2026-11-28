// Whether a store error says a column that came after its table is missing,
// as when a deploy lands before its SQL has run: a read names the column to
// Postgres (SQLSTATE 42703), and a write is refused by the API layer first
// (PGRST204). The pattern names the column itself, so an unrelated error is
// never mistaken for it. Pure.

export function missingColumn(
  error: { code?: string; message?: string } | null | undefined,
  column: RegExp,
): boolean {
  return (error?.code === "42703" || error?.code === "PGRST204") && column.test(error?.message ?? "");
}
