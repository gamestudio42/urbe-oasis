import { BALANCE, RejectReason, type CommandResult, type PolicyCommand } from '@city/shared';
import type { SimulationEngine } from '../engine';

const MAX_NAME_LENGTH = 40;

export function applyPolicyCommand(
  engine: SimulationEngine,
  command: PolicyCommand,
): CommandResult {
  const ok: CommandResult = { ok: true, cost: 0, applied: 1, skipped: 0 };
  const invalid: CommandResult = {
    ok: false,
    cost: 0,
    applied: 0,
    skipped: 0,
    reason: RejectReason.Invalid,
  };
  switch (command.type) {
    case 'setTax': {
      if (!Number.isFinite(command.rate)) return invalid;
      engine.economy.taxes[command.zone] = clampInt(command.rate, 0, BALANCE.economy.taxMax);
      return ok;
    }
    case 'setFunding': {
      if (!Number.isFinite(command.value)) return invalid;
      engine.economy.funding[command.department] = clampInt(command.value, 0, 100);
      return ok;
    }
    case 'setDisasters':
      engine.disastersEnabled = command.enabled;
      return ok;
    case 'rename': {
      const name = command.name.trim().slice(0, MAX_NAME_LENGTH);
      if (name.length === 0) return invalid;
      engine.name = name;
      return ok;
    }
    case 'triggerDisaster':
      return engine.triggerDisaster(command.disaster, command.x, command.y) ? ok : invalid;
  }
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
