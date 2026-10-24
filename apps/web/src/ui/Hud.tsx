import type { RciValues, Speed } from '@city/shared';
import type { ReactNode } from 'react';
import { formatMoney, formatNumber, months, useStrings } from '../i18n';
import type { GameSession, PanelId } from '../state/session';
import { useStore } from '../state/store';
import { InterfaceIcon } from './interfaceIcons';
import type { AdobeControlId } from './adobeIcons';

const SPEEDS: Speed[] = [0, 1, 2, 3];
const SPEED_ICONS = ['❚❚', '▶', '▶▶', '▶▶▶'] as const;
const ADOBE_SPEEDS = ['pause', 'play', 'fast', 'fastest'] as const;
const PANEL_ICONS: Record<PanelId, AdobeControlId> = {
  budget: 'budget',
  charts: 'charts',
  overlays: 'layers',
  system: 'settings',
};

export function Hud({ session, credit }: { session: GameSession; credit?: ReactNode }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const stats = useStore(session.ui, (s) => s.stats);
  const speed = useStore(session.ui, (s) => s.speed);
  const panel = useStore(session.ui, (s) => s.panel);
  if (!stats) return null;
  const h = t.hud;
  const monthNames = months(locale);
  const net = stats.lastMonth.net;
  const panelButton = (id: PanelId, label: string) => (
    <button
      type="button"
      className={`button hud-button ${panel === id ? 'active' : ''}`}
      onClick={() => session.togglePanel(id)}
      data-testid={`open-${id}`}
      aria-pressed={panel === id}
    >
      <InterfaceIcon id={PANEL_ICONS[id]} />
      {label}
    </button>
  );

  return (
    <header className="hud" data-testid="hud">
      <div className="hud-city">
        <strong data-testid="city-name">{stats.name}</strong>
        <span className="muted" data-testid="date">
          {stats.day} {monthNames[stats.month]} {stats.year}
        </span>
      </div>
      <div className={`hud-stat ${stats.funds < 0 ? 'bad' : ''}`} title={h.funds}>
        <span className="hud-label">{h.funds}</span>
        <span data-testid="funds">{formatMoney(stats.funds, locale)}</span>
        <span className={`hud-delta ${net < 0 ? 'bad' : 'good'}`}>
          {net >= 0 ? '+' : ''}
          {formatMoney(net, locale)}
          {h.perMonth}
        </span>
        {stats.bankrupt && <span className="badge bad">{h.bankrupt}</span>}
        {!stats.bankrupt && stats.monthsInDebt > 0 && <span className="badge warn">{h.debt}</span>}
      </div>
      <div className="hud-stat" title={h.population}>
        <span className="hud-label">{h.population}</span>
        <span data-testid="population">{formatNumber(stats.population, locale)}</span>
      </div>
      {stats.oasis?.spring && (
        <div className="hud-stat" data-testid="spring" title={h.spring}>
          <span className="hud-label">{h.spring}</span>
          <span>
            {stats.oasis.spring.x},{stats.oasis.spring.y}
          </span>
        </div>
      )}
      <RciBars demand={stats.demand} session={session} />
      {(stats.activeFires > 0 || stats.disasters.length > 0) && (
        <div className="hud-alerts" data-testid="hud-alerts">
          {stats.activeFires > 0 && (
            <span className="badge bad" data-testid="hud-fires">
              {h.fires(stats.activeFires)}
            </span>
          )}
          {stats.disasters.map((d) => (
            <span key={d.kind} className="badge warn">
              {t.disasters[d.kind]}
            </span>
          ))}
        </div>
      )}
      <div className="speed-controls" role="group" aria-label={h.speed}>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`button speed-button ${speed === s ? 'active' : ''}`}
            onClick={() => session.setSpeed(s)}
            title={h.speeds[s]}
            aria-label={h.speeds[s]}
            aria-pressed={speed === s}
            data-testid={`speed-${s}`}
          >
            <InterfaceIcon id={ADOBE_SPEEDS[s]} fallback={SPEED_ICONS[s]} />
          </button>
        ))}
      </div>
      <nav className="hud-panels">
        {panelButton('budget', h.budget)}
        {panelButton('charts', h.charts)}
        {panelButton('overlays', h.overlays)}
        {panelButton('system', h.menu)}
      </nav>
      {credit}
    </header>
  );
}

const RCI_KEYS = [
  ['residential', 'R', 'var(--res)'],
  ['commercial', 'C', 'var(--com)'],
  ['industrial', 'I', 'var(--ind)'],
] as const;

export function RciBars({ demand, session }: { demand: RciValues; session: GameSession }) {
  const t = useStrings(session.ui);
  return (
    <div className="rci" data-testid="rci" title={t.hud.demand}>
      {RCI_KEYS.map(([key, letter, color]) => {
        const v = Math.max(-1, Math.min(1, demand[key]));
        const height = `${Math.abs(v) * 50}%`;
        return (
          <div key={key} className="rci-column" title={`${t.zones[key]}: ${Math.round(v * 100)}%`}>
            <div className="rci-track">
              <div
                className="rci-bar"
                data-testid={`rci-${key}`}
                data-value={v.toFixed(2)}
                style={{
                  height,
                  background: color,
                  bottom: v >= 0 ? '50%' : undefined,
                  top: v < 0 ? '50%' : undefined,
                  opacity: v < 0 ? 0.55 : 1,
                }}
              />
            </div>
            <span className="rci-letter">{letter}</span>
          </div>
        );
      })}
    </div>
  );
}
