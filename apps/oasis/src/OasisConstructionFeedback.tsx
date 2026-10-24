import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PLACEABLE_SPECS, type PlaceableKind } from '@city/shared';
import { formatMoney, formatNumber, useStrings } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { toolById } from '@oasis/web/tools/tools';
import { ToolTooltip } from '@oasis/web/ui/ToolTooltip';
import { ToolIcon } from '@oasis/web/ui/icons';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import { oasisConstructionCopy } from './i18n';

/** The shared planner owns validity and cost; this card only explains its result. */
export function OasisToolPreview({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const preview = useStore(session.ui, (s) => s.preview);
  const pointer = useStore(session.ui, (s) => s.pointer);
  const toolId = useStore(session.ui, (s) => s.tool);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset);
  const node = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 64 });
  const copy = oasisConstructionCopy(locale);

  useLayoutEffect(() => {
    const card = node.current;
    if (!card || !pointer) return;
    const positionCard = () => {
      const rect = card.getBoundingClientRect();
      const app = card.closest<HTMLElement>('.app');
      const dock = app
        ? Number.parseFloat(getComputedStyle(app).getPropertyValue('--oasis-construction-top'))
        : NaN;
      const bottom = Math.min(
        window.innerHeight - 8,
        Number.isFinite(dock)
          ? dock + (app?.getBoundingClientRect().top ?? 0) - 8
          : window.innerHeight - 8,
      );
      const left =
        pointer.x + 18 + rect.width <= window.innerWidth - 8
          ? pointer.x + 18
          : pointer.x - rect.width - 18;
      const top =
        pointer.y + 18 + rect.height <= bottom ? pointer.y + 18 : pointer.y - rect.height - 18;
      setPosition({
        left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)),
        top: Math.max(window.innerWidth <= 720 ? 164 : 64, Math.min(top, bottom - rect.height)),
      });
    };
    positionCard();
    const observer = new ResizeObserver(positionCard);
    observer.observe(card);
    const dock = card.closest('.app')?.querySelector('.oasis-construction');
    if (dock) observer.observe(dock);
    window.addEventListener('resize', positionCard);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', positionCard);
    };
  }, [pointer, preview, locale, toolId, ruleset]);

  if (ruleset !== 'oasis') return <ToolTooltip session={session} />;
  if (!preview || !pointer) return null;
  const tool = toolById(toolId);
  const noChange =
    !preview.ok && (preview.reason === 'ALREADY_BUILT' || preview.reason === 'NOTHING_TO_DO');
  const status = !preview.ok
    ? noChange
      ? copy.noChange
      : copy.blocked
    : preview.skipped > 0
      ? copy.partial
      : copy.ready;
  const showReason = preview.reason && !(preview.ok && preview.reason === 'ALREADY_BUILT');
  return (
    <div
      ref={node}
      className={`tool-tooltip oasis-tool-preview${preview.ok ? '' : ' bad'}`}
      style={position}
      data-testid="tool-tooltip"
      data-state={preview.ok ? 'ready' : 'blocked'}
    >
      <header>
        <ToolIcon id={toolId} style="adobe" />
        <strong className="tool-tooltip-title">{t.tools[toolId]}</strong>
        {tool.shape === 'footprint' && (
          <small>
            {tool.size} × {tool.size}
          </small>
        )}
      </header>
      <div className="construction-plan-state">
        <AdobeIcon id={preview.ok ? 'check' : 'warning'} size={16} /> {status}
      </div>
      <dl>
        <div>
          <dt>{copy.estimate}</dt>
          <dd data-testid="construction-estimate">
            {!preview.ok && preview.reason !== 'INSUFFICIENT_FUNDS'
              ? '—'
              : preview.cost > 0
                ? formatMoney(preview.cost, locale)
                : t.ui.free}
          </dd>
        </div>
        {tool.shape !== 'footprint' && (
          <div>
            <dt>{copy.affected}</dt>
            <dd data-testid="construction-affected">{formatNumber(preview.count, locale)}</dd>
          </div>
        )}
        {preview.unchanged > 0 && (
          <div>
            <dt>{copy.existing}</dt>
            <dd data-testid="construction-existing">{formatNumber(preview.unchanged, locale)}</dd>
          </div>
        )}
        {preview.skipped > preview.unchanged && (
          <div>
            <dt>{copy.excluded}</dt>
            <dd>{formatNumber(preview.skipped - preview.unchanged, locale)}</dd>
          </div>
        )}
      </dl>
      {showReason && preview.reason && (
        <p className="tool-tooltip-reason">
          {t.reasons[preview.reason]}
          {preview.reason === 'LOCKED' &&
            toolId in PLACEABLE_SPECS &&
            ` ${t.hud.unlockAt(formatNumber(PLACEABLE_SPECS[toolId as PlaceableKind].minPopulation, locale))}`}
        </p>
      )}
      <footer>
        {!preview.ok
          ? copy.adjust
          : preview.dragging
            ? copy.release
            : tool.shape === 'footprint'
              ? copy.place
              : copy.drag}
      </footer>
    </div>
  );
}

/** Actual worker results, including partial application; never predicted success. */
export function OasisConstructionReceipt({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const feedback = useStore(session.ui, (s) => s.constructionFeedback);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset);
  const copy = oasisConstructionCopy(locale);
  useEffect(() => {
    if (!feedback || feedback.phase === 'pending') return;
    const timer = setTimeout(() => {
      if (session.ui.get().constructionFeedback?.id === feedback.id)
        session.ui.set({ constructionFeedback: null });
    }, 7000);
    return () => clearTimeout(timer);
  }, [feedback, session]);
  if (!feedback || ruleset !== 'oasis') return null;
  const result = feedback.phase === 'complete' ? feedback.result : null;
  const title =
    feedback.phase === 'pending'
      ? copy.pending
      : feedback.phase === 'failed'
        ? copy.failed
        : result?.ok
          ? copy.applied
          : copy.refused;
  return (
    <div
      className="construction-receipt"
      data-testid="construction-receipt"
      data-phase={feedback.phase}
      data-ok={result?.ok}
    >
      <div role="status" aria-live="polite" aria-atomic="true">
        <div className="construction-receipt-heading">
          <AdobeIcon id={result?.ok ? 'check' : 'warning'} size={18} />
          <strong>{title}</strong>
          <span>{t.tools[feedback.tool]}</span>
        </div>
        {result && (
          <p>
            <span>
              {copy.spent}:{' '}
              <b data-testid="construction-spent">{formatMoney(result.cost, locale)}</b>
            </span>
            <span>
              {copy.affected}:{' '}
              <b data-testid="construction-applied">{formatNumber(result.applied, locale)}</b>
            </span>
            {result.skipped > 0 && (
              <span>
                {copy.skipped}:{' '}
                <b data-testid="construction-skipped">{formatNumber(result.skipped, locale)}</b>
              </span>
            )}
          </p>
        )}
        {result?.reason && (
          <p className="construction-receipt-reason">{t.reasons[result.reason]}</p>
        )}
        {feedback.phase === 'failed' && <p>{copy.checkMap}</p>}
      </div>
      <button
        type="button"
        aria-label={t.ui.close}
        data-testid="construction-receipt-close"
        onClick={() => session.ui.set({ constructionFeedback: null })}
      >
        <AdobeIcon id="close" size={18} />
      </button>
    </div>
  );
}
