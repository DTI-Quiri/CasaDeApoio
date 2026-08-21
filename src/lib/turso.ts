import { createClient } from '@libsql/client/web';

const defaultUrl = 'libsql://casadeapoio-garcia3528.aws-ap-south-1.turso.io';
const defaultToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIyMzU5MjIsImlkIjoiMDE5Y2ExNDYtOGYwMS03ZGI5LWFkYjAtNDE1Y2NiYzk3MDk2IiwicmlkIjoiYzU1NzhhZWItNjIwNS00MjAwLWFhMWQtYTlmMDY3OGExZWRmIn0.i70iJppnG0q-2477DIe_Y8WbELETa2EPbDt3F0nLG7ULQvxwQvxTnfGHdyWd2TqcLGbgUsj1hfXm8YM5usPLBg';

const url = (import.meta.env.VITE_TURSO_DATABASE_URL as string) || defaultUrl;
const authToken = (import.meta.env.VITE_TURSO_AUTH_TOKEN as string) || defaultToken;

export const turso = createClient({
  url,
  authToken,
});

/**
 * Standard SHA-256 (used for legacy comparison and data integrity)
 */
export async function sha256(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a cryptographically random 16-byte hex salt
 */
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password with a cryptographic random salt (Format: s2$<salt>$<hash>)
 * Protects against rainbow table attacks and precomputed dictionary attacks.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const enc = new TextEncoder().encode(salt + ':' + password);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hash = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `s2$${salt}$${hash}`;
}

/**
 * Safely compares an input password against stored hash (supports salted & legacy SHA-256)
 */
export async function compareHash(input: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // Salted format: s2$<salt>$<hash>
  if (storedHash.startsWith('s2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      const enc = new TextEncoder().encode(salt + ':' + input);
      const buf = await crypto.subtle.digest('SHA-256', enc);
      const computedHash = Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return computedHash === expectedHash;
    }
  }

  // Legacy SHA-256 comparison for backward compatibility
  const legacyHash = await sha256(input);
  return legacyHash === storedHash;
}
