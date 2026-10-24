import type { MusicFactory } from '@oasis/web/audio/sound';
import { App as UrbeApp } from '@oasis/web/App';
import { oasis } from '@theme/oasis';
import { oasisMusicFactory } from './audio/adapter';
import { applyOasisCopy } from './i18n';
import { StudioMark } from './StudioMark';
import { OasisStatus } from './OasisStatus';
import { OasisChronicle } from './OasisChronicle';

/** Desert music on the shared sound bus. */
const music: MusicFactory = (ctx, bus, noise) => oasisMusicFactory(ctx, bus, noise);

// Applied when this module loads, before the first render, so the menu never flashes Urbe wording.
for (const locale of ['en', 'pt-BR', 'es', 'fr', 'de'] as const) applyOasisCopy(locale);

/**
 * Oasis shell: the city UI with desert art, survival telemetry and an oasis tutorial.
 *
 * The panels, the toolbar, the inspector and every `data-testid` stay the same, so the
 * end-to-end tests keep working. Only the art direction, the copy and the ruleset change.
 */
export function App() {
  return (
    <UrbeApp
      theme={oasis}
      menuSeed="oasis-menu"
      ruleset="oasis"
      music={music}
      credit={(placement) => <StudioMark placement={placement} />}
      status={(session) => (
        <>
          <OasisStatus session={session} />
          <OasisChronicle session={session} />
        </>
      )}
    />
  );
}
