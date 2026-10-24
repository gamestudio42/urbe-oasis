import type { Theme } from '@theme/core';
import type { MusicFactory } from './audio/sound';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useStrings } from './i18n';
import { GameSession } from './state/session';
import { useStore } from './state/store';
import { BootScreen, BootView } from './ui/BootScreen';
import { CityAudio } from './ui/CityAudio';
import { BudgetPanel } from './ui/BudgetPanel';
import { ChartsPanel } from './ui/ChartsPanel';
import { Hud } from './ui/Hud';
import { Inspector } from './ui/Inspector';
import { MainMenu } from './ui/MainMenu';
import { Minimap } from './ui/Minimap';
import { OverlayPanel } from './ui/OverlayPanel';
import { PauseOverlay } from './ui/PauseOverlay';
import { SaveControls, SavedCities } from './ui/Saves';
import { SystemPanel } from './ui/SystemPanel';
import { Toasts } from './ui/Toasts';
import { Toolbar } from './ui/Toolbar';
import { ToolTooltip } from './ui/ToolTooltip';
import { Tutorial } from './ui/Tutorial';
import { IconStyleContext } from './ui/iconStyle';

export interface AppProps {
  /** Art direction injected by the host app; defaults to Urbe. */
  theme?: Theme;
  /** CSS tokens supplied by the host theme, scoped to this app. */
  cssTokens?: Readonly<Record<string, string>>;
  /** Seed of the scripted city behind the main menu. */
  menuSeed?: string;
  /** Rules for cities created from this app's menu. */
  ruleset?: 'classic' | 'oasis';
  /** Music engine factory; reskins inject their own composer. */
  music?: MusicFactory;
  /**
   * Studio credit. Called once per surface so boot, menu and play each get
   * their own element. The classic shell leaves it unset.
   */
  credit?: (placement: 'boot' | 'menu' | 'play') => ReactNode;
  /** Ruleset-specific telemetry, kept outside the shared city UI. */
  status?: (session: GameSession) => ReactNode;
  /** Hosts can provide their own construction layout while retaining the shared controller. */
  toolbar?: (session: GameSession) => ReactNode;
  /** Hosts can present their own guide while keeping the shared tutorial state. */
  guide?: (session: GameSession) => ReactNode;
}

export function App({
  theme,
  cssTokens,
  menuSeed,
  ruleset,
  music,
  credit,
  status,
  toolbar,
  guide,
}: AppProps = {}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const s = new GameSession({ theme, menuSeed, ruleset, music });
    setSession(s);
    void s.boot(host);
    return () => s.dispose();
  }, [theme, menuSeed, ruleset, music]);

  return (
    <IconStyleContext.Provider value={theme?.style ?? 'classic'}>
      <div className="app" style={cssTokens as CSSProperties}>
        <div ref={hostRef} className="viewport" />
        {session ? (
          <>
            <Screens
              session={session}
              credit={credit}
              status={status}
              toolbar={toolbar}
              guide={guide}
            />
            <BootScreen session={session} credit={credit?.('boot')} />
          </>
        ) : (
          <BootView boot={{ step: 'graphics', progress: 0 }} credit={credit?.('boot')} />
        )}
      </div>
    </IconStyleContext.Provider>
  );
}

function Screens({
  session,
  credit,
  status,
  toolbar,
  guide,
}: {
  session: GameSession;
  credit?: AppProps['credit'];
  status?: AppProps['status'];
  toolbar?: AppProps['toolbar'];
  guide?: AppProps['guide'];
}) {
  const booted = useStore(session.ui, (s) => s.boot.step === 'done');
  const screen = useStore(session.ui, (s) => s.screen);
  const panel = useStore(session.ui, (s) => s.panel);
  if (!booted) return null;
  if (screen === 'menu') {
    return (
      <>
        <MainMenu
          session={session}
          extra={<SavedCities session={session} />}
          credit={credit?.('menu')}
        />
        <Toasts session={session} />
      </>
    );
  }
  return (
    <>
      <PauseOverlay session={session} />
      <Hud session={session} credit={credit?.('play')} />
      {status?.(session)}
      <CityAudio session={session} />
      {toolbar ? toolbar(session) : <Toolbar session={session} />}
      <Minimap session={session} />
      <TileReadout session={session} />
      <ToolTooltip session={session} />
      <div className="side-panels">
        <Inspector session={session} />
        {panel === 'budget' && <BudgetPanel session={session} />}
        {panel === 'charts' && <ChartsPanel session={session} />}
        {panel === 'overlays' && <OverlayPanel session={session} />}
        {panel === 'system' && (
          <SystemPanel session={session}>
            <SaveControls session={session} />
          </SystemPanel>
        )}
      </div>
      {guide ? guide(session) : <Tutorial session={session} />}
      <Toasts session={session} />
    </>
  );
}

function TileReadout({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const hover = useStore(session.ui, (s) => s.hover);
  const selected = useStore(session.ui, (s) => s.selected);
  return (
    <div className="readout" data-testid="readout">
      <span>
        {t.ui.cursor}: {hover ? `${hover.x}, ${hover.y}` : t.ui.none}
      </span>
      <span data-testid="selected-tile">
        {t.ui.selected}: {selected ? `${selected.x}, ${selected.y}` : t.ui.none}
      </span>
    </div>
  );
}
