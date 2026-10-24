import { useStrings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { InterfaceIcon } from './interfaceIcons';

/** Speaker and music note, stacked on the city, below the bar. */
export function CityAudio({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const muted = useStore(session.ui, (s) => s.muted);
  const music = useStore(session.ui, (s) => s.music);
  const soundLabel = muted ? t.menu.soundOff : t.menu.soundOn;
  const musicLabel = music ? t.menu.musicOn : t.menu.musicOff;

  return (
    <div className="city-audio">
      <button
        type="button"
        className="button menu-sound"
        onClick={() => session.setMuted(!muted)}
        title={soundLabel}
        aria-label={soundLabel}
        aria-pressed={!muted}
        data-testid="hud-sound"
      >
        <InterfaceIcon id={muted ? 'mute' : 'sound'} fallback={<SpeakerIcon muted={muted} />} />
      </button>
      <button
        type="button"
        className="button menu-sound"
        onClick={() => session.setMusic(!music)}
        title={musicLabel}
        aria-label={musicLabel}
        aria-pressed={music}
        disabled={muted}
        data-testid="hud-music"
      >
        <InterfaceIcon id={music ? 'music' : 'musicOff'} fallback={<NoteIcon off={!music} />} />
      </button>
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
  );
}

function NoteIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
      {off ? (
        <path d="M5 19L19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
