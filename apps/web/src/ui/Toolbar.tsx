import { BALANCE, OASIS_SHADE, PLACEABLE_SPECS, type PlaceableKind } from '@city/shared';
import { formatMoney, formatNumber, useStrings, type Locale, type Strings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { TOOL_GROUPS, toolsFor, type ToolDef } from '../tools/tools';
import { ToolIcon } from './icons';

export function costLabel(tool: ToolDef, t: Strings, locale: Locale): string | null {
  const c = BALANCE.costs;
  const money = (value: number) => formatMoney(value, locale);
  switch (tool.id) {
    case 'road':
      return `${money(c.road)}${t.ui.perTile} · ${t.ui.bridge} ${money(c.bridge)}`;
    case 'powerLine':
      return `${money(c.powerLine)}${t.ui.perTile}`;
    case 'pipe':
      return `${money(c.pipe)}${t.ui.perTile}`;
    case 'canal':
      return `${money(OASIS_SHADE.canalCost)}${t.ui.perTile}`;
    case 'zoneResLight':
    case 'zoneComLight':
    case 'zoneIndLight':
      return `${money(c.zoneLight)}${t.ui.perTile}`;
    case 'zoneResDense':
    case 'zoneComDense':
    case 'zoneIndDense':
      return `${money(c.zoneDense)}${t.ui.perTile}`;
    case 'level':
    case 'raise':
    case 'lower':
      return `${money(c.levelPerUnit)}${t.ui.perHeight}`;
    case 'trees':
      return `${money(c.plantTree)}${t.ui.perTile}`;
    case 'select':
    case 'dezone':
    case 'demolish':
      return null;
    default:
      return money(PLACEABLE_SPECS[tool.id as PlaceableKind].cost);
  }
}

export function Toolbar({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const active = useStore(session.ui, (s) => s.tool);
  const population = useStore(session.ui, (s) => s.stats?.population ?? 0);
  const ruleset = useStore(session.ui, (s) => s.stats?.ruleset ?? 'classic');
  const tools = toolsFor(ruleset);
  return (
    <nav className="toolbar" aria-label={t.ui.tools} data-testid="toolbar">
      {TOOL_GROUPS.map((group) => (
        <div key={group} className="tool-group" role="group" aria-label={t.toolGroups[group]}>
          {tools
            .filter((tool) => tool.group === group)
            .map((tool) => {
              const spec =
                tool.id in PLACEABLE_SPECS ? PLACEABLE_SPECS[tool.id as PlaceableKind] : undefined;
              const locked = Boolean(spec && spec.minPopulation > population);
              const cost = costLabel(tool, t, locale);
              const title = [
                t.tools[tool.id],
                cost,
                locked && spec ? t.hud.unlockAt(formatNumber(spec.minPopulation, locale)) : null,
                tool.hotkey ? `${t.ui.shortcut}: ${tool.hotkey.toUpperCase()}` : null,
              ]
                .filter(Boolean)
                .join(' — ');
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`tool-button${active === tool.id ? ' active' : ''}${locked ? ' locked' : ''}`}
                  title={title}
                  aria-label={t.tools[tool.id]}
                  aria-pressed={active === tool.id}
                  data-testid={`tool-${tool.id}`}
                  onClick={() => session.setTool(tool.id)}
                >
                  <ToolIcon id={tool.id} style={session.renderer.theme.style} />
                </button>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
