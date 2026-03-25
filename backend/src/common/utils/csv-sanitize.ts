/**
 * Sanitize a string value for safe CSV/Excel export.
 * Prevents formula injection by prefixing dangerous characters with a single quote.
 * Dangerous prefixes: =, +, -, @, TAB (\t), CR (\r)
 * When opened in Excel/Google Sheets, the quote prevents formula interpretation.
 */
export function csvSanitize(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitize all string values in a row object for CSV/Excel export.
 * Non-string values (numbers, dates, booleans) are left unchanged.
 */
export function sanitizeRow<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = csvSanitize(result[key]);
    }
  }
  return result;
}

