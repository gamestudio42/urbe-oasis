import { useStore, type Store } from './store';

export function isOneOf<L extends string>(
  locales: readonly L[],
  value: string | null | undefined,
): value is L {
  return value !== null && value !== undefined && (locales as readonly string[]).includes(value);
}

export function readStoredLocale(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function persistLocale(key: string, locale: string): void {
  try {
    localStorage.setItem(key, locale);
  } catch {
    // Private mode: the choice lasts for this session only.
  }
}

export function readNavigatorLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return [...navigator.languages];
  return navigator.language ? [navigator.language] : [];
}

export function resolveLocale<L extends string>(options: {
  locales: readonly L[];
  fallback: L;
  match: (tag: string) => L | null;
  stored?: string | null;
  languages?: readonly string[];
}): L {
  const stored = options.stored;
  if (isOneOf(options.locales, stored)) return stored;
  const languages = options.languages ?? readNavigatorLanguages();
  for (const tag of languages) {
    const match = options.match(tag);
    if (match) return match;
  }
  return options.fallback;
}

export function bootLocale<L extends string>(
  key: string,
  resolve: (stored: string | null) => L,
): L {
  const locale = resolve(readStoredLocale(key));
  persistLocale(key, locale);
  return locale;
}

export function useCatalog<TState extends { locale: L }, L extends string, TStrings>(
  ui: Store<TState>,
  catalogOf: (locale: L) => TStrings,
): TStrings {
  const locale = useStore(ui, (s) => s.locale);
  return catalogOf(locale);
}

export function applyDocumentLang(locale: string, title?: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  if (title !== undefined) document.title = title;
}
