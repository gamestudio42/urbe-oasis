/** Brand lockup: a mark (usually the app favicon) and the wordmark. */
export function Logo({
  size = 56,
  title,
  markUrl,
}: {
  size?: number;
  title: string;
  markUrl: string;
}) {
  return (
    <span className="logo" aria-label={title} role="img">
      <img className="logo-mark" src={markUrl} width={size} height={size} alt="" />
      <span className="logo-word" aria-hidden="true">
        {title.toUpperCase()}
      </span>
    </span>
  );
}
