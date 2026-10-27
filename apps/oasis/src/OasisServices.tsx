import { useEffect, useMemo, useState } from 'react';
import { Infra, PLACEABLE_SPECS, ZoneType, isZoneKind, type PlaceableKind } from '@city/shared';
import {
  explainService,
  isServiceSource,
  type ServiceExplanation,
  type ServiceNetwork,
} from '@city/simulation';
import { formatNumber } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import type { OverlayMode } from '@view/city';
import { oasisServiceCopy } from './i18n';

const OVERLAY: Record<ServiceNetwork, OverlayMode> = {
  power: 'power',
  water: 'water',
  shade: 'data',
};
const NETWORKS: readonly ServiceNetwork[] = ['power', 'water', 'shade'];
const LINE: Record<ServiceNetwork, number> = {
  power: Infra.PowerLine,
  water: Infra.Pipe,
  shade: Infra.Canal,
};

/** Networks that matter for what stands on this tile. */
function relevantNetworks(session: GameSession, x: number, y: number): ServiceNetwork[] {
  const world = session.client.world;
  if (!world || !world.inBounds(x, y)) return [];
  const i = world.index(x, y);
  const id = world.buildingId[i] as number;
  const building = id === 0 ? undefined : session.client.buildings.get(id);
  if (building && !isZoneKind(building.kind)) {
    const kind = building.kind as PlaceableKind;
    return NETWORKS.filter(
      (network) =>
        isServiceSource(kind, network) ||
        (network === 'power' && PLACEABLE_SPECS[kind].powerUse > 0) ||
        (network === 'water' && kind === 'springHouse') ||
        (network === 'shade' && (kind === 'well' || kind === 'waterPump')),
    );
  }
  if (building || (world.zone[i] as number) !== ZoneType.None) return [...NETWORKS];
  return NETWORKS.filter((network) => world.hasInfra(i, LINE[network]));
}

/** Inspector rows: each network's state on this tile and the reason it is missing. */
export function OasisServices({
  session,
  x,
  y,
  version,
}: {
  session: GameSession;
  x: number;
  y: number;
  version: string;
}) {
  const locale = useStore(session.ui, (s) => s.locale);
  const copy = oasisServiceCopy(locale);
  const [shown, setShown] = useState<ServiceNetwork | null>(null);
  const rows = useMemo(() => {
    const ctx = session.serviceContext();
    if (!ctx) return [];
    const world = session.client.world;
    const id = world?.inBounds(x, y) ? (world.buildingId[world.index(x, y)] as number) : 0;
    return relevantNetworks(session, x, y).map((network) => {
      const result = explainService(ctx, network, x, y);
      const own = id === 0 ? undefined : result.trace.sources.find((s) => s.id === id);
      return { result, own };
    });
    // `version` refreshes mirror reads once per day or after tile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, x, y, version]);

  // The drawn reach belongs to this inspector; selecting elsewhere clears it.
  useEffect(() => () => session.renderer.setServiceTrace(null), [session, x, y]);
  useEffect(() => {
    if (!shown) return;
    const row = rows.find((r) => r.result.network === shown);
    session.renderer.setServiceTrace(row ? traceView(row.result) : null);
  }, [rows, shown, session]);

  if (rows.length === 0) return null;
  const num = (v: number) => formatNumber(v, locale);
  const explain = (r: ServiceExplanation, ownIssue: string | null) => {
    if (ownIssue) return `${copy.reduced} ${ownIssue}`;
    const issues = r.issues.map((i) => copy.issues[i]).join(', ');
    if (r.status === 'disconnected') return copy.disconnected[r.network];
    if (r.status === 'sourcesIdle') return `${copy.idle} ${issues}`;
    if (r.status === 'shortage')
      return copy.shortage(num(r.trace.supply + r.trace.reserve), num(r.trace.demand));
    if (r.status === 'served' && issues) return `${copy.reduced} ${issues}`;
    return null;
  };
  return (
    <>
      <h3>{copy.title}</h3>
      <ul className="oasis-services" data-testid="oasis-services">
        {rows.map(({ result, own }) => {
          const ownIssue = own?.issue ? copy.issues[own.issue] : null;
          const text = explain(result, ownIssue);
          const ok = result.status === 'served' && !(own && own.supply <= 0);
          return (
            <li
              key={result.network}
              data-testid={`service-${result.network}`}
              data-status={
                ok ? 'served' : result.status === 'served' ? 'sourcesIdle' : result.status
              }
            >
              <AdobeIcon id={ok ? 'check' : 'warning'} size={16} />
              <span>
                {copy.networks[result.network]} ·{' '}
                <span className="service-state">
                  {copy.status[ok || result.status !== 'served' ? result.status : 'sourcesIdle']}
                </span>
              </span>
              <button
                type="button"
                className="button"
                aria-pressed={shown === result.network}
                data-testid={`service-show-${result.network}`}
                onClick={() => {
                  const next = shown === result.network ? null : result.network;
                  setShown(next);
                  session.setOverlay(next ? OVERLAY[next] : 'none');
                  if (!next) session.renderer.setServiceTrace(null);
                }}
              >
                {copy.show}
              </button>
              {text && <p data-testid={`service-why-${result.network}`}>{text}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function traceView(r: ServiceExplanation) {
  return {
    tiles: r.trace.tiles,
    sources: r.trace.sources.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h, ok: s.supply > 0 })),
  };
}
