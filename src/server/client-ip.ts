import 'server-only';
import { headers } from 'next/headers';

/**
 * The client IP of the current request (page, route or Server Action).
 *
 * `x-real-ip` first: the reverse proxy (nginx) must be configured to
 * **overwrite** it with the real peer address. `x-forwarded-for` is a
 * fallback only — unless the proxy replaces it, a client can pre-seed the
 * chain. Without a correctly configured proxy neither header can be trusted;
 * that is a deployment requirement (see README).
 *
 * The Socket.IO layer reads the same headers from the handshake
 * (`clientIpFromHeaders`).
 */
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers()) ?? 'unknown';
}

export function clientIpFromHeaders(list: { get(name: string): string | null }): string | null {
  const realIp = list.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = list.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return null;
}
