import { useState } from 'react';
import { dateOf } from '@city/simulation';
import type { OasisMoment } from '@view/city';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { months, useStrings } from '@oasis/web/i18n';
import type { ToolId } from '@oasis/web/tools/tools';
import { oasisCopy } from './i18n';

function presentation(event: OasisMoment): {
  key: 'storm' | 'blocked' | 'spring' | 'trade' | 'leave' | 'stress' | 'collapse';
  tool?: ToolId;
} {
  switch (event.type) {
    case 'sandstorm':
      return { key: event.blocked ? 'blocked' : 'storm', tool: 'windbreak' };
    case 'springMoved':
      return { key: 'spring', tool: 'springHouse' };
    case 'caravanTrade':
      return { key: 'trade' };
    case 'caravanLeave':
      return { key: 'leave', tool: 'pipe' };
    case 'waterStress':
      return { key: 'stress', tool: 'cistern' };
    case 'canalCollapse':
      return { key: 'collapse', tool: 'qanat' };
  }
}

/** A durable report of observed events, never a prediction or a second simulation. */
export function OasisChronicle({ session }: { session: GameSession }) {
  const revision = useStore(session.ui, (s) => s.cityRevision);
  return <OasisReports key={revision} session={session} />;
}

function OasisReports({ session }: { session: GameSession }) {
  const entries = useStore(session.ui, (s) => s.oasisDispatches);
  const locale = useStore(session.ui, (s) => s.locale);
  const stats = useStore(session.ui, (s) => s.stats);
  const panel = useStore(session.ui, (s) => s.panel);
  const t = useStrings(session.ui);
  const copy = oasisCopy(locale).chronicle;
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<number | null>(null);
  if (stats?.ruleset !== 'oasis' || panel !== null) return null;
  const entry = entries.find((e) => e.id === selected) ?? entries[0];
  const visible = entry && (collapsed !== entries[0]?.id || history);
  const view = entry ? presentation(entry.event) : null;
  const date = entry ? dateOf(entry.tick) : null;
  const locate = () => {
    if (!entry) return;
    session.setUnderground(false);
    session.setTool('select');
    session.select({ x: entry.event.x, y: entry.event.y });
    session.renderer.centerOnTile(entry.event.x, entry.event.y);
  };
  return (
    <aside className="oasis-chronicle" data-testid="oasis-chronicle" aria-label={copy.title}>
      <button
        type="button"
        className="chronicle-toggle"
        data-testid="chronicle-history"
        aria-expanded={history}
        onClick={() => {
          setHistory(!history);
          setSelected(null);
        }}
      >
        <span>{copy.title}</span>
        <span>
          {entries.length > 0 ? entries.length : '◇'} {history ? '−' : '+'}
        </span>
      </button>
      {visible && view && (
        <article
          className={`chronicle-report chronicle-${view.key}`}
          data-testid="chronicle-report"
          data-kind={view.key}
        >
          <div className="chronicle-art" aria-hidden="true">
            <svg viewBox="0 0 300 74" fill="none">
              <path
                d="M-20 70 Q45 8 120 55 T320 22 L320 90 H-20Z"
                fill="currentColor"
                opacity=".16"
              />
              <path d="M-20 80 Q80 22 160 62 T320 42" stroke="currentColor" opacity=".35" />
              <path
                d="M38 27H158Q180 27 180 16Q180 6 170 9 M75 40H215Q239 40 237 27 M125 53H262"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="44" cy="43" r="2" fill="currentColor" />
              <circle cx="244" cy="15" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="chronicle-copy">
            <div className="chronicle-meta">
              <span>
                {date?.day} {date && months(locale)[date.month]} {date?.year}
              </span>
              <button
                type="button"
                data-testid="chronicle-close"
                aria-label={copy.close}
                onClick={() => {
                  setCollapsed(entries[0]?.id ?? null);
                  setHistory(false);
                  setSelected(null);
                }}
              >
                ×
              </button>
            </div>
            <h3 aria-live="polite">{copy[view.key].title}</h3>
            <p>{copy[view.key].body}</p>
            {entry.count > 1 && (
              <p className="chronicle-count">
                {copy.lots}: {entry.count}
              </p>
            )}
            <div className="chronicle-actions">
              <button
                className="button small"
                type="button"
                data-testid="chronicle-locate"
                onClick={locate}
              >
                {copy.locate} ↗
              </button>
              {view.tool && (
                <button
                  className="button small"
                  type="button"
                  data-testid="chronicle-tool"
                  onClick={() => {
                    locate();
                    session.setTool(view.tool!);
                  }}
                >
                  {t.tools[view.tool]}
                </button>
              )}
            </div>
          </div>
        </article>
      )}
      {history && (
        <div className="chronicle-history" data-testid="chronicle-entries">
          <p>{copy.history}</p>
          {entries.length === 0 && <p>{copy.empty}</p>}
          {entries.map((e) => (
            <button
              type="button"
              key={e.id}
              data-testid={`chronicle-entry-${e.id}`}
              aria-pressed={entry?.id === e.id}
              onClick={() => {
                setSelected(e.id);
                setCollapsed(null);
              }}
            >
              <span>{copy[presentation(e.event).key].title}</span>
              <small>
                {e.event.x}, {e.event.y}
              </small>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
