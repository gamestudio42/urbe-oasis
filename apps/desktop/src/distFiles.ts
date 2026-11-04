import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Scheme the shell uses so module workers are not loaded from file://. */
export const DIST_SCHEME = 'oasis';

/** Fixed host. A standard scheme needs one, and relative URLs stay on it. */
export const DIST_HOST = 'app';

/**
 * Map an `oasis://` request onto a file inside `distDir`.
 * Returns null for any other scheme, a missing file, or a path that escapes the directory.
 */
export function resolveDistFile(distDir: string, requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.protocol !== `${DIST_SCHEME}:` || url.hostname !== DIST_HOST) return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === '' || pathname === '/') pathname = '/index.html';

  const relative = pathname.replace(/^\/+/, '');
  if (relative.includes('\0')) return null;

  const root = path.resolve(distDir);
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  if (!existsSync(resolved) || !statSync(resolved).isFile()) return null;
  return resolved;
}

/** Requests the page is allowed to make. `file:` is limited to the build directory so the protocol handler can read it. */
export function allowShellRequest(distDir: string, requestUrl: string): boolean {
  if (
    requestUrl.startsWith(`${DIST_SCHEME}:`) ||
    requestUrl.startsWith('blob:') ||
    requestUrl.startsWith('data:') ||
    requestUrl.startsWith('devtools:')
  ) {
    return true;
  }
  if (!requestUrl.startsWith('file:')) return false;
  let file: string;
  try {
    file = fileURLToPath(requestUrl);
  } catch {
    return false;
  }
  const root = path.resolve(distDir);
  const resolved = path.resolve(file);
  return resolved === root || resolved.startsWith(root + path.sep);
}
