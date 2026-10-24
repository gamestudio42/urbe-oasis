import { OasisWaterPolicy } from './OasisWaterPolicy';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { formatNumber } from '@oasis/web/i18n';
import { oasisCopy } from './i18n';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import { useEffect, useRef } from 'react';

/** Displays engine telemetry; no supply, growth or shortage rules live in the UI. */
export function OasisStatus({ session }: { session: GameSession }) {
  const panel = useRef<HTMLElement>(null);
  const stats = useStore(session.ui, (s) => s.stats);
  const locale = useStore(session.ui, (s) => s.locale);
  const overlay = useStore(session.ui, (s) => s.overlay);
  const t = oasisCopy(locale).survival;
  const oasis = stats?.oasis;
  // The inspector moves the chronicle beneath this panel. Labels and live status can wrap.
  useEffect(() => {
    const node = panel.current;
    const app = node?.closest<HTMLElement>('.app');
    if (!node || !app) return;
    const measure = () =>
      app.style.setProperty('--oasis-status-bottom', `${node.offsetTop + node.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      app.style.removeProperty('--oasis-status-bottom');
    };
  }, [stats?.ruleset]);
  if (!stats || stats.ruleset !== 'oasis' || !oasis) return null;
  const bankCount = [...session.client.buildings.values()].filter(
    (b) => b.kind === 'cistern',
  ).length;
  const percent = (n: number) => `${formatNumber(n * 100, locale)}%`;
  const supply = (n: number, d: number) =>
    `${formatNumber(n, locale)} / ${formatNumber(d, locale)}`;
  return (
    <aside ref={panel} className="oasis-status" aria-label={t.title} data-testid="oasis-status">
      <div className="oasis-status-heading">
        <span>{t.title}</span>
        <button
          type="button"
          className="oasis-focus"
          data-testid="focus-spring"
          onClick={() => session.focusSpring()}
        >
          <AdobeIcon id="spring" size={20} /> {t.focusSpring}
        </button>
      </div>
      <div className="oasis-resources">
        <button
          type="button"
          className="oasis-resource"
          data-testid="oasis-water"
          aria-pressed={overlay === 'water'}
          onClick={() => session.setOverlay(overlay === 'water' ? 'none' : 'water')}
        >
          <span>
            <AdobeIcon id="water" size={20} /> {t.water}
          </span>
          <strong>{stats.water.demand > 0 ? percent(stats.water.served) : t.noDemand}</strong>
          <small>
            {t.supplyDemand}: {supply(stats.water.supply, stats.water.demand)}
          </small>
        </button>
        <button
          type="button"
          className="oasis-resource"
          data-testid="oasis-shade"
          aria-pressed={overlay === 'data'}
          onClick={() => session.setOverlay(overlay === 'data' ? 'none' : 'data')}
        >
          <span>
            <AdobeIcon id="shade" size={20} /> {t.shade}
          </span>
          <strong>{oasis.data.demand > 0 ? percent(oasis.data.served) : t.noDemand}</strong>
          <small>
            {t.supplyDemand}: {supply(oasis.data.supply, oasis.data.demand)}
          </small>
        </button>
        <button
          type="button"
          className="oasis-resource"
          data-testid="oasis-reserves"
          onClick={() => session.setTool('cistern')}
        >
          <span>
            <AdobeIcon id="cistern" size={20} /> {t.reserves}
          </span>
          <strong>{bankCount > 0 ? percent(oasis.cisterns.charge) : t.noCistern}</strong>
          <small>
            {t.cisterns}: {formatNumber(bankCount, locale)}
          </small>
        </button>
      </div>
      <OasisWaterPolicy session={session} />
      {oasis.parched > 0 && (
        <p className="oasis-stress" role="status" data-testid="oasis-stress">
          <AdobeIcon id="warning" size={20} />
          {t.parched}: {formatNumber(oasis.parched, locale)}
        </p>
      )}
    </aside>
  );
}
