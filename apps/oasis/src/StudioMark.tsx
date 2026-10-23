const STUDIO_URL = 'https://gamestudio42.github.io/';
const MARK_URL = `${import.meta.env.BASE_URL}studio-badge.svg`;

/** Game Studio 42 credit. The game mark stays the neon skyline; this is the studio seal. */
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
      <img src={MARK_URL} alt="" width={named ? 28 : 30} height={named ? 28 : 30} />
      {named ? <span>Game Studio 42</span> : null}
    </a>
  );
}
