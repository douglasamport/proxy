# Land Clearing — Minigame Design Doc

## Overview

A turn-based, grid-movement minigame where a player's Proxy character enters
an unclaimed parcel of the machine wilderness to either **clear** it (convert
it into a buildable node or corridor for the war map) or **maintain** it
(prevent an already-claimed node/corridor from decaying back into
wilderness).

The wilderness is not static terrain — it is made of living, self-replicating
machines. Small spawners left alone mature into stronger turrets over time.
The player is on a clock created by this maturation, not by a fixed turn
limit or a timer.

This system feeds the larger Proxy Meta war map directly: successful clears
create new contestable nodes and the corridors between them. It also feeds
the trade economy: different parcels/nodes yield different scavengable
materials (e.g. neurofiber, used for twitch chassis), so no single house can
be self-sufficient.

## Core Loop

1. Player selects a parcel (node clear, corridor carve, or maintenance run)
   and enters with a loaded-out Proxy.
2. Player spends energy each turn on movement, combat, or mining actions
   across a grid.
3. Every action taken is one tick. Each tick, wilderness spawners on the
   grid mature one step (seed → juvenile → turret, or similar staged
   escalation — exact stage count TBD).
4. Player must balance: suppressing young spawners while they're cheap to
   kill, engaging mature turrets when unavoidable, and channeling on
   resource deposits to extract materials.
5. Run ends when energy is depleted or the player extracts. Whatever
   progress was made toward clearing/maintaining the parcel and whatever
   materials were gathered are banked at that point.

## Grid & Turns

- Turn-based movement on a grid, skirmish-style (similar in feel to
  Warhammer-style tactical movement), not real-time/reflex-based.
- No separate "turn counter" — the energy bar (see below) is the only pacing
  resource. There is no such thing as an idle turn; every action (including
  movement) costs energy and advances the wilderness clock by one tick.

## Energy System

- Each run gives the Proxy **100 energy**. This is the only limiting
  resource in this mode — there is no separate fuel/drive resource to
  ration alongside it.
- **Move**: costs a % of energy per move action. The Proxy's speed stat
  determines how many tiles that single move action covers (higher speed =
  more tiles per energy spent, not cheaper movement).
- **Fight**: costs a % of energy per action, scaled down by the Proxy's
  combat-relevant stats (better combat build = cheaper fighting).
- **Mine**: costs a fraction of 1% of energy per tick of channeling, scaled
  by the Proxy's mining-relevant stats. Mining is a multi-tick "hold
  position" action — the wilderness keeps maturing around the Proxy while
  it channels, so channeling is the moment of highest exposure.
- Every action of any type (move, fight, mine) is one tick for the purpose
  of spawner maturation, regardless of its energy cost.

## Wilderness Behavior (Spawner Maturation)

- Parcels contain wilderness spawners that generate small bots.
- Left alone, a spawner/bot matures over successive ticks into a stronger
  form — e.g. seed → small bot → turret — gaining strength as it goes.
- This creates the core tactical decision every run: kill cheap young
  threats now, or spend the energy elsewhere and deal with a much tougher
  target later.
- This is also the natural hook for an autopilot doctrine later (e.g.
  "always target the youngest spawner" vs. "always target the highest
  current threat"), consistent with the doctrine system used in the
  war/combat layer — not required for MVP, but worth keeping the data model
  compatible with it.

## Chassis & Loadout

- A Proxy has a **16-slot chassis rig** for this mode. There are no fuel
  cells/slots in land-clearing — all 16 slots are weapons, armor, or mining
  equipment.
- A viable mining-focused loadout realistically uses at most ~14 of those
  slots for mining/utility gear, because a minimum of ~2 slots of real
  combat capability is needed to survive contact with the wilderness. There
  is no viable "zero combat" loadout — every run pays some combat tax
  regardless of intent.
- **Open question:** does this 16-slot chassis share the same physical rig
  as the war-combat layer (i.e. war loadout and land-clearing loadout
  compete for the same gear), or is it a separate rig entirely? This needs
  to be decided before the data model is finalized, as it changes whether
  chassis/loadout is a shared table or mode-specific.

## Run Types

- **Node clear**: contained arena. Pacify the anchor threat(s) in a
  parcel to convert it into a buildable node. Shorter, higher spawner
  density relative to size, more combat-decision-dense.
- **Corridor carve**: a longer, linear route between two existing nodes.
  Spread out over more tiles, with roaming hazards along the path and
  periodic anchor threats rather than one central fight. More
  movement-and-triage heavy than node clears.
- **Maintenance run**: a smaller grid, lower spawner density, shorter
  effective scope — checking known trouble tiles on an already-claimed
  node/corridor and suppressing anything that has started regrowing.
  Uses the same engine/rules as a clear run, just with lighter parameters.
  Run less frequently than clears (holding territory costs less upkeep
  than claiming it).

## Decay

- A cleared node or corridor decays back into unclaimed wilderness if not
  maintained via maintenance runs. Exact decay rate/threshold TBD.

## Mining & Resources

- Kills drop generic scrap.
- Specific named materials (e.g. neurofiber) come from stationary deposits
  within a parcel and require channeling (see Energy System) to extract.
- Different parcels/nodes should be biased toward producing different
  materials, so that no single house/sept can source everything it needs
  from territory it already holds — this is meant to force trade, not just
  make it convenient.

## Integration with the War Map

- A successful node clear creates a new contestable node on the war map.
- A successful corridor carve creates a new conduit/corridor between two
  existing nodes.
- Whether a freshly cleared node/corridor is immediately contestable by
  rival houses or gets a grace window first is still an open design
  decision (see prior discussion — leaning toward immediately contestable
  to keep the map living, but not finalized).

## Open Questions / Not Yet Decided

- Number and thresholds of spawner maturation stages.
- Exact decay rate for unmaintained nodes/corridors.
- Whether the land-clearing chassis is shared with or separate from the
  war-combat chassis.
- Grace window (if any) before a freshly cleared node/corridor becomes
  contestable.
- Full list of scavengable materials and which parcels/biomes produce them.

## Suggested Build Scope for First Pass

- Single grid, single Proxy, no multiplayer — this is a solo/PvE mode.
- One run type first (node clear), before adding corridor carve and
  maintenance as parameter variants of the same engine.
- Minimum viable spawner behavior: two maturation stages (young, mature) is
  enough to prove out the triage tension before adding more.
- Energy system and chassis slots as specified above.
- Basic mining: one generic resource (scrap) and one named material
  (neurofiber) from a fixed deposit, to prove out the channeling mechanic
  before building full regional specialization.
