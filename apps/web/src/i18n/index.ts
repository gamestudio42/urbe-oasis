import {
  applyDocumentLang,
  bootLocale as bootStoredLocale,
  persistLocale as persistStored,
  readNavigatorLanguages,
  readStoredLocale,
  resolveLocale as resolveCatalog,
  useCatalog,
  type Store,
} from '@shell/chrome';
import { de } from './de';
import { en, type Strings } from './en';
import { es } from './es';
import { fr } from './fr';
import { ptBR } from './pt-BR';

export type { Strings } from './en';

export const LOCALES = ['en', 'pt-BR', 'es', 'fr', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'pt-BR': 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
};

export const LOCALE_KEY = 'cityBuilder.locale';

const CATALOGS: Record<Locale, Strings> = {
  en,
  'pt-BR': ptBR,
  es,
  fr,
  de,
};

const INTL: Record<Locale, string> = {
  en: 'en-US',
  'pt-BR': 'pt-BR',
  es: 'es',
  fr: 'fr-FR',
  de: 'de-DE',
};

const MONTHS: Record<Locale, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  'pt-BR': ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
  de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Maps a BCP 47 tag onto a catalog, ignoring unknown regions. */
export function matchLocale(tag: string): Locale | null {
  const lower = tag.trim().toLowerCase().replaceAll('_', '-');
  if (lower === 'pt-br' || lower === 'pt' || lower.startsWith('pt-')) return 'pt-BR';
  const primary = lower.split('-')[0];
  if (primary === 'en') return 'en';
  if (primary === 'es') return 'es';
  if (primary === 'fr') return 'fr';
  if (primary === 'de') return 'de';
  return null;
}

export function resolveLocale(options?: {
  stored?: string | null;
  languages?: readonly string[];
}): Locale {
  return resolveCatalog({
    locales: LOCALES,
    fallback: 'en',
    match: matchLocale,
    stored: options?.stored !== undefined ? options.stored : readStoredLocale(LOCALE_KEY),
    languages: options?.languages ?? readNavigatorLanguages(),
  });
}

export function persistLocale(locale: Locale): void {
  persistStored(LOCALE_KEY, locale);
}

/** Resolves the locale and writes it so the next visit does not flip. */
export function bootLocale(): Locale {
  return bootStoredLocale(LOCALE_KEY, (stored) => resolveLocale({ stored }));
}

/** Partial catalog applied on top of the base one; a reskin overrides copy without forking it. */
let override: Partial<Record<Locale, DeepPartial<Strings>>> = {};

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/** Registers a copy override for one locale (used by reskins such as Neo Urbe). */
export function setCatalogOverride(locale: Locale, strings: DeepPartial<Strings>): void {
  override = { ...override, [locale]: strings };
}

function merge<T>(base: T, extra: DeepPartial<T> | undefined): T {
  if (!extra) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(extra as Record<string, unknown>)) {
    const current = out[key];
    out[key] =
      current && typeof current === 'object' && value && typeof value === 'object'
        ? merge(current, value as never)
        : value;
  }
  return out as T;
}

export function catalog(locale: Locale): Strings {
  return merge(CATALOGS[locale] ?? en, override[locale]);
}

export function useStrings(ui: Store<{ locale: Locale }>): Strings {
  return useCatalog(ui, catalog);
}

export function intlLocale(locale: Locale): string {
  return INTL[locale];
}

export function formatMoney(value: number, locale: Locale): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString(INTL[locale])}`;
}

export function formatNumber(value: number, locale: Locale): string {
  return Math.round(value).toLocaleString(INTL[locale]);
}

export function months(locale: Locale): readonly string[] {
  return MONTHS[locale];
}

export function applyDocumentLocale(locale: Locale): void {
  applyDocumentLang(locale, catalog(locale).pageTitle);
}
