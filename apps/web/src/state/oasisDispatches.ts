import type { SimEvent } from '@city/shared';
import { isOasisMoment, type OasisMoment } from '@view/city';

export interface OasisDispatch {
  id: number;
  tick: number;
  event: OasisMoment;
  count: number;
}

const priority = (event: OasisMoment) =>
  event.type === 'sandstorm'
    ? 3
    : event.type === 'canalCollapse' || event.type === 'waterStress'
      ? 2
      : 1;

/** Session-only journal. Group trade bursts and keep the crisis ahead of its spring nudge. */
export function appendOasisDispatches(
  previous: readonly OasisDispatch[],
  events: readonly SimEvent[],
  tick: number,
): OasisDispatch[] {
  let id = previous.reduce((max, entry) => Math.max(max, entry.id), 0);
  const batch: OasisDispatch[] = [];
  for (const event of events) {
    if (!isOasisMoment(event)) continue;
    const grouped =
      (event.type === 'caravanTrade' || event.type === 'caravanLeave') &&
      batch.find((entry) => entry.event.type === event.type);
    if (grouped) grouped.count++;
    else batch.push({ id: ++id, tick, event, count: 1 });
  }
  if (batch.length === 0) return previous as OasisDispatch[];
  batch.sort((a, b) => priority(b.event) - priority(a.event) || b.id - a.id);
  return [...batch, ...previous].slice(0, 12);
}
