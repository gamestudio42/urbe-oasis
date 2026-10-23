/** Which set of rules a simulation runs. `classic` is Urbe; `neon` adds the cyberpunk systems. */
export type Ruleset = 'classic' | 'oasis';

export const RULESETS: readonly Ruleset[] = ['classic', 'oasis'];

export function isRuleset(value: unknown): value is Ruleset {
  return value === 'classic' || value === 'oasis';
}

/** The ruleset a save or snapshot uses; missing means `classic` (pre-ruleset saves). */
export function rulesetOf(value: unknown): Ruleset {
  return isRuleset(value) ? value : 'classic';
}
