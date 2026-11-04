import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DIST_HOST,
  DIST_SCHEME,
  allowShellRequest,
  resolveDistFile,
} from '../../apps/desktop/src/distFiles';

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'oasis-dist-'));
  roots.push(root);
  writeFileSync(path.join(root, 'index.html'), '<html></html>');
  mkdirSync(path.join(root, 'assets'));
  writeFileSync(path.join(root, 'assets', 'app.js'), 'export {}');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('resolveDistFile', () => {
  it('serves the index and hashed assets on the desktop scheme', () => {
    const root = fixture();
    expect(resolveDistFile(root, `${DIST_SCHEME}://${DIST_HOST}/`)).toBe(
      path.join(root, 'index.html'),
    );
    expect(resolveDistFile(root, `${DIST_SCHEME}://${DIST_HOST}/assets/app.js?v=1`)).toBe(
      path.join(root, 'assets', 'app.js'),
    );
  });

  it('blocks network requests and file reads outside the build directory', () => {
    const root = fixture();
    expect(allowShellRequest(root, 'https://example.com/app.js')).toBe(false);
    expect(allowShellRequest(root, 'http://127.0.0.1/index.html')).toBe(false);
    expect(allowShellRequest(root, `${DIST_SCHEME}://${DIST_HOST}/index.html`)).toBe(true);
    expect(allowShellRequest(root, pathToFileURL(path.join(root, 'index.html')).href)).toBe(true);
    expect(allowShellRequest(root, pathToFileURL('/etc/passwd').href)).toBe(false);
  });

  it('rejects other schemes and paths that leave the build directory', () => {
    const root = fixture();
    expect(resolveDistFile(root, 'https://example.com/index.html')).toBeNull();
    expect(resolveDistFile(root, `${DIST_SCHEME}://other/index.html`)).toBeNull();
    expect(
      resolveDistFile(root, `${DIST_SCHEME}://${DIST_HOST}/%2e%2e/%2e%2e/etc/passwd`),
    ).toBeNull();
    expect(resolveDistFile(root, `${DIST_SCHEME}://${DIST_HOST}/missing.js`)).toBeNull();
  });
});
