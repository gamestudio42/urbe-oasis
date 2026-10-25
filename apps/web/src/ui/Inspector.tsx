import {
  BALANCE,
  PLACEABLE_SPECS,
  isZoneKind,
  type BuildingRecord,
  type PlaceableKind,
  type PlaceableSpec,
  type CityStats,
  type Problem,
} from '@city/shared';
import {
  diagnoseTile,
  hubRoad,
  isOperatingHub,
  RoadNetwork,
  ZONE_KIND,
  type World,
} from '@city/simulation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { formatNumber, useStrings, type Locale, type Strings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

interface Snapshot {
  terrain: number;
  elevation: number;
  zone: number;
  density: number;
  trees: number;
  powered: boolean;
  watered: boolean;
  building: BuildingRecord | null;
  influence: {
    pollution: number;
    crime: number;
    landValue: number;
    traffic: number;
    police: number;
    fireCover: number;
    health: number;
    education: number;
  };
  problems: Problem[];
  /** The building is an operating gateway hub with a road. */
  regional: boolean;
}

const SEVERITY_CLASS = ['info', 'minor', 'major', 'blocking'] as const;

function inspect(session: GameSession, x: number, y: number): Snapshot | null {
  const w = session.client.world;
  const stats = session.client.stats;
  if (!w || !stats || !w.inBounds(x, y)) return null;
  const i = w.index(x, y);
  const id = w.buildingId[i] as number;
  const inf = w.influence;
  const roads = session.roads();
  const building = id === 0 ? null : (session.client.buildings.get(id) ?? null);
  return {
    terrain: w.terrain[i] as number,
    elevation: w.elevation(x, y),
    zone: w.zone[i] as number,
    density: w.zoneDensity[i] as number,
    trees: w.trees[i] as number,
    powered: w.powered[i] === 1,
    watered: w.watered[i] === 1,
    building,
    influence: {
      pollution: inf.pollution[i] as number,
      crime: inf.crime[i] as number,
      landValue: inf.landValue[i] as number,
      traffic: inf.traffic[i] as number,
      police: inf.police[i] as number,
      fireCover: inf.fireCover[i] as number,
      health: inf.health[i] as number,
      education: inf.education[i] as number,
    },
    problems: diagnoseTile(
      {
        world: w,
        building: (bid) => session.client.buildings.get(bid),
        demand: stats.demand,
        taxes: stats.taxes,
        power: stats.power,
        ...(roads ? { roads } : {}),
        ...(stats.oasis && session.ruleset === 'oasis'
          ? { oasis: oasisHints(session, stats, x, y) }
          : {}),
      },
      x,
      y,
    ),
    regional: building !== null && isGateway(w, roads, building),
  };
}

/**
 * Oasis-only inspector hints. The stats carry the city-wide counters; caravan ownership and a
 * buried service are read from the mirror building, so the inspector never asks the worker again.
 */
function oasisHints(
  session: GameSession,
  stats: CityStats,
  x: number,
  y: number,
): NonNullable<Parameters<typeof diagnoseTile>[0]['oasis']> {
  const world = session.client.world;
  const id = world ? (world.buildingId[y * world.size + x] as number) : 0;
  const building = id === 0 ? undefined : session.client.buildings.get(id);
  const oasis = stats.oasis;
  return {
    parched: (oasis?.parched ?? 0) > 0,
    owner: building?.owner === undefined ? null : `#${building.owner}`,
    buried: (building?.offline ?? 0) > 0,
    unguarded: (oasis?.windbreak ?? 0) < 0.5,
    arcades: (oasis?.arcades ?? 0) > 0,
  };
}

function isGateway(w: World, roads: RoadNetwork | null, b: BuildingRecord): boolean {
  if (!isOperatingHub(b) || !PLACEABLE_SPECS[b.kind as PlaceableKind].gateway) return false;
  const network = roads ?? new RoadNetwork(w);
  network.update();
  return hubRoad(w, network, b) >= 0;
}

const pct = (v: number) => `${Math.round((v / 255) * 100)}%`;

function HubFacts({
  building: b,
  spec,
  regional,
  t,
  locale,
}: {
  building: BuildingRecord;
  spec: PlaceableSpec;
  regional: boolean;
  t: Strings;
  locale: Locale;
}) {
  const h = t.inspector.hub;
  const operating = b.occupancy > 0;
  const num = (value: number) => formatNumber(value, locale);
  return (
    <>
      <dt>{h.status}</dt>
      <dd data-testid="hub-status">{operating ? h.operating : h.idle}</dd>
      <dt>{h.jobs}</dt>
      <dd data-testid="hub-jobs">
        {num(b.occupancy)} / {num(b.capacity)} {spec.jobKind ? h.jobKind[spec.jobKind] : ''}
        <small className="fact-note">{h.growth(spec.jobsPer1000, num(spec.maxJobs))}</small>
      </dd>
      {spec.gateway && (
        <>
          <dt>{h.regional}</dt>
          <dd data-testid="hub-regional">{regional ? h.regionalOn : h.regionalOff}</dd>
        </>
      )}
      {spec.landValue !== 0 && (
        <>
          <dt>{h.surroundings}</dt>
          <dd>{h.landValue(spec.landValue, spec.landValueRadius)}</dd>
        </>
      )}
    </>
  );
}

/** Host-specific inspector rows; `version` changes whenever the mirror reads should refresh. */
export type InspectorDetails = (
  session: GameSession,
  tile: { x: number; y: number; version: string },
) => ReactNode;

export function Inspector({
  session,
  details,
}: {
  session: GameSession;
  details?: InspectorDetails | undefined;
}) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const selected = useStore(session.ui, (s) => s.selected);
  // Refresh once per game day at most; tile changes trigger their own refresh.
  const day = useStore(session.ui, (s) =>
    s.stats ? Math.floor(s.stats.tick / BALANCE.clock.ticksPerDay) : -1,
  );
  const [revision, setRevision] = useState(0);
  useEffect(() => session.onTilesChanged(() => setRevision((r) => r + 1)), [session]);
  const snapshot = useMemo(
    () => (selected ? inspect(session, selected.x, selected.y) : null),
    // `day` and `revision` only trigger a refresh of the mirror-world reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, selected, day, revision],
  );

  if (!selected || !snapshot) return null;
  const s = snapshot;
  const n = t.inspector;
  const b = s.building;
  const zoneKind = ZONE_KIND[s.zone];
  const hub =
    b && !isZoneKind(b.kind) && PLACEABLE_SPECS[b.kind].jobs > 0 ? PLACEABLE_SPECS[b.kind] : null;
  const title = b
    ? t.buildings[b.kind]
    : zoneKind
      ? t.zones[zoneKind]
      : (n.terrains[s.terrain] ?? n.title);

  return (
    <Panel
      title={title}
      testId="inspector"
      onClose={() => session.select(null)}
      closeLabel={t.ui.close}
      className="inspector"
    >
      <dl className="facts">
        <dt>{n.tile}</dt>
        <dd>
          {selected.x}, {selected.y}
        </dd>
        <dt>{n.terrain}</dt>
        <dd>
          {n.terrains[s.terrain]} · {n.elevation} {s.elevation}
        </dd>
        {zoneKind && (
          <>
            <dt>{n.zone}</dt>
            <dd>
              {t.zones[zoneKind]} ({n.density[s.density]})
            </dd>
          </>
        )}
        {b && (
          <>
            {isZoneKind(b.kind) && (
              <>
                <dt>{n.level}</dt>
                <dd data-testid="inspector-level">{b.abandoned ? n.abandoned : b.level}</dd>
                <dt>{n.occupancy}</dt>
                <dd>
                  {formatNumber(b.occupancy, locale)} / {formatNumber(b.capacity, locale)}{' '}
                  {b.kind === 'residential' ? n.residents : n.jobs}
                </dd>
                <dt>{n.condition}</dt>
                <dd>{b.condition}%</dd>
                <dt>{n.attractiveness}</dt>
                <dd>{Math.round(b.attractiveness * 100)}%</dd>
              </>
            )}
            {hub && (
              <HubFacts building={b} spec={hub} regional={s.regional} t={t} locale={locale} />
            )}
            <dt>{n.age}</dt>
            <dd>
              {b.age} {n.months}
            </dd>
          </>
        )}
        {!details && (
          <>
            <dt>{n.power}</dt>
            <dd>{s.powered ? n.yes : n.no}</dd>
            <dt>{n.water}</dt>
            <dd>{s.watered ? n.yes : n.no}</dd>
          </>
        )}
      </dl>
      {details?.(session, { x: selected.x, y: selected.y, version: `${day}:${revision}` })}
      {s.problems.length > 0 && (
        <>
          <h3>{n.why}</h3>
          <ul className="problems" data-testid="problems">
            {s.problems.map((p) => (
              <li
                key={p.code}
                className={`problem ${SEVERITY_CLASS[p.severity]}`}
                data-code={p.code}
              >
                {t.problems[p.code]}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>{n.influence}</h3>
      <dl className="facts compact">
        <dt>{t.overlays.landValue}</dt>
        <dd>{pct(s.influence.landValue)}</dd>
        <dt>{t.overlays.pollution}</dt>
        <dd>{pct(s.influence.pollution)}</dd>
        <dt>{t.overlays.crime}</dt>
        <dd>{pct(s.influence.crime)}</dd>
        <dt>{t.overlays.police}</dt>
        <dd>{pct(s.influence.police)}</dd>
        <dt>{t.overlays.fireCover}</dt>
        <dd>{pct(s.influence.fireCover)}</dd>
        <dt>{t.overlays.health}</dt>
        <dd>{pct(s.influence.health)}</dd>
        <dt>{t.overlays.education}</dt>
        <dd>{pct(s.influence.education)}</dd>
        {s.trees > 0 && (
          <>
            <dt>{n.trees}</dt>
            <dd>{s.trees}</dd>
          </>
        )}
      </dl>
    </Panel>
  );
}
