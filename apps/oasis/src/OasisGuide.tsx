import { useId, useRef, useState } from 'react';
import { TICKS_PER_MONTH } from '@city/shared';
import { formatMoney, formatNumber, useStrings } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { OASIS_TUTORIAL_TOOLS, tutorialChecks } from '@oasis/web/state/tutorial';
import { toolById, type ToolId } from '@oasis/web/tools/tools';
import { costLabel } from '@oasis/web/ui/Toolbar';
import { Tutorial } from '@oasis/web/ui/Tutorial';
import { ToolIcon } from '@oasis/web/ui/icons';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import { oasisCopy, oasisGuideCopy } from './i18n';
import { OasisJourney, journeyHeading } from './OasisJourney';

/** Presentation goals observe current telemetry; they grant no rewards or unlocks. */
export function OasisGuide({ session }: { session: GameSession }) {
  const step = useStore(session.ui, (s) => s.tutorial);
  const revision = useStore(session.ui, (s) => s.cityRevision);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset);
  const chapter = useStore(session.ui, (s) => s.stats?.oasis?.journey?.chapter ?? -1);
  if (ruleset !== 'oasis') return <Tutorial session={session} />;
  // A new chapter remounts the card so its heading is announced again.
  return (
    <GuideCard key={`${revision}:${step ?? 'goals'}:${chapter}`} session={session} step={step} />
  );
}

function GuideCard({ session, step }: { session: GameSession; step: number | null }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const speed = useStore(session.ui, (s) => s.speed);
  const active = useStore(session.ui, (s) => s.tool);
  const overlay = useStore(session.ui, (s) => s.overlay);
  const panel = useStore(session.ui, (s) => s.panel);
  const selected = useStore(session.ui, (s) => s.selected);
  const stats = useStore(session.ui, (s) => s.stats);
  const [expanded, setExpanded] = useState(step !== null);
  const toggle = useRef<HTMLButtonElement>(null);
  const bodyId = useId();
  const titleId = useId();
  const copy = oasisGuideCopy(locale);
  const oasis = oasisCopy(locale);
  if (!stats?.oasis || panel || selected) return null;
  const content = step === null ? null : oasis.tutorial.steps[step];
  const last = step === oasis.tutorial.steps.length - 1;
  const tools = step === null ? [] : (OASIS_TUTORIAL_TOOLS[step] ?? []);
  const manual = step !== null && tutorialChecks('oasis')[step] === null;
  const selectTool = (id: ToolId) => {
    session.setTool(id);
    setExpanded(false);
    toggle.current?.focus({ preventScroll: true });
  };
  const network =
    step === 4 ? 'power' : step === 5 || step === 8 ? 'water' : step === 6 ? 'data' : null;
  const goals = [
    {
      id: 'residents',
      done: stats.population >= 100,
      value: `${formatNumber(stats.population, locale)} / 100`,
      tool: 'zoneResLight',
    },
    {
      id: 'reserves',
      done: stats.oasis.cisterns.banks > 0 && stats.oasis.cisterns.charge >= 0.5,
      value: `${formatNumber(stats.oasis.cisterns.charge * 100, locale)}% / 50%`,
      tool: 'cistern',
    },
    {
      id: 'budget',
      done: stats.tick >= TICKS_PER_MONTH && stats.population > 0 && stats.lastMonth.net >= 0,
      value: stats.tick >= TICKS_PER_MONTH ? formatMoney(stats.lastMonth.net, locale) : '—',
      tool: null,
    },
    {
      id: 'protection',
      done: stats.oasis.windbreak > 0,
      value: `${formatNumber(stats.oasis.windbreak * 100, locale)}%`,
      tool: 'windbreak',
    },
    {
      id: 'trade',
      done: stats.oasis.trade > 0,
      value: formatMoney(stats.oasis.trade, locale),
      tool: 'caravanserai',
    },
  ] as const;
  const journey = step === null ? stats.oasis.journey : undefined;
  const heading = journey ? journeyHeading(journey, locale) : null;
  const title = content?.title ?? heading?.title ?? copy.title;

  return (
    <aside
      className="oasis-guide"
      data-testid={step === null ? 'oasis-next-steps' : 'tutorial'}
      data-journey={journey ? journey.chapter : undefined}
      data-expanded={expanded}
      data-step={step}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !expanded) return;
        event.stopPropagation();
        setExpanded(false);
        toggle.current?.focus();
      }}
    >
      <header className="oasis-guide-header">
        <div aria-live="polite">
          <small>
            {step === null
              ? (heading?.small ?? oasis.survival.title)
              : `${oasis.tutorial.title} · ${step + 1}/${oasis.tutorial.steps.length}`}
          </small>
          <h3 id={titleId}>{title}</h3>
        </div>
        <button
          ref={toggle}
          type="button"
          className="oasis-guide-toggle"
          data-testid="oasis-guide-toggle"
          aria-label={expanded ? copy.collapse : copy.expand}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded(!expanded)}
        >
          <AdobeIcon id={expanded ? 'collapse' : 'expand'} size={20} />
        </button>
      </header>
      <div className="oasis-guide-body" id={bodyId} hidden={!expanded}>
        {step !== null && content ? (
          <>
            <p className="oasis-guide-action" data-testid="tutorial-action">
              {copy.steps[step]}
            </p>
            <div className="oasis-guide-tools">
              {tools.map((tool, index) => (
                <button
                  key={tool}
                  type="button"
                  data-testid={`tutorial-tool-${tool}`}
                  aria-pressed={active === tool}
                  className="oasis-guide-tool"
                  onClick={() => selectTool(tool)}
                >
                  <span className="oasis-guide-order" aria-hidden="true">
                    {index + 1}
                  </span>
                  <ToolIcon id={tool} style={session.renderer.theme.style} />
                  <span>
                    <strong>{t.tools[tool]}</strong>
                    <small>{costLabel(toolById(tool), t, locale)}</small>
                  </span>
                  {active === tool && <AdobeIcon id="check" size={16} />}
                </button>
              ))}
            </div>
            {step === 0 && (
              <button
                type="button"
                className="button small"
                data-testid="tutorial-focus-spring"
                onClick={() => session.focusSpring()}
              >
                <AdobeIcon id="spring" size={20} />
                {oasis.survival.focusSpring}
              </button>
            )}
            {network && (
              <button
                type="button"
                className="button small"
                data-testid="tutorial-coverage"
                aria-pressed={overlay === network}
                onClick={() => session.setOverlay(overlay === network ? 'none' : network)}
              >
                <AdobeIcon id="layers" size={20} />
                {network === 'water'
                  ? oasis.survival.water
                  : network === 'data'
                    ? oasis.survival.shade
                    : t.overlays.power}
              </button>
            )}
            {step === 7 && (
              <button
                type="button"
                className="button small"
                data-testid="tutorial-inspect"
                onClick={() => selectTool('select')}
              >
                <ToolIcon id="select" style={session.renderer.theme.style} />
                {t.tools.select}
              </button>
            )}
            <details className="oasis-guide-details" data-testid="tutorial-details">
              <summary data-testid="tutorial-details-toggle">{copy.details}</summary>
              <p>{content.text}</p>
            </details>
            {step > 0 && !last && speed === 0 && (
              <div className="oasis-guide-waiting">
                <p>{copy.waiting}</p>
                <button
                  type="button"
                  className="button small"
                  data-testid="tutorial-resume"
                  onClick={() => session.setSpeed(1)}
                >
                  <AdobeIcon id="play" size={16} />
                  {t.hud.speeds[1]}
                </button>
              </div>
            )}
            <footer className="oasis-guide-actions">
              <button
                type="button"
                className="button small"
                data-testid="tutorial-skip"
                onClick={() => session.skipTutorial()}
              >
                {t.tutorial.skip}
              </button>
              {(manual || last) && (
                <button
                  type="button"
                  className="button primary small"
                  data-testid="tutorial-next"
                  onClick={() => session.advanceTutorial()}
                >
                  {last ? t.tutorial.done : t.tutorial.next}
                </button>
              )}
            </footer>
          </>
        ) : journey ? (
          <>
            <OasisJourney session={session} journey={journey} onTool={selectTool} />
            <button
              type="button"
              className="button small"
              data-testid="oasis-guide-review"
              onClick={() => session.restartTutorial()}
            >
              {copy.review}
            </button>
          </>
        ) : (
          <>
            <p className="oasis-guide-note">{copy.note}</p>
            <ol className="oasis-guide-goals">
              {goals.map((goal) => (
                <li key={goal.id} data-testid={`oasis-goal-${goal.id}`} data-met={goal.done}>
                  <div className="oasis-goal-heading">
                    <strong>{copy.goals[goal.id]}</strong>
                    <span>{goal.value}</span>
                  </div>
                  <small className="oasis-goal-state">
                    <AdobeIcon id={goal.done ? 'check' : 'chronicle'} size={16} />
                    {goal.done ? copy.ready : copy.pending}
                  </small>
                  <p>{copy.goalHints[goal.id]}</p>
                  <button
                    type="button"
                    className="button small"
                    data-testid={`oasis-goal-action-${goal.id}`}
                    onClick={() =>
                      goal.tool ? selectTool(goal.tool) : session.togglePanel('budget')
                    }
                  >
                    {goal.tool ? (
                      <ToolIcon id={goal.tool} style={session.renderer.theme.style} />
                    ) : (
                      <AdobeIcon id="budget" size={20} />
                    )}
                    {goal.tool ? t.tools[goal.tool] : t.hud.budget}
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="button small"
              data-testid="oasis-guide-review"
              onClick={() => session.restartTutorial()}
            >
              {copy.review}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
