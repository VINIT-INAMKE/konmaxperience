/** Single place to forward runtime errors. Sentry lands here in a later phase. */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  console.error('[report-error]', error, context);
}
