import type { MusicFactory } from '@oasis/web/audio/sound';
import { App as UrbeApp } from '@oasis/web/App';
import { oasis, oasisIconCss } from '@theme/oasis';
import { oasisMusicFactory } from './audio/adapter';
import { applyOasisCopy } from './i18n';
import { StudioMark } from './StudioMark';
import { OasisStatus } from './OasisStatus';
import { OasisChronicle } from './OasisChronicle';
import { OasisToolbar } from './OasisToolbar';
import { OasisGuide } from './OasisGuide';
import { OasisToolPreview } from './OasisConstructionFeedback';

/** Desert music on the shared sound bus. */
const music: MusicFactory = (ctx, bus, noise) => oasisMusicFactory(ctx, bus, noise);

// Applied when this module loads, before the first render, so the menu never flashes Urbe wording.
for (const locale of ['en', 'pt-BR', 'es', 'fr', 'de'] as const) applyOasisCopy(locale);

/**
 * Oasis shell: the city UI with desert art, survival telemetry and an oasis tutorial.
 *
 * The construction dock groups shared tools while panels and the inspector retain
 * the shared controller. Oasis presentation never owns simulation rules.
 */
export function App() {
  return (
    <UrbeApp
      theme={oasis}
      cssTokens={oasisIconCss}
      menuSeed="oasis-menu"
      ruleset="oasis"
      music={music}
      credit={(placement) => <StudioMark placement={placement} />}
      toolbar={(session) => <OasisToolbar session={session} />}
      guide={(session) => <OasisGuide session={session} />}
      toolPreview={(session) => <OasisToolPreview session={session} />}
      status={(session) => (
        <>
          <OasisStatus session={session} />
          <OasisChronicle session={session} />
        </>
      )}
    />
  );
}
