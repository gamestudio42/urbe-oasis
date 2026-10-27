import { useStrings, type Strings } from '../i18n';
import { isGoodOverlay, type OverlayMode } from '@view/city';
import { color, cssColor, goodColor, heatColor, type Theme } from '@theme/core';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

const MODES: OverlayMode[] = [
  'none',
  'power',
  'water',
  'data',
  'traffic',
  'pollution',
  'crime',
  'landValue',
  'access',
  'police',
  'fireCover',
  'health',
  'education',
];

export { cssColor };

function gradient(scale: (v: number) => number): string {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((v) => `${cssColor(scale(v))} ${v * 100}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function Legend({ mode, t, theme }: { mode: OverlayMode; t: Strings; theme: Theme }) {
  const o = t.overlayPanel;
  if (mode === 'none') return null;
  if (mode === 'power' || mode === 'water' || mode === 'data') {
    const on = color(
      theme,
      mode === 'power' ? 'overlay.powerOn' : mode === 'water' ? 'overlay.waterOn' : 'overlay.dataOn',
    );
    const off = color(theme, 'overlay.unserved');
    return (
      <div className="legend" data-testid="overlay-legend">
        <span className="swatch" style={{ background: cssColor(on) }} /> {o.served}
        <span className="swatch" style={{ background: cssColor(off) }} /> {o.unserved}
      </div>
    );
  }
  return (
    <div className="legend" data-testid="overlay-legend">
      <span>{o.low}</span>
      <span
        className="legend-bar"
        style={{
          background: gradient(isGoodOverlay(mode) ? (v) => goodColor(theme, v) : (v) => heatColor(theme, v)),
        }}
      />
      <span>{o.high}</span>
    </div>
  );
}

export function OverlayPanel({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const overlay = useStore(session.ui, (s) => s.overlay);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset ?? 'classic');
  const modes = ruleset === 'oasis' ? MODES : MODES.filter((mode) => mode !== 'data');
  const theme = session.renderer.theme;
  return (
    <Panel
      title={t.overlayPanel.title}
      testId="overlay-panel"
      onClose={() => session.closePanel()}
      closeLabel={t.ui.close}
      className="overlay-panel"
    >
      <div className="overlay-grid">
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`button ${overlay === mode ? 'active' : ''}`}
            onClick={() => session.setOverlay(mode)}
            aria-pressed={overlay === mode}
            data-testid={`overlay-${mode}`}
          >
            {t.overlays[mode]}
          </button>
        ))}
      </div>
      <Legend mode={overlay} t={t} theme={theme} />
    </Panel>
  );
}
