import type { World } from './world';

export const Connection = { North: 1, East: 2, South: 4, West: 8 } as const;

/**
 * 4-bit auto-tiling mask of orthogonal neighbours carrying the same network flag
 * (north = y - 1, east = x + 1, south = y + 1, west = x - 1).
 */
export function connectionMask(world: World, x: number, y: number, flag: number): number {
  const has = (nx: number, ny: number) =>
    world.inBounds(nx, ny) && world.hasInfra(world.index(nx, ny), flag);
  return (
    (has(x, y - 1) ? Connection.North : 0) |
    (has(x + 1, y) ? Connection.East : 0) |
    (has(x, y + 1) ? Connection.South : 0) |
    (has(x - 1, y) ? Connection.West : 0)
  );
}
