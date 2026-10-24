import { useLayoutEffect, useRef, type ReactNode } from 'react';
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
  const close = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = panel.current;
    const previous = document.activeElement;
    close.current?.focus({ preventScroll: true });
    return () => {
      if (
        node?.contains(document.activeElement) &&
        previous instanceof HTMLElement &&
        previous.isConnected
      ) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <section
      ref={panel}
      className={`panel ${className}`}
      data-testid={testId}
      aria-label={title}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="panel-header">
        <h2>{title}</h2>
        <button
          ref={close}
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
