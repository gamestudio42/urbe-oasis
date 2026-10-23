import type { DisasterKind } from '@city/shared';
import type { ReactNode } from 'react';
import { useStrings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { LocaleSelect } from './LocaleSelect';
import { Panel } from './Panel';

const DISASTERS: DisasterKind[] = ['fire', 'flood', 'earthquake', 'crisis', 'blackout', 'epidemic'];

export function SystemPanel({ session, children }: { session: GameSession; children?: ReactNode }) {
  const t = useStrings(session.ui);
  const grid = useStore(session.ui, (s) => s.grid);
  const underground = useStore(session.ui, (s) => s.underground);
  const muted = useStore(session.ui, (s) => s.muted);
  const music = useStore(session.ui, (s) => s.music);
  const animations = useStore(session.ui, (s) => s.animations);
  const disastersEnabled = useStore(session.ui, (s) => s.stats?.disastersEnabled ?? true);
  const s = t.system;
  const trigger = async (disaster: DisasterKind) => {
    const result = await session.client.command({ type: 'triggerDisaster', disaster });
    if (!result.ok) session.toast('warning', s.cannotTrigger);
  };
  return (
    <Panel
      title={s.title}
      testId="system-panel"
      onClose={() => session.closePanel()}
      closeLabel={t.ui.close}
      className="system-panel"
    >
      {children}
      <h3>{s.disasters}</h3>
      <label className="check-row">
        <input
          type="checkbox"
          checked={disastersEnabled}
          onChange={(e) =>
            void session.command({ type: 'setDisasters', enabled: e.target.checked })
          }
          data-testid="disasters-enabled"
        />
        {s.randomDisasters}
      </label>
      <p className="muted small">{s.trigger}</p>
      <div className="overlay-grid">
        {DISASTERS.map((d) => (
          <button
            key={d}
            type="button"
            className="button small"
            onClick={() => void trigger(d)}
            data-testid={`trigger-${d}`}
          >
            {t.disasters[d]}
          </button>
        ))}
      </div>
      <h3>{s.settings}</h3>
      <LocaleSelect session={session} label={s.language} />
      <label className="check-row">
        <input type="checkbox" checked={grid} onChange={(e) => session.setGrid(e.target.checked)} />
        {s.grid}
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={underground}
          onChange={(e) => session.setUnderground(e.target.checked)}
          data-testid="underground-enabled"
        />
        {s.underground}
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={!muted}
          onChange={(e) => session.setMuted(!e.target.checked)}
          data-testid="sound-enabled"
        />
        {s.sound}
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={music}
          disabled={muted}
          onChange={(e) => session.setMusic(e.target.checked)}
          data-testid="music-enabled"
        />
        {s.music}
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={animations}
          onChange={(e) => session.setAnimations(e.target.checked)}
          data-testid="animations-enabled"
        />
        {s.animations}
      </label>
      <p className="muted small">{s.help}</p>
      <button
        type="button"
        className="button"
        onClick={() => {
          if (window.confirm(s.confirmLeave)) void session.backToMenu();
        }}
        data-testid="back-to-menu"
      >
        {s.newGame}
      </button>
    </Panel>
  );
}
