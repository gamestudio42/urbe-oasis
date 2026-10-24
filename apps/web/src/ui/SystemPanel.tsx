import type { DisasterKind } from '@city/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  const volumes = useStore(session.ui, (s) => s.volumes);
  const animations = useStore(session.ui, (s) => s.animations);
  const disastersEnabled = useStore(session.ui, (s) => s.stats?.disastersEnabled ?? true);
  const s = t.system;
  const [pending, setPending] = useState<DisasterKind | null>(null);
  const [triggering, setTriggering] = useState(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const triggerButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (pending) cancelButton.current?.focus();
    else triggerButton.current?.focus({ preventScroll: true });
  }, [pending]);
  const trigger = async (disaster: DisasterKind) => {
    setTriggering(true);
    try {
      const result = await session.client.command({ type: 'triggerDisaster', disaster });
      if (!result.ok) session.toast('warning', s.cannotTrigger);
      setPending(null);
    } catch {
      session.toast('warning', s.cannotTrigger);
    } finally {
      setTriggering(false);
    }
  };
  return (
    <Panel
      title={s.title}
      testId="system-panel"
      onClose={() => session.closePanel()}
      closeLabel={t.ui.close}
      className="system-panel"
    >
      <div className="management-section save-section">{children}</div>
      <section className="management-section">
        <h3>{s.settings}</h3>
        <LocaleSelect session={session} label={s.language} />
        <h4>{s.display}</h4>
        <label className="check-row">
          <input
            type="checkbox"
            checked={grid}
            onChange={(e) => session.setGrid(e.target.checked)}
          />
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
            checked={animations}
            onChange={(e) => session.setAnimations(e.target.checked)}
            data-testid="animations-enabled"
          />
          {s.animations}
        </label>
        <h4>{s.audio}</h4>
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
        {session.ruleset === 'oasis' && (
          <fieldset className="volume-fields" data-testid="volume-fields" disabled={muted}>
            <legend>{s.volume}</legend>
            {(
              [
                ['master', s.volumeMaster],
                ['music', s.volumeMusic],
                ['effects', s.volumeEffects],
              ] as const
            ).map(([bus, label]) => (
              <label key={bus} className="field slider-field">
                <span>
                  {label} <output>{Math.round(volumes[bus] * 100)}%</output>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(volumes[bus] * 100)}
                  data-testid={`volume-${bus}`}
                  onChange={(e) => session.setVolume(bus, Number(e.target.value) / 100)}
                />
              </label>
            ))}
          </fieldset>
        )}
      </section>
      <details className="management-section" data-testid="system-shortcuts">
        <summary>{s.shortcuts}</summary>
        <p className="muted small">{s.help}</p>
      </details>
      <details
        className="management-section scenario-section"
        data-testid="system-scenarios"
        onToggle={(event) => {
          if (!event.currentTarget.open) setPending(null);
        }}
      >
        <summary>{s.advanced}</summary>
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
              disabled={triggering}
              onClick={(event) => {
                triggerButton.current = event.currentTarget;
                setPending(d);
              }}
              data-testid={`trigger-${d}`}
            >
              {t.disasters[d]}
            </button>
          ))}
        </div>

        {pending && (
          <div
            className="scenario-confirmation"
            role="group"
            aria-label={s.confirm}
            data-testid="scenario-confirmation"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (!triggering) setPending(null);
              }
            }}
          >
            <strong>{t.disasters[pending]}</strong>
            <p>{s.confirmDisaster}</p>
            <div className="button-row">
              <button
                ref={cancelButton}
                type="button"
                className="button"
                onClick={() => setPending(null)}
                disabled={triggering}
                data-testid="cancel-disaster"
              >
                {s.cancel}
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => void trigger(pending)}
                disabled={triggering}
                data-testid="confirm-disaster"
              >
                {s.confirm}
              </button>
            </div>
          </div>
        )}
      </details>
      <div className="system-actions">
        <button
          type="button"
          className="button primary"
          data-testid="return-to-city"
          onClick={() => session.closePanel()}
        >
          {s.returnToCity}
        </button>
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
      </div>
    </Panel>
  );
}
