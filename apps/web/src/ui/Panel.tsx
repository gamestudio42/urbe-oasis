import type { ReactNode } from 'react';
import { InterfaceIcon } from './interfaceIcons';

export function Panel({
  title,
  testId,
  onClose,
  closeLabel,
  className = '',
  children,
}: {
  title: string;
  testId: string;
  onClose: () => void;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${className}`} data-testid={testId} aria-label={title}>
      <header className="panel-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          data-testid={`${testId}-close`}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <InterfaceIcon id="close" fallback="×" />
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
