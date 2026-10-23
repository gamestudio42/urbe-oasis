import {
  BALANCE,
  PLACEABLE_SPECS,
  isZoneKind,
  type PlaceableSpec,
  type RciValues,
} from '@city/shared';
import type { SimulationEngine } from '../engine';

/** City-wide aggregates of zone buildings used by demand, growth and the economy. */
export interface CityTotals {
  residents: number;
  housing: number;
  workforce: number;
  commercialJobs: number;
  industrialJobs: number;
  commercialWorkers: number;
  industrialWorkers: number;
  /** Extra commercial market numerator from powered hubs. */
  hubCommercialMarket: number;
  /** Extra industrial market numerator from powered hubs. */
  hubIndustrialMarket: number;
  /** Mean (landValue - pollution - crime) / 255 over developed residential tiles, or 0. */
  residentialQuality: number;
  developedResidential: number;
}

export function cityTotals(engine: SimulationEngine): CityTotals {
  const w = engine.world;
  const inf = w.influence;
  const totals: CityTotals = {
    residents: 0,
    housing: 0,
    workforce: 0,
    commercialJobs: 0,
    industrialJobs: 0,
    commercialWorkers: 0,
    industrialWorkers: 0,
    hubCommercialMarket: 0,
    hubIndustrialMarket: 0,
    residentialQuality: 0,
    developedResidential: 0,
  };
  let quality = 0;
  for (const b of engine.buildings.values()) {
    if (isZoneKind(b.kind)) {
      if (b.abandoned) continue;
      if (b.kind === 'residential') {
        totals.residents += b.occupancy;
        totals.housing += b.capacity;
        const i = w.index(b.x, b.y);
        quality +=
          ((inf.landValue[i] as number) - (inf.pollution[i] as number) - (inf.crime[i] as number)) /
          255;
        totals.developedResidential++;
      } else if (b.kind === 'commercial') {
        totals.commercialJobs += b.capacity;
        totals.commercialWorkers += b.occupancy;
      } else {
        totals.industrialJobs += b.capacity;
        totals.industrialWorkers += b.occupancy;
      }
      continue;
    }
    // Hub occupancy holds the jobs of an operating hub (0 when dark), set by the utilities pass.
    const spec = PLACEABLE_SPECS[b.kind];
    if (spec.jobs <= 0 || b.occupancy <= 0) continue;
    const market = b.occupancy * BALANCE.demand.hubMarketPerJob;
    if (spec.jobKind === 'commercial') {
      totals.commercialJobs += b.occupancy;
      totals.commercialWorkers += b.occupancy;
      totals.hubCommercialMarket += market;
    } else if (spec.jobKind === 'industrial') {
      totals.industrialJobs += b.occupancy;
      totals.industrialWorkers += b.occupancy;
      totals.hubIndustrialMarket += market;
    }
  }
  totals.workforce = BALANCE.demand.laborRate * totals.residents;
  totals.residentialQuality =
    totals.developedResidential === 0 ? 0 : quality / totals.developedResidential;
  return totals;
}

/** Jobs of one operating hub: base plus a share of the city-size bonus, capped (spec section 4). */
export function hubJobs(spec: PlaceableSpec, residents: number, sameKind: number): number {
  const extra = Math.floor((residents * spec.jobsPer1000) / 1000 / Math.max(1, sameKind));
  return Math.min(spec.maxJobs, spec.jobs + extra);
}

function clamp(v: number, lo = -1, hi = 1): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function taxPressure(rate: number): number {
  return (rate - BALANCE.demand.taxNeutral) / BALANCE.demand.taxSpan;
}

export interface DemandInputs {
  totals: CityTotals;
  taxes: RciValues;
  edgeConnected: boolean;
  /** Industrial market factor during an economic crisis (1 otherwise). */
  crisis: number;
}

/** Target RCI demand in [-1, 1] before smoothing. */
export function demandTargets({ totals, taxes, edgeConnected, crisis }: DemandInputs): RciValues {
  const d = BALANCE.demand;
  const P = totals.residents;
  const W = totals.workforce;
  const Jc = totals.commercialJobs;
  const Ji = totals.industrialJobs;
  const Hc = totals.housing;

  const J = clamp((Jc + Ji + d.externalJobs - W) / Math.max(W, 50));
  const Q =
    totals.developedResidential === 0 ? 0 : totals.residentialQuality - d.residential.qualityOffset;
  const H = Math.max(0, (Hc - P) / Math.max(Hc, 1) - d.residential.naturalVacancy);
  const residential = clamp(
    d.residential.jobs * J +
      d.residential.quality * Q -
      d.residential.tax * taxPressure(taxes.residential) -
      d.residential.housing * H,
  );

  const labor = clamp((W - (Jc + Ji)) / Math.max(W, 20));
  const cMarket =
    d.commercial.perCapita * P +
    d.commercial.perIndustrialJob * Ji +
    d.commercial.base +
    totals.hubCommercialMarket;
  const commercialMarket = (cMarket - Jc) / Math.max(cMarket, Jc, 10);
  const commercial = clamp(
    d.commercial.market * commercialMarket +
      d.commercial.labor * labor -
      d.commercial.tax * taxPressure(taxes.commercial),
  );

  const iMarket = d.industrial.base + d.industrial.perCapita * P + totals.hubIndustrialMarket;
  const industrialMarket = (iMarket - Ji) / Math.max(iMarket, Ji, 10);
  const industrial = clamp(
    d.industrial.market * industrialMarket * crisis +
      d.industrial.labor * labor -
      d.industrial.tax * taxPressure(taxes.industrial) +
      (edgeConnected ? d.industrial.edgeBonus : 0),
  );
  return { residential, commercial, industrial };
}

/** Monthly demand update with exponential smoothing. */
export function updateDemand(engine: SimulationEngine, inputs: DemandInputs): void {
  const target = demandTargets(inputs);
  const s = BALANCE.demand.smoothing;
  const d = engine.demand;
  d.residential = round4(d.residential + s * (target.residential - d.residential));
  d.commercial = round4(d.commercial + s * (target.commercial - d.commercial));
  d.industrial = round4(d.industrial + s * (target.industrial - d.industrial));
}

/** Rounds to 4 decimals so serialized state stays compact and stable. */
export function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
