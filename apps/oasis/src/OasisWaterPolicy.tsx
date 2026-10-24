import { useRef, useState } from 'react';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { formatNumber } from '@oasis/web/i18n';
import { oasisCopy } from './i18n';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';

/** The engine supplies both alternatives and the accrued cost. */
export function OasisWaterPolicy({ session }: { session: GameSession }) {
  const stats = useStore(session.ui, (s) => s.stats);
  const locale = useStore(session.ui, (s) => s.locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const policy = stats?.oasis?.waterPolicy;
  if (!policy) return null;
  const t = oasisCopy(locale).policy;
  const change = async () => {
    setPending(true);
    try {
      await session.command({ type: 'setWaterRationing', enabled: !policy.enabled });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="oasis-policy">
      <button
        type="button"
        data-testid="oasis-policy-open"
        onClick={() => dialog.current?.showModal()}
      >
        <span>
          <AdobeIcon id="settings" size={20} /> {t.title}
        </span>
        <strong data-active={policy.enabled}>{policy.enabled ? t.rationing : t.normal}</strong>
      </button>
      <dialog
        onKeyDown={(event) => event.stopPropagation()}
        ref={dialog}
        className="oasis-policy-dialog"
        data-testid="oasis-policy-dialog"
        aria-labelledby="water-policy-title"
      >
        <header>
          <h2 id="water-policy-title">{t.title}</h2>
          <button
            type="button"
            aria-label={t.close}
            data-testid="oasis-policy-close"
            onClick={() => dialog.current?.close()}
          >
            <AdobeIcon id="close" size={20} />
          </button>
        </header>
        <p>{t.description}</p>
        <h3>{t.demand}</h3>
        <div className="oasis-policy-options">
          <div>
            <span>{t.standard}</span>
            <strong data-testid="policy-demand-normal">
              {formatNumber(policy.normalDemand, locale)}
            </strong>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span>{t.restricted}</span>
            <strong data-testid="policy-demand-rationed">
              {formatNumber(policy.rationedDemand, locale)}
            </strong>
          </div>
        </div>
        <p className="oasis-policy-cost">
          {t.cost}:{' '}
          <strong data-testid="policy-accrued">
            {(policy.accruedPenalty * 100).toLocaleString(locale, { maximumFractionDigits: 1 })}%
          </strong>
        </p>
        <p className="oasis-policy-timing">{t.timing}</p>
        <button
          type="button"
          className="oasis-policy-apply"
          data-testid="oasis-policy-toggle"
          aria-pressed={policy.enabled}
          disabled={pending}
          onClick={() => void change()}
        >
          {policy.enabled ? t.disable : t.enable}
        </button>
      </dialog>
    </div>
  );
}
