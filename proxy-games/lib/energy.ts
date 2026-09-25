// Persistent, cross-game character energy (see db/022_energy.sql and the
// Smashies/arena metagame outline). Mining's claim and refine's batch
// launch fee are its first real consumers; Authority jobs and Arena
// matches will draw from the same pool once they exist.
//
// Regen is lazy: nothing ticks in the background. `energy` and `energy_
// updated_at` are a checkpoint; the true current value is always
// recomputed from that checkpoint plus elapsed wall-clock time, and only
// written back when something actually spends energy (a plain read never
// writes, so an unlimited number of GETs cost nothing extra).
import { sql } from "@/db/client";

// 250 points, full in 6 hours at a steady drip, but *up to* 1000/day of
// real throughput for a character that keeps spending as it regens rather
// than letting the bar sit at the (much lower) cap — see the energy design
// conversation. Subscribed players get 50% more of both, keeping the
// "hours to fill from empty" ratio the same.
export const BASE_ENERGY_CAP = 250;
export const BASE_ENERGY_REGEN_PER_DAY = 1000;
export const SUBSCRIBED_MULTIPLIER = 1.5;
// Playtester accounts regen 10x faster — full from empty in ~36 minutes
// instead of 6 hours, so testing doesn't mean waiting on the same pool
// real players slowly fill. Cap is untouched, only how fast it fills.
// Stacks with subscribed (multiplies, doesn't override), same as any
// other player who happens to subscribe.
export const PLAYTESTER_REGEN_MULTIPLIER = 10;

const MS_PER_DAY = 86_400_000;

function capFor(subscribed: boolean): number {
  return subscribed ? BASE_ENERGY_CAP * SUBSCRIBED_MULTIPLIER : BASE_ENERGY_CAP;
}

function regenPerMs(subscribed: boolean, playtester: boolean): number {
  let perDay = BASE_ENERGY_REGEN_PER_DAY;
  if (subscribed) perDay *= SUBSCRIBED_MULTIPLIER;
  if (playtester) perDay *= PLAYTESTER_REGEN_MULTIPLIER;
  return perDay / MS_PER_DAY;
}

function projectedCurrent(
  stored: number,
  updatedAt: Date,
  subscribed: boolean,
  playtester: boolean,
): number {
  const cap = capFor(subscribed);
  const elapsedMs = Math.max(0, Date.now() - updatedAt.getTime());
  return Math.min(
    cap,
    Number(stored) + elapsedMs * regenPerMs(subscribed, playtester),
  );
}

export interface EnergyState {
  current: number;
  cap: number;
}

export async function getEnergy(characterId: string): Promise<EnergyState> {
  const [row] = await sql`
    select c.energy, c.energy_updated_at, p.subscribed, p.playtester
    from characters c
    join players p on p.id = c.player_id
    where c.id = ${characterId}
  `;
  const subscribed = row?.subscribed ?? false;
  const playtester = row?.playtester ?? false;
  const current = row
    ? projectedCurrent(
        row.energy,
        new Date(row.energy_updated_at),
        subscribed,
        playtester,
      )
    : 0;
  return { current, cap: capFor(subscribed) };
}

export type SpendEnergyResult =
  | { ok: true; remaining: number }
  | { ok: false; available: number };

// Atomic-enough for this: recompute the regen-adjusted current value,
// check it covers `amount`, write the new value + a fresh checkpoint. A
// concurrent double-spend could still both read the same pre-spend value
// (no row lock), same tradeoff lib/mining-inventory.ts's setEquipped-style
// functions already accept elsewhere in this codebase — worst case a
// narrow race lets one extra spend through before the next read corrects
// it, not worth a transaction for a resource this game-outcome-cheap.
export async function spendEnergy(
  characterId: string,
  amount: number,
): Promise<SpendEnergyResult> {
  const [row] = await sql`
    select c.energy, c.energy_updated_at, p.subscribed, p.playtester
    from characters c
    join players p on p.id = c.player_id
    where c.id = ${characterId}
  `;
  if (!row) return { ok: false, available: 0 };

  const subscribed = row.subscribed ?? false;
  const playtester = row.playtester ?? false;
  const current = projectedCurrent(
    row.energy,
    new Date(row.energy_updated_at),
    subscribed,
    playtester,
  );
  if (current < amount) return { ok: false, available: current };

  const remaining = current - amount;
  await sql`
    update characters set energy = ${remaining}, energy_updated_at = now()
    where id = ${characterId}
  `;
  return { ok: true, remaining };
}
