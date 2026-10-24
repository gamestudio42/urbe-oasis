import { useStrings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { OASIS_TUTORIAL_TOOLS, tutorialChecks } from '../state/tutorial';
import { ToolIcon } from './icons';
import { InterfaceIcon } from './interfaceIcons';

export function Tutorial({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const step = useStore(session.ui, (s) => s.tutorial);
  const speed = useStore(session.ui, (s) => s.speed);
  if (step === null) return null;
  const content = t.tutorial.steps[step];
  if (!content) return null;
  const manual = tutorialChecks(session.ruleset)[step] === null;
  const tools = session.ruleset === 'oasis' ? (OASIS_TUTORIAL_TOOLS[step] ?? []) : [];
  const last = step === t.tutorial.steps.length - 1;
  return (
    <aside className="tutorial" data-testid="tutorial" aria-live="polite">
      <div className="tutorial-progress">
        {t.tutorial.title} · {step + 1}/{t.tutorial.steps.length}
      </div>
      <h3>{content.title}</h3>
      <p>{content.text}</p>
      {session.ruleset === 'oasis' && (
        <div className="tutorial-tools">
          {tools.map((tool) => (
            <button
              key={tool}
              type="button"
              className="button small"
              data-testid={`tutorial-tool-${tool}`}
              onClick={() => session.setTool(tool)}
            >
              <ToolIcon id={tool} style={session.renderer.theme.style} />
              {t.tools[tool]}
            </button>
          ))}
          {step > 0 && !last && speed === 0 && (
            <button
              type="button"
              className="button small"
              data-testid="tutorial-resume"
              onClick={() => session.setSpeed(1)}
            >
              <InterfaceIcon id="play" />
              {t.hud.speeds[1]}
            </button>
          )}
        </div>
      )}
      <div className="tutorial-actions">
        <button
          type="button"
          className="button small"
          onClick={() => session.skipTutorial()}
          data-testid="tutorial-skip"
        >
          {t.tutorial.skip}
        </button>
        {(manual || last) && (
          <button
            type="button"
            className="button small primary"
            onClick={() => session.advanceTutorial()}
            data-testid="tutorial-next"
          >
            {last ? t.tutorial.done : t.tutorial.next}
          </button>
        )}
      </div>
    </aside>
  );
}
