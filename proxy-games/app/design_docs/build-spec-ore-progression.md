# Build Spec — Ore Taxonomy, Progression, and the Ore Economy

*Staged build for the mining minigame. Nine stages (0–8), each shipping something playable. Build them in order — several depend on decisions made in earlier stages, stage 0 is a prerequisite for verifying any of the others, stage 6 will break the autopilot guardrail if stages 1–5 are not settled first, and stage 8 (hazards and bonuses, split out from stage 6) needs stage 7's balance pass to land on.*

---

## Context

The mining game currently works and is balanced. A run is: fit a chassis from hull volume, buy a survey, claim 20/35/50 energy, fly a fog-of-war grid, extract ore, get scored against an autopilot baseline.

**Invariants that must survive every stage below:**

- **Presence improves quality, never quantity.** Skill changes what comes back, not how much.
- **The autopilot stays viable but mediocre.** Under 10% losing runs. Grade well below what a good pilot achieves.
- **Failure costs the run's output, never access to play.** Nothing here destroys a chassis.
- **Fog is the anti-cheat.** The server never sends the client cells it has not earned.

Two bugs were found the hard way and must not be reintroduced. The autopilot once cherry-picked high-grade ore because a profit filter acted as a grade-gated travel permit. It once oscillated between two equally-scored targets until it ran dry. Both were invisible in single runs and obvious across 300 seeded batches. **Verify statistically, not anecdotally.**

**Autopilot tuning is deferred to Stage 7.** The Stage 0 harness (below) exists and works, but the "<10% losing runs" figure in the invariant above is a *target* for the end of this build, not a gate on Stages 1–6. The current 10-slot game is genuinely hard early on — the autopilot losing a lot right now reflects that difficulty, not a bug. Use the harness through Stages 1–6 only for "did this stage change the numbers at all" regression checks against whatever the baseline was before that stage, not against the 10% target. Actually hitting the target is Stage 7's job, alongside the rest of the balance work there.

---

## Ore taxonomy

Multipliers are **per ore**, not per tier. Iron is worth twice copper despite both being tier 1.

| Tier | Ore | Grade spread | Multiplier | Grade-4 unit value |
|---|---|---|---|---|
| **1 — Common** | Copper | 1 / 2 / 8 / 20 | ×1 | 20 |
| | Zinc | 1 / 2 / 8 / 20 | ×1.5 | 30 |
| | Iron | 1 / 2 / 8 / 20 | ×2 | 40 |
| **2 — Precious** | Silver | 1 / 2 / 6 / 18 | ×5 | 90 |
| | Gold | 1 / 2 / 6 / 18 | ×8 | 144 |
| | Platinum | 1 / 2 / 6 / 18 | ×12 | 216 |
| **3 — Semiconductor** | Silica | 1 / 2 / 5 / 15 | ×20 | 300 |
| | Germanium | 1 / 2 / 5 / 15 | ×28 | 420 |
| | Cadmium | 1 / 2 / 5 / 15 | ×35 | 525 |
| **4 — Rare earth** | Neodymium | 1 / 2 / 4 / 8 | ×60 | 480 |
| | Yttrium | 1 / 2 / 4 / 8 | ×80 | 640 |
| | Lanthanum | 1 / 2 / 4 / 8 | ×100 | 800 |
| | Tantalum | 1 / 2 / 4 / 8 | ×130 | 1040 |

**The spread is the grade ramp within an ore type. The multiplier is applied on top.** Rare earth has a deliberately flat internal spread — finding it at all is the win, not finding a good grade of it. Common ore is the opposite: abundant, with wide grade variance, and that variance is where shallow skill shows.

### Depth gates

Normalised distance from base, 0 at the mouth to 1 at the far corner. Same mechanism as the existing `TIER_GATE`.

| Tier | Depth gate |
|---|---|
| 1 | 0.00 |
| 2 | 0.35 |
| 3 | 0.55 |
| 4 | 0.72 |

Common ore remains common at every depth. Ore-type selection per pocket is weighted so that finding rare earth is genuinely rare, not merely deep.

---

## Map scaling

**Each unlocked mineral adds +2 to both map dimensions. Rare earth minerals add nothing.**

Base map is 14×10. Nine non-rare minerals exist, of which copper is unlocked at start.

| Unlocked minerals | Map size |
|---|---|
| Copper only (start) | 14×10 |
| All tier 1 | 18×14 |
| All tiers 1–2 | 24×20 |
| All tiers 1–3 | 30×26 |
| All tiers 1–4 | 30×26 |

At full unlock the field is roughly four times its starting area. **This is intended. Reaching depth should be a grind and a genuine risk.**

---

## Stage 0 — Autopilot statistical harness

A prerequisite for every acceptance check in this doc — not in the original seven, but nothing below can be verified without it, so it goes first.

- A script that runs `createRun(seed, chassis, claim)` → `runAI(seed, chassis, claim)` → `score()` across N seeds (300 by default, parameterizable) and reports: losing-run rate, average grade, claim-fill rate.
- No engine changes. This just gives every later "statistically unchanged" / "<10% losing runs" acceptance line something real to check against.

---

## Stage 1 — Ore taxonomy as data

Ore types exist in the data model. No gameplay change.

**Naming note:** the engine currently calls the per-pocket 1–4 quality axis `tier` (`Cell.tier`, `GRADE_VALUE`). That name collides with this doc's "Tier 1–4" (Common/Precious/Semiconductor/Rare-earth), which is a different axis — which mineral, not how good this particular pocket of it is. Stage 1 renames the engine field to `grade` and adds a separate `oreType` field per cell (which mineral; its rarity tier and `depth_gate` live on the `ore_types` row it points to). `Cell.grade` stays exactly what `Cell.tier` is today — an index into that ore type's own `grade_values[4]`.

- Add an `ore_types` catalog: `key`, `label`, `tier` (rarity class 1–4, per the taxonomy table), `grade_values[4]`, `value_multiplier`, `depth_gate`, `adds_map_size`.
- Existing ore in generated fields becomes copper.
- Field generation places ore types respecting `depth_gate`. With only copper unlocked, nothing changes about where ore appears.
- The engine's scoring reads `grade_values` and `value_multiplier` from the ore type rather than the hardcoded `GRADE_VALUE` array.
- `Cell.units` (the random 2–7 quantity per pocket) is unchanged and stays independent of grade — grade is still a *price* multiplier per unit, not a quantity. See Stage 3 for how this becomes a flat per-ore quantity in the player's inventory.

**Ships:** identical gameplay. Pockets now say "Copper" rather than only a grade number.

**Acceptance:** run the Stage 0 autopilot sweep. Losing-run rate and average grade must be statistically unchanged. If they moved, the refactor changed behaviour.

---

## Stage 2 — Ore inventory and the keep-or-cash decision

A run's output becomes a choice.

- Extend the existing inventory to hold ore **by type only** — one item per ore (13 rows total: copper, zinc, iron, silver, gold, platinum, silica, germanium, cadmium, neodymium, yttrium, lanthanum, tantalum). Grade is not a separate inventory dimension; see the conversion rule below. Ore is a new item category, not a new system.
- **Profit is calculated and displayed at the end of every run regardless of choice.** The player then chooses **Collect credits** or **Stockpile ore**.
- The choice is per-run, not per-ore-type.
- Stockpiled ore displays in the inventory grid via `InventoryCard`.
- Ore storage is unlimited. Add a cap later only if hoarding proves to be a problem.

**Ships:** the first real link to the refinery, and a genuine decision at the end of every run.

---

## Stage 3 — Selling

Closes the economy loop.

- **Ore sells at exactly its cash-in value.** Cash-in price and sell price are identical. The reason to stockpile is that refining turns ore into something worth more than either — never an artificial spread.
- **One flat sell price per ore type, not per grade.** The engine's existing extraction math is untouched — a pocket still yields a random 2–7 units, each already worth `grade × ore multiplier × base price` by the time it's mined (see Stage 1). What changes is how that computed value becomes inventory: at bank time, the run's total mined value for that ore type converts into a *quantity* of the ore's single flat-priced item (`quantity = value / sell_price`, rounded). A grade-4 haul doesn't get a better price — it becomes a bigger pile of the same item, because it was worth more to begin with. This is why one row per ore is enough: price never varies, only how much of it you're holding.
- **Buy price is a fixed markup over sell price, by rarity tier** — not live yet (no buy-side market exists), but stored now so the schema doesn't need revisiting when it does:

  | Tier | Ore | Buy price = sell price × |
  |---|---|---|
  | 1 — Common | Copper, Zinc, Iron | 1.2× |
  | 2 — Precious | Silver, Gold, Platinum | 2× |
  | 3 — Semiconductor | Silica, Germanium, Cadmium | 10× |
  | 4 — Rare earth | Neodymium, Yttrium, Lanthanum, Tantalum | 100× |

  Rare earth's markup is deliberately punishing — buying it from an NPC store should never be a sane option. The intent is a market that's almost entirely player-driven eventually: mining is how you get rare earth cheap, and the (future) player-to-player market is how it actually circulates. A player who wants rare earth without mining pays a 100x premium, on purpose.
- Copper's sell price is the anchor; every other ore's sell price is copper's price × that ore's `value_multiplier` from the taxonomy table (Stage 1).
- No live buy/sell UI in this stage — just `cost` (buy price) and a new `sell_value` on the ore catalog rows, populated and ready for the store surface Stage 5 adds.
- **Components sell back at 50% of purchase price.** This is a different mechanism from ore's flat stored price — equipment's `sell_value` is a *ratio of its own cost*, ore's is an *independently stored* number. Same two columns on `item_catalog`, two different rules depending on category.
- **Chassis expansion slots cannot be sold.** A sold slot is indistinguishable from an unpurchased one and would corrupt the doubling-cost calculation.
- Add `sellable` and `sell_value` to the item catalog rather than hardcoding 50%.

**Ships:** a working two-way economy. Fitting mistakes become recoverable at a cost.

---

## Stage 4 — Upgrade items

New equipment tiers, purchased from the survey store. **Efficiency, not capacity.**

Range is capacity × efficiency. Scaling capacity alone collapses the fitting game into "all fuel, always" — a better drive makes every fuel slot already owned worth more, which keeps cargo and sensors competitive for hull volume.

### Drive tiers

| Tier | Fuel per fresh dig | Effect at full map depth |
|---|---|---|
| Current | 1.49 | One thin haul, no margin |
| **Tier 2** — −30% | 1.04 | One comfortable haul |
| **Tier 3** — −50% | 0.75 | **Two hauls** |

Tier 3 buys a second trip. That is the meaningful unlock — not merely surviving the first. **Do not scale beyond −50%.** Quartering makes depth trivial and removes the gamble.

### Fuel types

A separate axis from drive tier. Denser fuel is a **capacity** multiplier; drive tier is an **efficiency** multiplier. Both exist so that late-game fitting is a genuine choice between them rather than a single ladder.

Sold by the survey store, up to four fuel grades.

### Equipment consumables

Single-run items, purchased before a run, consumed on use. These are what make deep runs survivable rather than binary:

- **Emergency jettison** — dump the hold to cut fuel cost sharply and run for home. Turns a doomed run into a survivable one at the cost of everything carried.
- **Ore siphon** — burn carried ore for fuel. Trades quantity for range.
- **Seismic charge** — reveal a 3×3 block instantly, destroying roughly 20% of the ore in it. Buys certainty with value.
- **Shoring kit** — prevents collapse and flooding behind you. Insurance; dead weight on a clean run.

---

## Stage 5 — The survey store and mineral unlocks

The mechanism for unlocking new ore.

- New store surface, same shape as the existing item store, reusing `ItemCard` and `FilterBar`.
- **Licences are sold per mineral, not per tier.** Thirteen separate unlocks.
- Unlock state is per player. A licence makes that mineral eligible for field generation and adds its map-size bonus.
- Also sells drive tiers, fuel types, and consumables from stage 4 — and, eventually, ore itself, using the `cost`/`sell_value` pair Stage 3 already populates. This is where "almost entirely player driven" starts to matter: a live buy side is the last piece before ore can circulate between players instead of just draining into an NPC price.
- Licence prices are large enough that each unlock is a milestone. Tier 4 licences should take a long time to afford.

**Acceptance:** a player with only the copper licence generates fields statistically identical to today's.

---

## Stage 6 — Map scaling and deep ore

Unlocked minerals appear and the map grows. **This is the riskiest stage.**

- Field dimensions become a function of unlocked minerals per the map scaling table.
- Field generation respects `depth_gate` — tier-4 pockets exist only beyond 0.72 normalised distance.
- Hazards and bonuses (fuel caches, slip faults) are deliberately deferred to Stage 8, once there's a map big enough for them to matter and a balance pass (Stage 7) to tune around. Not needed to hit this stage's acceptance table below.

**Acceptance — run the full statistical sweep at every unlock level:**

| Unlock state | Autopilot losing runs | Claim fill rate at 35E |
|---|---|---|
| Copper only | <10% | >90% |
| All tier 1 | <10% | >85% |
| Tiers 1–2 | <10% | >80% |
| Tiers 1–3 | <10% | >75% |
| All tiers | <10% | >75% |

If losing runs exceed 10% at any unlock level, the map has outgrown the fuel economy. Fix it in stage 7 before shipping.

---

## Stage 7 — Progression and balance

- Verify the drive tiers and fuel types make each unlock level reachable without making it safe.
- **Target roughly a 40% failure rate on tier-4 runs for a fully-upgraded rig.** Deep mining must remain a gamble. If a maxed rig reaches tier 4 reliably, depth stops being a bet and shallow ore becomes dead content.
- **The test that matters: do players ever choose a shallow run?** If the answer is never, depth is too safe regardless of what the payout maths says.
- At 60% success, deep runs should be clearly profitable in expectation. The grind for licences, drive tiers and fuel is the gate; once a player is through it, the payoff should land.
- Claim sizes stay capped at 50. Deep runs bring back **less tonnage of more valuable ore**, which preserves flat quantity.
- Re-verify the autopilot statistically at every unlock tier.

---

## Stage 8 — Hazards and bonuses

Split out from Stage 6: needs a map big enough for this content to be reachable, and a fuel economy already balanced (Stage 7) to layer it onto rather than compensate for.

- **Fuel caches** — a mid-run refill, placed like the existing gas/seam/cavern scatter. Turns a marginal deep run into a profitable one; existence alone shouldn't make a bad fit good.
- **Slip faults** — shunts the rig 2–3 cells and ends the move immediately, forcing a bail-or-push decision rather than being a pure penalty.
- Re-verify the autopilot statistically once these exist — they change reachability, which is exactly what the cherry-picking/oscillation bugs fed on before.

---

## Risks

**Map size is the dangerous variable.** Fuel is the binding constraint on every run. A map that grows without drive efficiency growing makes every run worse, and the autopilot — hard-capped at 20% of tank reach — stops being able to reach anything. Scale drive tiers alongside map size and re-run the sweep at every unlock level.

**The autopilot will never reach tier 3 or 4. This is intentional.** Its reach cap is a fixed fraction of tank, so no amount of fuel scaling changes the ratio. **Unattended runs cannot bring back semiconductor or rare-earth ore.** Deep ore is pilot-only, permanently. Autopilot is how a player grinds copper and iron while doing something else; rare earth is why they sit down and fly. State this plainly in the UI rather than letting players discover it as an apparent bug.

**Grade inflation breaks comparison.** With multipliers, average grade is no longer comparable across ore types — grade 4.0 in rare earth is worth fifty times grade 4.0 in copper. **The run summary and any leaderboard must switch to credits-per-unit or a normalised score.**

**Cherry-picking, again.** The autopilot filters targets on profit and scores them on proximity. Value multipliers make deep ore dramatically more profitable, which is precisely the condition that produced the original cherry-picking bug. After stage 6, measure the grade distribution of what the autopilot extracts against what is in the ground and confirm it is still taking roughly field average rather than skimming the best.

**Credit inflation across the progression.** The same 50-unit claim yields roughly 500 in copper or many thousands in rare earth. Store prices, the expansion-slot doubling curve, and licence costs all need to scale with unlock tier, or late-game players buy everything trivially and the economy flattens.
