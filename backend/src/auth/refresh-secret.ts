/**
 * Resolve the secret used to sign/verify refresh tokens.
 *
 * Refresh tokens MUST NOT be signed with JWT_SECRET: that would let a stolen
 * refresh token be replayed as a bearer access token. In production the secret
 * is mandatory; in development it is derived from JWT_SECRET with a warning so
 * local setups keep working.
 */
export function resolveRefreshSecret(
  get: (key: string) => string | undefined,
  logger: { warn(message: string): void },
): string {
  const explicit = get('JWT_REFRESH_SECRET');
  if (explicit) return explicit;
  if (get('NODE_ENV') === 'production') {
    throw new Error('JWT_REFRESH_SECRET is required when NODE_ENV=production');
  }
  logger.warn(
    'JWT_REFRESH_SECRET not set — deriving it from JWT_SECRET. Do not do this in production.',
  );
  return `${get('JWT_SECRET')}.refresh`;
}
