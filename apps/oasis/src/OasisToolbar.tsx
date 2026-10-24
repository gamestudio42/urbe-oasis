import { useEffect, useRef, useState } from 'react';
import { PLACEABLE_SPECS, type PlaceableKind } from '@city/shared';
import { formatNumber, useStrings } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { TOOL_GROUPS, toolById, toolsFor, type ToolGroup } from '@oasis/web/tools/tools';
import { costLabel } from '@oasis/web/ui/Toolbar';
import { ToolIcon } from '@oasis/web/ui/icons';
import { AdobeIcon, AdobeCategoryIcon } from '@oasis/web/ui/adobeIcons';

/** A compact construction dock. All planning and execution remain in the shared controller. */
export function OasisToolbar({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const active = useStore(session.ui, (s) => s.tool);
  const population = useStore(session.ui, (s) => s.stats?.population ?? 0);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset ?? 'classic');
  const [group, setGroup] = useState<ToolGroup | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<ToolGroup, HTMLButtonElement | null>>>({});
  const activeTool = toolById(active);
  const tools = toolsFor(ruleset);

  // The guide stays above the real dock, including wrapped tool names and translations.
  useEffect(() => {
    const node = host.current;
    const app = node?.closest<HTMLElement>('.app');
    if (!node || !app) return;
    const measure = () => {
      const top = node.getBoundingClientRect().top - app.getBoundingClientRect().top;
      app.style.setProperty('--oasis-construction-top', `${top}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observer.observe(app);
    return () => {
      observer.disconnect();
      app.style.removeProperty('--oasis-construction-top');
    };
  }, []);

  useEffect(() => {
    if (!group) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setGroup(null);
      buttons.current[group]?.focus();
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) setGroup(null);
    };
    window.addEventListener('keydown', close, true);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', close, true);
      window.removeEventListener('pointerdown', outside);
    };
  }, [group]);

  return (
    <div className="oasis-construction" ref={host} data-testid="oasis-construction">
      <div className="construction-selection" data-testid="construction-selection">
        <ToolIcon id={active} style={session.renderer.theme.style} />
        <strong>{t.tools[active]}</strong>
        {costLabel(activeTool, t, locale) && <span>{costLabel(activeTool, t, locale)}</span>}
        {activeTool.hotkey && <kbd>{activeTool.hotkey.toUpperCase()}</kbd>}
      </div>
      {TOOL_GROUPS.filter((id) => id !== 'inspect').map((id) => (
        <section
          key={id}
          id={`construction-${id}`}
          className="construction-tray"
          hidden={group !== id}
          aria-label={t.toolGroups[id]}
          data-testid={`construction-${id}`}
        >
          <header>
            <div>
              <small>{t.ui.tools}</small>
              <h2>{t.toolGroups[id]}</h2>
            </div>
            <button
              type="button"
              aria-label={t.ui.close}
              data-testid={`construction-close-${id}`}
              onClick={() => {
                setGroup(null);
                buttons.current[id]?.focus();
              }}
            >
              <AdobeIcon id="close" size={20} />
            </button>
          </header>
          <div className="construction-tools">
            {tools
              .filter((tool) => tool.group === id)
              .map((tool) => {
                const spec =
                  tool.id in PLACEABLE_SPECS
                    ? PLACEABLE_SPECS[tool.id as PlaceableKind]
                    : undefined;
                const locked = Boolean(spec && spec.minPopulation > population);
                const cost = costLabel(tool, t, locale);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className="construction-tool"
                    data-locked={locked}
                    data-testid={`tool-${tool.id}`}
                    aria-pressed={active === tool.id}
                    onClick={() => {
                      session.setTool(tool.id);
                      setGroup(null);
                      buttons.current[id]?.focus();
                    }}
                  >
                    <span className="construction-glyph">
                      <ToolIcon id={tool.id} style={session.renderer.theme.style} />
                      {locked && <AdobeIcon id="lock" size={12} className="construction-lock" />}
                    </span>
                    <span>
                      <strong>{t.tools[tool.id]}</strong>
                      <small>
                        {locked && spec
                          ? t.hud.unlockAt(formatNumber(spec.minPopulation, locale))
                          : cost}
                      </small>
                    </span>
                    {tool.hotkey && <kbd>{tool.hotkey.toUpperCase()}</kbd>}
                    {active === tool.id && (
                      <AdobeIcon id="check" size={12} className="construction-check" />
                    )}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
      <nav className="construction-dock" aria-label={t.ui.tools} data-testid="toolbar">
        {TOOL_GROUPS.map((id) => (
          <button
            key={id}
            type="button"
            ref={(node) => {
              buttons.current[id] = node;
            }}
            data-testid={id === 'inspect' ? 'tool-select' : `tool-category-${id}`}
            aria-label={t.toolGroups[id]}
            aria-pressed={id === 'inspect' ? active === 'select' : undefined}
            aria-expanded={id === 'inspect' ? undefined : group === id}
            aria-controls={id === 'inspect' ? undefined : `construction-${id}`}
            data-active={group === id || activeTool.group === id}
            onClick={() => {
              if (id === 'inspect') {
                session.setTool('select');
                setGroup(null);
              } else setGroup(group === id ? null : id);
            }}
          >
            <AdobeCategoryIcon id={id} />
            <span>{t.toolGroups[id]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
