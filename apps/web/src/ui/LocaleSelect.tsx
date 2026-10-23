import { LocaleSelect as ChromeLocaleSelect, useStore } from '@shell/chrome';
import { LOCALES, LOCALE_LABELS, useStrings, type Locale } from '../i18n';
import type { GameSession } from '../state/session';

/** Language picker with a themed list; a hidden native select keeps Playwright hooks. */
export function LocaleSelect({
  session,
  className = '',
  label,
}: {
  session: GameSession;
  className?: string;
  label?: string;
}) {
  const locale = useStore(session.ui, (s) => s.locale);
  const t = useStrings(session.ui);
  return (
    <ChromeLocaleSelect
      locales={LOCALES}
      labels={LOCALE_LABELS}
      value={locale}
      onChange={(code: Locale) => session.setLocale(code)}
      caption={label ?? t.menu.language}
      className={className}
    />
  );
}
