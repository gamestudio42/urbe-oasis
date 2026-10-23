export function PauseOverlay({
  paused,
  title,
  hint,
}: {
  paused: boolean;
  title: string;
  hint: string;
}) {
  if (!paused) return null;
  return (
    <div className="pause-overlay" data-testid="pause-overlay" aria-live="polite">
      <div className="paused-banner" role="status">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>
    </div>
  );
}
