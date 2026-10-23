import { useStrings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { TUTORIAL_CHECKS } from '../state/tutorial';

export function Tutorial({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const step = useStore(session.ui, (s) => s.tutorial);
  if (step === null) return null;
  const content = t.tutorial.steps[step];
  if (!content) return null;
  const manual = TUTORIAL_CHECKS[step] === null;
  const last = step === t.tutorial.steps.length - 1;
  return (
    <aside className="tutorial" data-testid="tutorial" aria-live="polite">
      <div className="tutorial-progress">
        {t.tutorial.title} · {step + 1}/{t.tutorial.steps.length}
      </div>
      <h3>{content.title}</h3>
      <p>{content.text}</p>
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
