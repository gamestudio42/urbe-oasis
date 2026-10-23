import { Toasts as ChromeToasts, useStore } from '@shell/chrome';
import type { GameSession } from '../state/session';

export function Toasts({ session }: { session: GameSession }) {
  const toasts = useStore(session.ui, (s) => s.toasts);
  return <ChromeToasts toasts={toasts} onDismiss={(id) => session.dismissToast(id)} />;
}
