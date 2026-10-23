import type { ReactNode } from 'react';

export function BootView({
  stepLabel,
  progress,
  leaving = false,
  step,
  testId = 'boot-screen',
  children,
  footer,
}: {
  stepLabel: string;
  progress: number;
  leaving?: boolean;
  step?: string;
  testId?: string;
  children?: ReactNode;
  /** Optional credit under the progress bar. Reskins use it for the studio mark. */
  footer?: ReactNode;
}) {
  const percent = Math.round(progress * 100);
  return (
    <div
      className={`boot-screen${leaving ? ' leaving' : ''}`}
      data-testid={testId}
      data-step={step}
      aria-busy={!leaving}
    >
      {children}
      <p className="boot-step" data-testid="boot-step">
        {stepLabel}
      </p>
      <div
        className="boot-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="boot-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {footer}
    </div>
  );
}
