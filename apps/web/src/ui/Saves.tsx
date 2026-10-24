import { OASIS_SAVE_FILE_EXTENSION, SAVE_FILE_EXTENSION } from '@city/shared';
import { dateOf } from '@city/simulation';
import { useRef } from 'react';
import { formatMoney, formatNumber, intlLocale, months, useStrings, type Locale } from '../i18n';
import type { SaveSlot } from '../persistence/saves';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { InterfaceIcon } from './interfaceIcons';

/** Button that opens a file picker and loads the chosen save file. */
export function ImportFileButton({
  session,
  label,
  testId,
}: {
  session: GameSession;
  label: string;
  testId: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useStore(session.ui, (s) => s.busy);
  const extension = session.ruleset === 'oasis' ? OASIS_SAVE_FILE_EXTENSION : SAVE_FILE_EXTENSION;
  return (
    <>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        data-testid={testId}
      >
        <InterfaceIcon id="import" />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={`${extension},.json,application/json`}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void session.importFile(file);
        }}
        data-testid={`${testId}-input`}
      />
    </>
  );
}

function slotDate(slot: SaveSlot, locale: Locale): string {
  const game = dateOf(slot.tick);
  const real = slot.savedAt ? new Date(slot.savedAt) : null;
  const saved =
    real && !Number.isNaN(real.getTime())
      ? real.toLocaleString(intlLocale(locale), { dateStyle: 'short', timeStyle: 'short' })
      : '';
  return `${months(locale)[game.month]} ${game.year}${saved ? ` · ${saved}` : ''}`;
}

/** Main-menu block: continue the latest city, open a file, or pick a saved city. */
export function SavedCities({
  session,
  showContinue = true,
}: {
  session: GameSession;
  /** The launcher menu shows its own, larger continue card. */
  showContinue?: boolean;
}) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const saves = useStore(session.ui, (s) => s.saves);
  const busy = useStore(session.ui, (s) => s.busy);
  const m = t.menu;
  const latest = saves[0];
  return (
    <section className="saved-cities" data-testid="saved-cities">
      <div className="menu-actions">
        {showContinue && latest && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void session.continueLatest()}
            data-testid="continue"
          >
            <InterfaceIcon id="play" />
            {m.continue}: {latest.name}
          </button>
        )}
        <ImportFileButton session={session} label={m.load} testId="import-file" />
      </div>
      <h3>{m.savedCities}</h3>
      {saves.length === 0 ? (
        <p className="muted small">{m.noSaves}</p>
      ) : (
        <ul className="save-list">
          {saves.map((slot) => (
            <li key={slot.id} data-testid="save-slot" data-slot={slot.id}>
              <div className="save-info">
                <strong>{slot.name}</strong>
                {slot.autosave && <span className="badge auto">{t.save.autosave}</span>}
                <div className="muted small">
                  {slotDate(slot, locale)} ·{' '}
                  {t.save.slotInfo(
                    formatNumber(slot.population, locale),
                    formatMoney(slot.funds, locale),
                  )}
                </div>
              </div>
              <button
                type="button"
                className="button small"
                disabled={busy}
                onClick={() => void session.loadSlot(slot.id)}
                data-testid="load-slot"
              >
                {t.save.load}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={t.save.delete}
                title={t.save.delete}
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t.save.confirmDelete(slot.name)))
                    void session.deleteSlot(slot.id);
                }}
                data-testid="delete-slot"
              >
                <InterfaceIcon id="close" fallback="×" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** In-game save controls for the system panel. */
export function SaveControls({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const busy = useStore(session.ui, (s) => s.busy);
  const s = t.save;
  return (
    <>
      <h3>{s.title}</h3>
      <div className="button-row">
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={() => void session.saveGame()}
          data-testid="save-now"
        >
          <InterfaceIcon id="save" />
          {s.saveNow}
        </button>
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void session.exportFile()}
          data-testid="export-file"
        >
          <InterfaceIcon id="export" />
          {s.exportFile}
        </button>
        <ImportFileButton session={session} label={s.importFile} testId="import-file-game" />
      </div>
      <p className="muted small">{s.autosaveHint}</p>
    </>
  );
}
