import type { BuildingRecord } from '@city/shared';
import { describe, expect, it } from 'vitest';
import { oasis } from '../../packages/theme-oasis/src';
import { drawOasisLotDetails } from '../../packages/view-city/src/oasisLotDetails';

function render(b: BuildingRecord, theme = oasis) {
  const fills: number[] = [];
  const g = {
    poly: () => g,
    moveTo: () => g,
    lineTo: () => g,
    stroke: () => g,
    ellipse: () => g,
    fill: (value: number) => {
      fills.push(value);
      return g;
    },
  };
  drawOasisLotDetails(
    g as unknown as Parameters<typeof drawOasisLotDetails>[0],
    theme,
    [
      { x: 0, y: 0 },
      { x: 32, y: 16 },
      { x: 0, y: 32 },
      { x: -32, y: 16 },
    ],
    b,
  );
  return fills;
}
const lot = {
  kind: 'residential',
  watered: true,
  linked: true,
  abandoned: false,
} as BuildingRecord;
it('shows irrigation only with water, and green planters only with both water and shade', () => {
  const before = { ...lot };
  const green = oasis.colors['tree.leafLight'];
  const water = oasis.colors['overlay.waterOn'];
  expect(render(lot)).toContain(green);
  expect(render(lot)).toContain(water);
  expect(render({ ...lot, linked: false })).not.toContain(green);
  expect(render({ ...lot, watered: false })).not.toContain(green);
  expect(render({ ...lot, watered: false })).not.toContain(water);
  expect(lot).toEqual(before);
});

describe('frontage scope', () => {
  it('leaves other styles, industry and abandoned lots untouched', () => {
    expect(render(lot, { ...oasis, style: 'cyber' })).toEqual([]);
    expect(render({ ...lot, kind: 'industrial' })).toEqual([]);
    expect(render({ ...lot, abandoned: true })).toEqual([]);
  });
});
