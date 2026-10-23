import { describe, expect, it } from 'vitest';
import { matchLocale, resolveLocale } from '../../apps/web/src/i18n';

describe('resolveLocale', () => {
  it('keeps a stored catalog code', () => {
    expect(resolveLocale({ stored: 'es', languages: ['en'] })).toBe('es');
    expect(resolveLocale({ stored: 'pt-BR', languages: ['de'] })).toBe('pt-BR');
  });

  it('maps browser tags onto catalogs, ignoring region', () => {
    expect(resolveLocale({ stored: null, languages: ['pt-PT'] })).toBe('pt-BR');
    expect(resolveLocale({ stored: null, languages: ['es-MX'] })).toBe('es');
    expect(resolveLocale({ stored: null, languages: ['en-GB'] })).toBe('en');
    expect(resolveLocale({ stored: null, languages: ['fr-CA'] })).toBe('fr');
    expect(resolveLocale({ stored: null, languages: ['de-AT'] })).toBe('de');
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveLocale({ stored: null, languages: ['ja'] })).toBe('en');
    expect(resolveLocale({ stored: null, languages: [] })).toBe('en');
  });

  it('ignores an invalid stored key and uses the browser list', () => {
    expect(resolveLocale({ stored: 'xx', languages: ['fr-FR'] })).toBe('fr');
    expect(resolveLocale({ stored: 'portuguese', languages: ['ja'] })).toBe('en');
  });
});

describe('matchLocale', () => {
  it('accepts Portuguese in any region as pt-BR', () => {
    expect(matchLocale('pt')).toBe('pt-BR');
    expect(matchLocale('pt-BR')).toBe('pt-BR');
    expect(matchLocale('pt_PT')).toBe('pt-BR');
  });

  it('returns null for unknown languages', () => {
    expect(matchLocale('ja')).toBeNull();
    expect(matchLocale('zh-CN')).toBeNull();
  });
});
