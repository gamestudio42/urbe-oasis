import { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import type { Point } from './iso';
import { OasisPresentation } from './oasisPresentation';

/** Screen-space dust and map-space signals. No textures, filters or full-map scans. */
export class OasisEffects {
  readonly weather = new Graphics();
  readonly markers = new Graphics();
  readonly state = new OasisPresentation();
  private elapsed = 0;
  private painted = false;

  constructor(private readonly theme: Theme) {
    this.weather.eventMode = this.markers.eventMode = 'none';
  }

  reset(): void {
    this.state.clear();
    this.weather.clear();
    this.markers.clear();
    this.painted = false;
  }

  update(options: {
    deltaMS: number;
    width: number;
    height: number;
    paused: boolean;
    enabled: boolean;
    hidden: boolean;
    project: (x: number, y: number) => Point;
  }): void {
    const { deltaMS, width, height, paused, enabled, hidden, project } = options;
    this.state.advance(deltaMS, paused, enabled);
    this.weather.visible = this.markers.visible = !hidden && enabled;
    if (hidden || !enabled) return;
    if (this.state.signals.length === 0 && this.state.intensity === 0) {
      if (this.painted) this.reset();
      return;
    }
    this.elapsed += deltaMS;
    if (this.elapsed < 1000 / 30) return;
    this.elapsed = 0;
    this.painted = true;
    const dust = color(this.theme, 'ground.bareLot');
    const water = color(this.theme, 'overlay.waterOn');
    const good = color(this.theme, 'overlay.goodHigh');
    const danger = color(this.theme, 'overlay.heatHigh');
    const g = this.weather;
    g.clear();
    const force = this.state.intensity;
    if (force > 0) {
      const t = this.state.stormAge;
      g.rect(0, 0, width, height).fill({ color: dust, alpha: force * 0.13 });
      // Broad veils and a fixed pool of wind streaks preserve city readability.
      for (let k = 0; k < 9; k++) {
        const x = ((k * 271 + t * (55 + k * 3)) % (width + 700)) - 350;
        const y = ((k * 173) % (height + 180)) - 90;
        g.ellipse(x, y, 350, 90 + (k % 3) * 30).fill({
          color: shade(dust, 0.88 + (k % 3) * 0.12),
          alpha: force * 0.08,
        });
      }
      for (let k = 0; k < 72; k++) {
        const x = ((k * 137 + t * (140 + (k % 5) * 35)) % (width + 100)) - 50;
        const y = (k * 97 + Math.sin(t + k) * 8) % height;
        g.moveTo(x, y)
          .lineTo(x + 12 + (k % 7) * 5, y + 2)
          .stroke({ color: shade(dust, 1.35), alpha: force * 0.28, width: k % 4 === 0 ? 2 : 1 });
      }
    }
    const m = this.markers;
    m.clear();
    for (const { event, age } of this.state.signals) {
      const p = project(event.x, event.y);
      const isWater = event.type === 'springMoved';
      const isGood = event.type === 'caravanTrade' || (event.type === 'sandstorm' && event.blocked);
      const tint = isWater ? water : isGood ? good : danger;
      const alpha = Math.min(1, (12 - age) / 3);
      const pulse = (age % 2) / 2;
      m.ellipse(p.x, p.y, 28 + pulse * 24, 14 + pulse * 12).stroke({
        color: tint,
        alpha: alpha * (1 - pulse) * 0.75,
        width: 2,
      });
      m.moveTo(p.x, p.y - 10)
        .lineTo(p.x, p.y - 50)
        .stroke({ color: tint, alpha, width: 2 });
      m.circle(p.x, p.y - 60, 12)
        .fill({ color: this.theme.background, alpha: alpha * 0.92 })
        .stroke({ color: tint, alpha, width: 2 });
      if (isWater) {
        m.poly([p.x, p.y - 68, p.x + 5, p.y - 59, p.x, p.y - 54, p.x - 5, p.y - 59]).fill({
          color: tint,
          alpha,
        });
      } else if (isGood) {
        m.moveTo(p.x - 5, p.y - 60)
          .lineTo(p.x - 1, p.y - 56)
          .lineTo(p.x + 6, p.y - 65)
          .stroke({ color: tint, alpha, width: 2 });
      } else {
        m.moveTo(p.x, p.y - 67)
          .lineTo(p.x, p.y - 59)
          .stroke({ color: tint, alpha, width: 2 });
        m.circle(p.x, p.y - 55, 1.5).fill({ color: tint, alpha });
      }
    }
  }
}
