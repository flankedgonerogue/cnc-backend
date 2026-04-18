/**
 * Some runtimes pass through env values with literal surrounding quotes
 * (e.g. STORAGE_TYPE="s3" becomes the five-character string `"s3"`), which
 * breaks strict comparisons. Strip one matching pair of quotes after trim.
 */
export function normalizeQuotedEnvValue(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }
  let v = value.trim();
  if (v.length >= 2) {
    const open = v[0];
    const close = v[v.length - 1];
    if ((open === '"' || open === "'") && close === open) {
      v = v.slice(1, -1).trim();
    }
  }
  return v;
}
