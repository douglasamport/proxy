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

// A single conditional UPDATE, same shape as the "balance >= cost" atomic
// deduct pattern used everywhere money is spent (see purchaseItem() etc.
// in this file) — the regen-projection formula is reproduced in SQL so the
// check-and-spend happens as one statement instead of a separate read then
// write. That matters here specifically because energy is shared across
// two different games (mining, refine): a mining launch and a refine
// launch firing in the same instant both need to see each other's spend,
// not just two clicks on the same button — a read-then-write in
// application code can't guarantee that, a single atomic UPDATE can.
export async function spendEnergy(
  characterId: string,
  amount: number,
): Promise<SpendEnergyResult> {
  const [spent] = await sql`
    with current_state as (
      select
        c.id,
        least(
          case when p.subscribed then ${BASE_ENERGY_CAP * SUBSCRIBED_MULTIPLIER}::numeric else ${BASE_ENERGY_CAP}::numeric end,
          c.energy + extract(epoch from (now() - c.energy_updated_at)) * 1000
            * ${BASE_ENERGY_REGEN_PER_DAY}::numeric
            * (case when p.subscribed then ${SUBSCRIBED_MULTIPLIER}::numeric else 1 end)
            * (case when p.playtester then ${PLAYTESTER_REGEN_MULTIPLIER}::numeric else 1 end)
            / ${MS_PER_DAY}::numeric
        ) as current
      from characters c
      join players p on p.id = c.player_id
      where c.id = ${characterId}
    )
    update characters c
    set energy = current_state.current - ${amount}::numeric, energy_updated_at = now()
    from current_state
    where c.id = current_state.id and current_state.current >= ${amount}::numeric
    returning current_state.current - ${amount}::numeric as remaining
  `;
  if (spent) return { ok: true, remaining: Number(spent.remaining) };

  // Didn't clear the bar — read back the real current value (regen-
  // adjusted) for the error message. No write, so no race to guard here.
  const { current } = await getEnergy(characterId);
  return { ok: false, available: current };
}

// Compensating credit for a spend whose larger action (a run launch, a
// batch launch) turned out not to happen after all — e.g. lost a race
// against a concurrent launch on the same row. A plain additive UPDATE is
// enough here (unlike spendEnergy, nothing needs to check a threshold
// first), shared so mining's and refine's launch routes don't each hand-
// roll the same statement.
export async function refundEnergy(
  characterId: string,
  amount: number,
): Promise<void> {
  await sql`
    update characters set energy = energy + ${amount}::numeric, energy_updated_at = now()
    where id = ${characterId}
  `;
}
