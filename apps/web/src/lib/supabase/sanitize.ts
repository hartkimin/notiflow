/**
 * Escape PostgREST filter metacharacters for use in `.or()` filter strings.
 * Characters `,`, `.`, `(`, `)`, `\` are escaped with backslash.
 * Also escapes LIKE wildcards `%` and `_`.
 */
export function escapeFilterValue(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\./g, "\\.")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/**
 * Escape LIKE wildcards for use in `.ilike()` / `.like()` filter values.
 */
export function escapeLikeValue(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
