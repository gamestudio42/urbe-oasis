import { Logo as ChromeLogo } from '@shell/chrome';
import { catalog, isLocale, resolveLocale } from '../i18n';

const MARK_URL = `${import.meta.env.BASE_URL}favicon.svg`;

/** Urbe lockup: the isometric skyline mark and the wordmark. */
export function Logo({ size = 56, title }: { size?: number; title?: string }) {
  const brand = title ?? catalog(resolveLocale()).brand;
  return <ChromeLogo size={size} title={brand} markUrl={MARK_URL} />;
}

/** The reactive wordmark: follows the selected locale, including a reskin override. */
export function BrandLogo({ locale, size = 56 }: { locale: string; size?: number }) {
  const brand = isLocale(locale) ? catalog(locale).brand : catalog('en').brand;
  return <ChromeLogo size={size} title={brand} markUrl={MARK_URL} />;
}
