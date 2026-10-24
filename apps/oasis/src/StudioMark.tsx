const STUDIO_URL = 'https://gamestudio42.github.io/';
const MARK_URL = `${import.meta.env.BASE_URL}studio-badge.svg`;

/** Original studio seal, colored by the Oasis interface theme. */
export function StudioMark({ placement }: { placement: 'boot' | 'menu' | 'play' }) {
  const named = placement !== 'play';
  return (
    <a
      className={`studio-mark studio-mark-${placement}`}
      href={STUDIO_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Game Studio 42"
      data-testid={placement === 'boot' ? undefined : 'studio-mark'}
    >
      <svg viewBox="0 0 64 64" width={named ? 28 : 30} height={named ? 28 : 30} aria-hidden="true">
        <use href={`${MARK_URL}#studio-seal`} />
      </svg>
      {named ? <span>Game Studio 42</span> : null}
    </a>
  );
}
