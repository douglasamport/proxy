# Minigame v2 — The Refinery

*Second game in the proxy-games line. Shares resources with the mining run (ore in, refined units out, fuel consumed) but is deliberately a different **kind** of game. Where mining is spatial and exploratory, refining is attentional and reactive.*

---

## 0. What this game is, and what it must not be

**The question mining asks:** where is the value, and can I reach it? Spatial, information-limited, one decision at a time.

**The question refining asks:** several things need me at once — which do I sacrifice? Attentional, time-pressured, triage under rising tempo.

If both games end up feeling like the same puzzle in a different costume, this design has failed.

### The failure mode to design against

Most refining systems in published games are queue-and-wait: dock material, set a recipe, walk away, collect. Albion Online's refining is the canonical complaint — players describe it as a non-activity. Scrap Mechanic's Refinebot is the same shape, just better integrated. **A refining system with no moment-to-moment decision is a chore with a progress bar.**

The second failure mode is subtler: a **recipe or lookup mechanic**. Even dressed up as pattern-matching, a recipe is solved once and then merely executed. Skill decays into memory. Rejected for that reason.

### The shape that works

Borrowed structurally from arcade multi-lane serving games (Tapper and descendants). The insight worth stealing:

> **No single lane is hard. Being needed by four lanes at once is hard.**

Difficulty comes from **simultaneous demand exceeding single-threaded attention**, not from any individual correction being difficult. That is the whole design.

---

## 1. Inherited rules

Non-negotiable, carried from Mechanics v1 and Minigame v1:

- **Presence improves quality, never quantity.** A batch produces the same tonnage whether tended or not. Attention changes *grade* and *efficiency*.
- **Autopilot must be viable.** A baseline exists, completes batches reliably, and produces mediocre output. Running unattended is a legitimate choice, not a punishment.
- **Nothing measures time below a day** at the meta level. Real-time tempo exists *inside* a batch, which is a bounded few minutes — it never becomes a persistent session or a login-timing pressure.
- **Wealth cannot buy skill expression.** Upgrades change *what problem you are solving*, never substitute for solving it.

---

## 2. The batch

A batch is a fixed quantity of ore — say 500 units — held as **blocks in mixed grades**, using the same grade values as mining (1 / 3 / 8 / 20). Blocks arrive in random order from the batch's composition.

The batch is the unit of commitment, equivalent to a mining claim. Ore comes from the player's own mining runs, bought from other players, or purchased from the system at floor price.

**Higher-grade feedstock is worth more and is harder to process** — narrower tolerances, faster drift, more heat dumped per block. A good mining run therefore hands you a *harder* refining problem. Skill in one game creates the problem the other game's skill has to solve.

---

## 3. The pipeline

Three stages, strictly sequential. **The pipeline shape is the point**: a problem upstream does not stay upstream, and most of the difficulty comes from stages fighting each other rather than from any stage being hard alone.

### Stage 1 — Melt

Blocks are fed into the furnace and melted into the vat.

- Different grades require different heat to melt cleanly
- **The player controls feed rate and sequencing** — which block goes next, and how fast
- Heat used to melt is dumped into the vat as a side effect

**Why this is a real decision, not a setting:** melting a grade-20 block loads far more heat into the vat than a grade-1. So melt sequencing is not "apply correct heat," it is *choosing what to melt next given what the vat can currently absorb.* This permanently couples stage 1 to stage 2.

### Stage 2 — Vat

The molten pool. The busiest stage and the heart of the game.

Simultaneously requires:

- **Decanting** refined ore onward to the cooler
- **Removing waste/slag**, which accumulates continuously
- **Managing heat**, which rises from melting and falls when decanting
- **Managing pressure**, which rises with heat and with waste accumulation

**Vat capacity is a hard ceiling.** Melt faster than you decant and it overflows. This locks melt rate and decant rate in permanent tension — the single most important coupling in the design.

**Waste actively degrades the system rather than merely accumulating.** Slag raises pressure and insulates, making heat harder to shed. Ignoring waste does not cost a little yield; it makes every other variable worse. This is the design's equivalent of the returning mugs in Tapper — the secondary task that punishes tunnel vision hardest.

### Stage 3 — Cool

Decanted material sheds heat and solidifies into output units.

**The cooler has thermal mass and does not reset instantly.** Dump hot material in faster than it sheds and it saturates — which backs up into the vat, because you cannot decant into a full cooler. An upstream problem with a downstream cause, and vice versa.

---

## 4. Mechanics specification

*Concrete first-pass numbers. All values are starting points for tuning, not fixed rules — the coupling relationships matter more than any individual figure.*

### 4.1 Ore blocks and the offer

A batch is **500 units** of ore. Three blocks are on offer at any time, each of a random grade.

**Grades: 1 / 2 / 8 / 20 units.** Grade determines slag produced, melt time, and heat contributed.

| Grade | Slag range | Melt time | Ore : slag |
|---|---|---|---|
| 1 | 1–4 | 500ms | 0.25–1.0 |
| 2 | 3–7 | ~760ms | 0.29–0.67 |
| 8 | 5–10 | ~1740ms | 0.8–1.6 |
| 20 | 8–12 | 3000ms | 1.67–2.5 |

**Melt time is sublinear** — a 20-unit block takes 6× as long as a 1-unit block, so per-unit cost falls from 500ms to 150ms. Large blocks are time-efficient to process. Fits `500ms × units^0.6` closely if a formula is preferred to a lookup table.

**High grade is better on every axis**: more ore per slag, less melt time per unit, more heat per block. The tension is not that big blocks are worse — it's that they *commit* you for longer, both in melt time and in refill delay.

### 4.2 Offer refill

**Blocks are not replaced instantly.** Consuming a block starts a refill timer on that slot; the offer can therefore be down to two, one, or zero blocks.

This matters: without it, the player never faces a bad hand. With it, there are genuine moments where the only options are two grade-1 blocks and the choice is to burn them or wait.

**Refill time should scale with the block that vacated the slot** — a 20-unit block leaves a longer gap than a 1-unit block. This makes "burn small blocks to churn the offer" a deliberate play rather than an accident, and adds a second cost to committing to a big block beyond its melt duration.

### 4.3 Assay

Reveals a block's exact ore/slag split before committing to it.

**Assay costs time only — never ore.** The block is drawn from the 500-unit pool when it is *melted*, not when it is inspected. Time is already a real price in a game where every other system drifts while you are not attending to it, and this keeps the parallel with the mining survey intact: information costs latency, not material.

### 4.4 Melting

**Press and hold.** This is the single most important interaction in the design.

Holding to melt means the player **physically cannot do anything else while melting.** That is what makes attention genuinely exclusive rather than merely busy — the difference between triage and rapid clicking.

> **Protect this.** If any other action becomes a hold, or if melt becomes a click, the entire triage structure softens and the game becomes a clicking exercise.

When a block melts, **only its ore contributes heat to the tank** — slag adds volume but no heat on entry.

### 4.5 The tank

Four tracked quantities:

| Quantity | Rises with | Falls with |
|---|---|---|
| **Heat** | Melting ore | Dumping to the cooler |
| **Pressure** | Heat; slag volume | Continuous decay; the vent valve |
| **Ore volume** | Melting | Decanting |
| **Slag volume** | Melting | Manual removal |

**Separation** of ore from slag runs continuously, at a rate governed by pressure. There is an **optimal pressure** at which separation is fastest; above or below it, separation slows.

### 4.6 Slag has a dual nature — this is the core of the tank

Slag is simultaneously a **problem** and a **requirement**:

- **Slag insulates.** More slag makes the tank less able to shed heat to the cooler. It does not generate heat — it *resists cooling*, which is a more interesting failure than a second heat source because it degrades a system rather than adding to a number.
- **Slag sustains pressure.** Pressure decays continuously. Slag is what resists that decay. A perfectly clean tank bleeds pressure too fast, pressure falls below optimal, and **separation stalls.**

**The consequence:** the ideal slag level is a maintained middle, never zero. Too little and pressure collapses; too much and heat cannot be shed. The tidy player loses, and the negligent player loses differently.

This also reframes slag removal from a chore into a real decision — you are not clearing slag to zero, you are trimming it into a band.

**Pressure decay should be flat, not proportional.** Proportional decay makes pressure self-stabilising and reduces the need to attend to it. Flat decay makes both ends genuinely dangerous, which suits a game about holding a middle.

### 4.7 The action bar — the counterweight to heat

**A capped, continuously recharging action pool. Every player action costs action, and a button cannot be pressed without the action to pay for it.**

This is the structural counterweight to the heat system. Heat constrains *how much ore you can process*; the action bar constrains *how much you can attend to while processing it*. Without it, a fast clicker can genuinely tend every system at once — slag, vent, decant and cool are all clicks, and nothing stops quick hands from doing all four in a window where a slower player manages two. That turns a triage game into a dexterity contest.

With it, attention is a **budgeted resource rather than a reflex speed**, and the game rewards choosing well rather than clicking fast. That is the axis this design is supposed to live on.

**Rules:**

- **Capped, not banked.** A full bar wastes recharge, so there is always something worth doing. Banking would invite a "wait for full, then burst" pattern that flattens triage into a rhythm.
- **Recharge pauses while melting.** A long melt is a hard commitment with no recovery — you emerge from it with an empty bar and a hot tank.
- **Melt costs both.** It consumes the hold *and* drains action while held. The hold makes attention physically exclusive; the action cost makes it economically expensive.

**Differential pricing is now a real design lever**, which the design previously lacked. First-pass ordering, to be tuned:

| Action | Relative cost | Reasoning |
|---|---|---|
| **Vent** | Cheapest | Must stay reflexive — see the testing note below |
| **Remove slag** | Low | Frequent, unglamorous, competes constantly |
| **Cool (tray)** | Moderate | Timed, discretionary |
| **Decant** | Moderate | Deliberate, occasional |
| **Melt** | Highest *(start here, expect to change)* | Creates every downstream problem |

**Slag removal upgrades become genuinely strategic under this system.** "Remove 5" should cost more action than "remove 1" but meaningfully less than five separate clicks — so the upgrade buys **action efficiency**, not merely fewer clicks. That turns the cheapest upgrade in the game into a real strategic purchase rather than an RSI fix.

#### Testing considerations

**Two knobs do similar work and feel different.** Pausing recharge during melt makes a long melt feel like *holding your breath*; raising melt's action cost while letting the bar tick makes it feel like *paying a toll*. Both are available. Which one dominates is a texture decision that can only be made in play — start with recharge paused and tune from there.

**Melt-as-most-expensive is a starting position, held loosely.** Melting already carries three costs: the hold blocks everything, the heat must be shed later, the slag must be trimmed later. A fourth cost on top may over-tax it. **The symptom to watch for is under-melting** — players idling with an empty tank because committing feels too expensive. If that appears, drop melt's action cost rather than buffing something else.

**Venting must stay cheap enough to be reflexive.** If a forced vent is loud and expensive *and* the action that prevents it costs meaningfully, players get punished for a mistake they could see coming but could not afford to prevent. That reads as unfair rather than hard, and it is the fastest way to make the action bar feel like a straitjacket instead of a budget.

### 4.8 Player actions on the tank

Every one of these costs action from the bar (§4.7) as well as the input listed.

| Action | Input | Notes |
|---|---|---|
| **Melt** | Hold | Exclusive — blocks all other action. Drains action while held; recharge paused |
| **Vent** | Click | Sheds pressure. Must stay the cheapest action |
| **Remove slag** | Click | 1 unit per click at base. **The cheapest upgrade in the game** raises this to 2, then 5 — buying action efficiency, not just fewer clicks |
| **Dump heat** | Click/hold | Transfers heat to the cooler; efficiency reduced by slag insulation. Only sheds while actively dumped to (§6.1) |
| **Decant** | Click | Converts separated ore into a finished unit |

### 4.9 Decant quality

Decant converts ore to finished units at a ratio set by tank conditions at the moment of decanting:

- **Best: 5 ore → 1 unit**
- **Worst: 10 ore → 1 unit**

Quality is a function of **heat, pressure, and slag level** together.

**A visible decant quality meter is required, with a marked sweet spot.** Three hidden variables feeding one outcome means a bad decant is indistinguishable from bad luck. The player must be able to see *why* a decant went badly, or the failure produces resentment rather than learning.

**Two separate upgrades, deliberately distinct:**

- **Readout upgrade** — a finer, more precise meter. Buys *information* about the same problem.
- **Tolerance upgrade** — widens the actual sweet spot. Buys *forgiveness*, changing the problem itself.

The second fits the "upgrades change what problem you're solving" principle better; having both makes them meaningfully different purchases.

### 4.10 The cooler

A heat sink that dissipates at a constant rate set by **fan power and cooling fins**, both upgradeable, and **adjustable by the player during a batch.**

**It only sheds heat while actively dumped to** — it is not a passive drain. See §6.1; this is the single decision that makes heat the batch's bottleneck rather than a background number.

Cooling is slower when the chamber is already hot. The sink has a **hard ceiling**: exceeding it ends the run (§6.6).

### 4.11 The cooling tray and the oscillation

Finished units land in the tray and **oscillate in value between 50% and 100%.** A click banks the unit at its current value — timing the middle of the oscillation yields maximum value, catching either end yields the minimum. Banked heat transfers to the sink.

**Oscillation runs faster when the sink is cold, slower when the sink is hot.**

This inversion is **deliberate and load-bearing.** Without it there is no reason to ever run the fins below maximum, and a lever permanently pinned to one setting is not a lever. The trade it creates:

| Sink state | Cooling throughput | Timing difficulty |
|---|---|---|
| **Cold** | Fast | Hard — rapid oscillation |
| **Hot** | Slow | Easy — slow oscillation |

**Tuning warning:** the value gap between a well-timed and badly-timed cool must be large enough that a player would sometimes deliberately choose to run hot. If cooling throughput dominates the maths, everyone pins the fins at maximum and eats the timing loss — and the lever exists without the decision.

**Uncollected units auto-cool at 25% value** after a timer. This is the pressure that makes the tray compete for attention with everything upstream.

### 4.12 Open parameters

- Optimal pressure band width, and how sharply separation degrades outside it
- Flat pressure decay rate, and how much slag volume offsets it
- Slag insulation curve — linear, or accelerating at high volume?
- Cooling fin range, upgradeable bounds (the originally sketched 1/500ms → 5/1ms is a 2500× span and was a typo; the real range should be tuned against batch length)
- Refill timer scaling by block grade
- Assay duration relative to melt duration
- The exact heat/pressure/slag → decant quality function
- Action bar: cap size, recharge rate, and the per-action cost table (§4.7)
- Whether melt's action drain is flat or scales with block size — a 20-unit block holding the bar at zero for 3 seconds is very different from a 1-unit block

---

## 5. Additional stages worth considering

Not required for a first build; each adds a distinct kind of decision rather than another dial.

**Assay / grade sorting (before melt).** Incoming blocks arrive unlabeled or partially labeled. Spend time identifying grade before committing to a heat setting, or guess and risk over/under-melting. Directly reuses the mining game's uncertainty language, and gives the analyser/sensor concept a job here too.

**Separator (between vat and cooler).** Decanted material is ore plus entrained waste. The separator trades throughput for purity: slow and hot for clean output, fast for volume with contamination that downgrades the product. **This is the primary quality-versus-quantity dial** — where a skilled player *earns* grade rather than merely avoiding failure.

**Packaging (after cool).** Output units need containment before they oxidise or cool past spec. Not a variable to balance — a **tempo task** competing for the same single-threaded attention as everything else. This is what makes late-batch triage genuinely brutal.

---

## 6. Heat, escalation, and failure

### 6.1 Heat is the bottleneck, and the sink is the only exit

Heat is conserved. It enters by melting ore at a variable rate and leaves only through the sink, at a maximum constant rate set by fans and fins.

**The sink only sheds heat while the player is actively dumping to it.** It is not a passive buffer that drains while you attend to something else. This is deliberate and harsh: every moment spent melting, venting, trimming slag or timing a cool is a moment heat is *not* leaving the system. Stopping to do anything else has a heat cost, and the pressure never fully lets up.

Total heat processable in a batch is therefore bounded by `sink rate × time spent dumping` — and time spent dumping competes directly with every other action.

**Heat and the action bar are the design's two opposing constraints.** Heat limits how much ore a batch can process; the action bar (§4.7) limits how much of the resulting mess the player can attend to. Neither alone makes a game — heat without an attention budget is solvable by fast clicking, and an attention budget without heat has nothing to be scarce *for*. Together they produce the squeeze the whole design rests on.

### 6.2 What escalates: the slag spiral

The escalation is not a scripted difficulty ramp. It emerges from parts already in the design:

1. Every block adds slag
2. Slag removal is the slowest, most attention-expensive action, competing with melting, venting and cooling
3. Slag therefore **creeps upward** across a batch, faster than it is comfortably trimmed
4. Slag insulates, reducing effective sink throughput
5. **The only heat exit narrows as the batch progresses**

A melt at minute nine sheds heat more slowly than the identical melt at minute two. That compounding is what makes late-batch play genuinely different, and it required no new mechanic to produce.

### 6.3 Batch size is a bid

**Batch size is chosen before the run, not fixed.** The player is betting on how much ore they can process before heat runs away from them.

This mirrors the mining claim exactly, in a different currency, and delivers the same three things:

- A real pre-run decision under partial information
- A reason to pay for grade-mix information beforehand — knowing the grade spread tells you the heat and slag load you are committing to
- **A moment of no return.** Past a certain point, the tank cannot shed enough heat to finish, and the choice is to push and blow it or bank early at a loss

### 6.4 The two exits: shutdown vs. overheat

The single most important decision in a batch, and the numbers make it a real one rather than an obvious one.

| | Shutdown (deliberate) | Overheat (failure) |
|---|---|---|
| Decanted / cooled output | Kept | Kept |
| Melted, not yet decanted | **Lost** | **Lost** |
| Unmelted ore remaining | **Returned to you** | **Destroyed** |

The difference between the two is not an efficiency delta — it is an entire remaining batch. That is what makes "should I stop now?" a genuine call, especially since your best information about whether you can finish is the thing that is actively deteriorating.

**Structural consequence worth noting:** melted-but-undecanted material is lost either way, so the shutdown decision is really about the *unmelted* ore. The natural moment to bail is therefore right after a decant and before committing to the next block. The game teaches this rhythm by itself — the pause between blocks becomes the decision point, with no tutorial required.

**Late-batch tension shape:** because unmelted ore is what is at stake, the bet shrinks as the batch progresses. By the final few blocks there is very little left to lose, so there is no drama at the very end. **Peak tension sits around two-thirds through**, which is the right place for it.

### 6.5 Failure must never cost access to play

Carried directly from mining: failure costs the run's output, never the ability to run again.

**Overheating must not destroy equipment that has to be replaced before the next batch.** That would mean a bad run locks the player out until they have bought a part — punishment that removes access to the fun, which is the exact failure mode mining deliberately avoided by never destroying a proxy during extraction. Losing a batch's remaining ore is a large, memorable sting that never stops anyone playing again.

### 6.6 Failure modes

| Failure | Trigger | Cost | Type |
|---|---|---|---|
| **Overheat** | Sink or tank exceeds ceiling | Batch ends. All melted *and* all unmelted ore destroyed. | Hard — ends the run |
| **Forced vent** | Pressure past threshold | Emergency vent fires, **losing already-melted material**. Batch continues. | Soft — punishing, recoverable |
| **Contamination** | Slag fraction too high at decant | Output downgraded a grade. **Silent until banked.** | Soft — invisible |
| **Cooler saturation** | Sink saturated | Forced stall — cannot dump, so cannot melt safely. Costs time. | Soft — a squeeze, not an end |
| **Scorch** | Over-melt | Block destroyed outright. Worse at higher grade. | Soft — local |

**Forced venting is the best-designed of the soft failures**: it costs *melted* material, which is strictly worse than losing raw ore because heat was already paid for it. It punishes one specific mistake — running hot and dirty at the same time — rather than punishing generally.

**Contamination stays silent by design.** You discover at banking that grade-8 feedstock became grade-2 output. A different kind of pain from the loud failures, and the one that rewards watching quality rather than only watching alarms.

**A hard slag ceiling (e.g. shutdown at 50% tank volume) is deliberately NOT included.** Slag already punishes continuously through insulation; by the time it reaches half the tank, heat exit is choked enough that overheat arrives on its own. Build without the explicit cap and confirm high-slag runs die naturally before adding a rule that may be redundant.

### 6.7 Telemetry is required from the first build

Mining's tuning was only tractable because every run was logged and analysed in aggregate. The decisive finding there — that losing runs averaged grade 1.53 against 4.42 on winning runs, which exposed the autopilot mining worthless rock at a loss — was invisible in individual play and obvious in 300 seeded batches.

Log per batch, from day one:

- Heat in, heat shed, peak heat, time at each heat band
- Peak and mean slag; total slag removed; time above insulation thresholds
- Time at each pressure band, and forced vent count
- Decant count and quality distribution
- Cause of ending: shutdown, overheat, timeout
- Batch size bid vs. ore actually processed

Expect the same class of invisible-on-paper bug that mining produced twice. Aggregate data is what finds them.

---

## 7. Tempo: escalation within a batch

**This is the structural difference from mining that justifies the game existing.**

Mining's tension is roughly flat across a run — the puzzle does not intensify, you just make more decisions. A batch here **ramps within its own duration**, and the mechanism is the slag spiral in §6.2 rather than a scripted difficulty curve:

- **Early:** lanes drift slowly, corrections are easy, one thing needs you at a time
- **Middle:** two or three demands overlap, sequencing starts to matter
- **Late:** simultaneous convergence — waste high, cooler saturating, packaging backing up, heat climbing

That rising action is something mining structurally cannot produce, and it is why refining reads as a different game rather than a reskin.

**Scope note:** the arcade tempo lives *inside a batch only*. A batch is a bounded few minutes, equivalent to a mining run. Nothing about this creates a persistent session, a login window, or a compulsion loop — the meta-layer rules are untouched.

---

## 8. The autopilot

Same division of labour as mining, achieved through a different mechanism.

**Baseline behaviour:** simple reactive correction. Tend whichever lane is closest to its limit. Correct *after* drift, never in anticipation. Stay conservative on tolerances. Fire the dumb fallback (emergency vent) when threatened.

It should reliably finish batches. It should never produce top-tier output.

### Where a human genuinely beats it

Three distinct mechanisms — all about *response to drift*, which is the skill axis refining owns the way spatial reading is mining's:

1. **Anticipation.** Baseline corrects after a variable drifts. A human who understands the coupling corrects heat *before* pressure follows it. Reading the system rather than reading a dial.
2. **Riding tolerance.** Running near a limit yields better grade at higher collapse risk. A human can ride the edge deliberately; the baseline stays conservative because it cannot gamble. Direct analogue of reaching for a deep vein in mining.
3. **Precise recovery.** On a real excursion, the baseline has one blunt fallback that costs efficiency. A human can execute a cheaper, more precise recovery. The moment-of-truth that hazards provide in mining.

### Tuning warning, learned the hard way in mining

Mining's autopilot went through two distinct failure states before landing: too timid (stranded constantly, quit early with fuel unused), then accidentally too good (a profit filter turned out to be a grade-gated travel permit and it cherry-picked the best seams, closing the skill gap).

**Expect the same difficulty here.** Too-good reactive correction holds tolerance indefinitely and leaves no gap for a human to fill. Too-twitchy fails constantly and reads as broken rather than mediocre. Budget real time for "competent but not smart," and **verify behaviour statistically across many seeded batches rather than trusting single good runs** — a single impressive autopilot result is not evidence of a bug, and a single bad one is not evidence of correctness.

---

## 9. Upgrades and the long game

The Universal Paperclips lesson worth taking is *not* "upgrades make numbers bigger." It is that upgrades **change what you are managing**, sometimes removing a task entirely and replacing it with a higher-order one.

Three tiers:

- **Early — the system gets calmer.** Reduce drift rate, widen tolerance bands. Same job, more forgiving.
- **Mid — automate a lever.** Auto-vent, auto-decant at threshold. This *removes a task from the attention budget entirely*, which is the real reward: not a better dial, one fewer dial.
- **Late — throughput.** Faster feed, bigger vat, higher volume. Which makes the levers you *still* control harder, because everything now moves faster.

**The resulting loop:** automate a lever, then push volume until the remaining manual levers are at your limit again. You are never simply "better" — you are always at the edge of what you can personally hold together, at progressively higher throughput.

### The tension to resolve before building this

**Full automation is the natural end state of that curve, and it directly contradicts "presence improves quality."**

Proposed resolution: **automated levers always run at baseline competence, never at skilled-human quality.** A fully-upgraded plant still rewards attention — automation buys throughput and removes tedium, but never buys grade. Worth deciding deliberately rather than discovering late.

---

## 10. Connection to the wider line

- **Ore in** — from the player's own mining runs, the market, or system floor price
- **Refined units out** — feed the component and assembly chain (Mechanics v1 §7)
- **Fuel consumed** — shared consumable with mining, which is what makes fuel the economy's baseline demand
- **Grade carries through** — grade-8 feedstock refined badly produces grade-2 output. Quality is destroyable at every stage, which is what makes skill matter across the whole chain rather than only at extraction.

Refining is the second product in `proxy-games`, sharing accounts and leaderboard infrastructure via the existing registry pattern. Adding it costs one registry entry plus a page — no schema migration, since `runs.game` is an open text column.

---

## 11. Open questions

**Blocking:**

- Sink and tank heat ceilings, and how visibly the approach to them is signalled. A cliff the player cannot see coming produces frustration; one they can see produces dread, which is the goal.
- Whether a running efficiency readout is shown *during* a batch. Mining shows cost-per-unit at the end, but a player mid-batch currently has no sense of whether they are doing well — worth resolving, since it changes how the whole thing feels to play.

- How many simultaneous lanes before it stops being triage and starts being noise? Three or four is the likely answer; five is probably too many.
- Batch duration in real minutes, which is now a *consequence* of the size bid (§6.3) rather than a fixed number. **Do the arithmetic before building**: 500 units at 5–10 ore per finished unit is 50–100 decants plus melts, vents, slag trims and cools. If that lands at 40 minutes of sustained attention rather than the 10–15 the design targets, it is a different and probably worse game — adjust the default bid range accordingly.
- ~~Where the ramp comes from.~~ **Answered in §6.2:** slag accrues faster than it is comfortably trimmed, slag insulates, and the only heat exit therefore narrows across the batch. No scripted curve needed.

**Important:**

- Exact coupling coefficients between heat, pressure, slag and capacity — this curve *is* the game, the same way the hull volume curve is mining's. Full parameter list in §4.11.
- Whether the cooling-tray oscillation ships in the first build at all. It is a self-contained timing task bolted to the end of the pipeline and is **cleanly separable** — shipping with finished units banking at a flat value would test whether the tank alone carries the game before a second skill axis is added on top.
- Whether the assay stage exists at launch or is a later addition.
- Whether the separator's purity/throughput dial is player-controlled continuously or set per-batch.
- ~~What "attention" costs mechanically.~~ **Answered in §4.4/§4.7:** melt is a hold and is therefore exclusive; everything else is a click. That single asymmetry is what makes attention genuinely single-threaded.

**Deferred:**

- Multi-batch continuity: does the cooler's thermal state persist between batches, making pacing a cross-batch concern?
- Whether refining ever becomes a shared/multiplayer activity (two players on one plant), or stays strictly solo.
