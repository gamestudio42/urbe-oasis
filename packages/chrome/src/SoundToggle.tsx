import type { ReactNode } from 'react';

/** Speaker button used on menus that have no system panel. */
export function SoundToggle({
  muted,
  onToggle,
  soundOn,
  soundOff,
  icon,
}: {
  muted: boolean;
  onToggle: () => void;
  soundOn: string;
  soundOff: string;
  icon?: ReactNode;
}) {
  const label = muted ? soundOff : soundOn;
  return (
    <button
      type="button"
      className="button menu-sound"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={!muted}
      data-testid="menu-sound"
    >
      {icon ?? (
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {muted ? (
            <path
              d="M16 9l5 6M21 9l-5 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
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
      )}
    </button>
  );
}
