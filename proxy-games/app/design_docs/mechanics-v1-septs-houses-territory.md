# Mechanics v1 — Days, Septs, Houses, Territory

*Follows Vision v2. This is the first pass at specific mechanics, written to be argued with and then turned into gameplay cases.*

---

## 0. The structural decision this document makes

**Production companies dissolve into septs. Service companies remain, as a distinct fourth object.**

The old doc's *production* company is redundant: septs absorbed everything it was — standing partnership, shared upkeep, accumulated efficiency, sunk cost on exit, equity. But the *service* company does a job nothing else covers, and it turns out to be the layer the design was missing (section 7).

So the world has four organisational objects:

| | What it is | Commitment type | Exit |
|---|---|---|---|
| **Individual** | A mortal character with a day | — | — |
| **Sept** | The firm. Production, claims, equity | Economic partnership | Costly — forfeits accumulated efficiency |
| **Company** | The practice. Sells outcomes, not goods | Contract, per job or retained | Ends with the contract |
| **House** | The polity. Territory, law, great works | Political consent | Free and instant, always |

Everything below hangs off that table.

---

## 1. The three resources

**Days (energy).** 1,000 per character per day, hard reset, no accrual, no overflow. Non-transferable. Cannot be bought, stockpiled, or automated. This is the only genuinely scarce thing in the world — the global supply each day equals the number of active players, full stop.

**Money.** Fully transferable. Its actual function: **a claim on someone else's day.** Wages, purchases, and tribute are all money buying applied time. Money is abundant relative to days by design, so the price of labour is the economy's real signal.

**Materials.** Tradeable goods along the production chain. Buyable in any quantity, which is exactly why they never create a reason to need people.

> **The load-bearing asymmetry:** you can buy every material a project needs. You cannot buy the days it takes to apply them. Everything social in this game grows out of that one gap.

---

## 2. Claims and upkeep

A **claim** is a site a character or sept holds and works. It produces while the owner is logged off — this is the idle layer, and the first real ambition in the game.

Establishing a claim costs materials (buyable) plus a lump of **applied days** (not buyable in bulk, because no one person has them).

**Upkeep is permanent.** Every claim consumes a slice of somebody's day, every cycle, forever. Miss it and the claim decays; decay far enough and it lapses to unclaimed.

This single rule generates the entire social structure:

- One person maintains roughly one claim. Two claims needs two people's days. Ten needs ten.
- **Scale is headcount, permanently, and no amount of money changes it.**
- A solo player with one claim is *chained to it*. The first time someone covers your upkeep so you can take a week off, you understand what a sept is for.

### Proxies

A proxy is the machine that works a claim — the thing being upkept. Reframed from the old doc: proxies are no longer the economy's purpose, they're the labour multiplier and one product line among many. Combat proxies are a branch of the same chain, not a separate system.

Upkeep is paid in **days + materials**, never money alone.

---

## 3. Septs — the firm

### Formation and size

Any three characters can form a sept. No hard cap on size, but a diminishing efficiency curve makes ~10 the natural attractor:

| Members | Marginal efficiency gain |
|---|---|
| 1–3 | ~10% each |
| 4 | ~7% |
| 5 | ~6% |
| 6–11 | tapering |
| 12–30 | fractional |

*Placeholder numbers — the shape matters, the values need playtesting.*

**Critical:** the taper alone does not force splitting. A 20-person sept still beats a 10-person one in absolute terms. What forces the split is section 4: **house benefits scale by sept count, not headcount.** Three septs of ten in a house beat one sept of thirty. The taper and the house layer must point the same direction or the attractor doesn't hold.

### Efficiency

Efficiency reduces the **days** cost of upkeep, not the material cost. A three-proxy sept at 40% upkeep each drops toward a shared 30% total, freeing members' remaining days for extraction, exploration, construction, or building more proxies.

Efficiency growth and upkeep discounts live **only at the sept level.** They must never compound into the house layer — if a big house made upkeep trivial, you'd need fewer people, and the benefit of belonging would cancel the reason for belonging.

### Specialisation discounts

Separate from scale. An engineer maintaining three proxies does it more cheaply than three generalists would. This emerges from proficiency rather than headcount, is capped by diminishing returns and decay, and produces role differentiation without a class system.

**The engineer problem:** if one member spends 90% of their day on upkeep so their sept-mates can explore, that's the serf problem reappearing three players in. **Answered in section 7** — the mechanic → engineer ladder, sole assembly above basic tier, and maintenance as a sellable service rather than a duty. The maintainer isn't sacrificing; they're on the entry rung of the only career that can build the good stuff, funded by their sept-mates' freedom. Still needs testing against gameplay case 4.

### Equity, joining, leaving

- Members hold **shares** in the sept. Claims, proxies, and accumulated efficiency tiers are sept property.
- **Leaving forfeits accumulated efficiency and equity stake** (bought out, or forfeited — TBD). Real sunk cost. This is what gives recruitment and retention stakes.
- **Disbanding dissolves the shared layer only** — efficiency tiers, sept projects, sept-held claims. Personal claims survive. Painful enough to matter; not a hostage-taking button one bad night can fire.
- **Freelancers** sell days to a sept without joining: paid in money, no equity, no efficiency benefit, no sunk cost. This is the spot-labour market and the day-one on-ramp.

---

## 4. Houses — the polity

### What a house is for

Not efficiency. Three things a sept cannot get alone:

1. **Access.** Works and prime sites (section 5) are physically unreachable below a headcount.
2. **Chain completion.** A ten-person sept can staff two or three production steps well. A house of ten septs staffs the whole pipeline — reliable, non-anonymous intermediate supply instead of gambling on the open market. **This is the everyday benefit, felt weekly.**
3. **Protection** of the sept's own outcrops and fields, which are otherwise raidable.

### The keystone mechanic: pledged days

Houses cannot tax days. Days are pledged **voluntarily** by septs from their pooled energy.

That single number does three jobs at once:

- **Economy** — the house's pledge pool is what pays territory upkeep and builds great works. It *is* the house's capacity.
- **Politics** — vote weight equals recent pledged days. The electorate is literally the people currently doing the work. Wealth buys no votes; showing up does.
- **Retention** — pledges are the thing a leader is constantly campaigning for, and the thing that vanishes overnight when they govern badly.

Money can be taxed. Days can only be asked for. That asymmetry is the whole leadership game.

### Size

**No cap.** A house grows as large as its leadership can hold together, and holding gets harder with every sept. This is deliberate: it makes the game's ceiling an *external, human* skill — organisation, persuasion, trust-building — rather than a number. Someone who can unite a hundred septs long enough to finish a great work has done something a hundred-sept house is required to do, and the work outlasts them.

### Governance

- Leadership is **elected, continuously.** Houses cannot be owned; ownership makes the seat property and everyone below it furniture.
- **Vote changes are throttled** (weekly or monthly — TBD) so leaders can govern. **Exit is never throttled.**
- Any leadership change carries a temporary house-wide penalty. Prevents churn, gives rivals a window to plan around.
- **Three triggers, one mechanic:** death, assassination (including from within by an unruly sept), deposition by vote.
- **On a leader's death the heir takes the seat provisionally**, with a confirmation vote forced within days. Through that window the house carries the penalty, septs may defect freely, and rivals may poach. The heir has something real to fight for and a genuine chance of losing it.

### Recruitment runs on septs, not individuals

A house with spare good ground attracts septs. A crowded one bleeds them. Defection drama is therefore sept-scale by default — thirty people walking on a Thursday, not one person resigning.

---

## 5. Territory

### Sites are gated by concurrent operators, not by cost

| Tier | Operators needed | Notes |
|---|---|---|
| **Outcrop** | 1–3 | Abundant, mostly uncontested. Solo/starter. |
| **Field** | ~10 | One sept. Locally contested. |
| **Works** | ~50 | Several septs. The house floor. |
| **Prime site** | Hundreds of days | A handful exist. Permanently contested. |

Money cannot open a gate that requires fifty people to be present this week.

**This gives the game its launch runway for free.** At release only outcrops and fields are workable; works and prime sites sit visible, documented, and unreachable until population arrives. **Tier progression is gated by the server's headcount, not by patches** — and the first house forming is a real, dated, server-wide event.

### Territory upkeep and overextension

Held ground consumes pledged days every cycle. Which produces the central strategic bind:

> **You must take the ground before you can attract the septs needed to hold it.**

Expansion always runs ahead of capacity. A house that overreaches has sites decaying for want of staffing, which makes it a worse place to be, which loses it septs, which loses it more ground.

**No size-cap rule is needed.** The ceiling is "how much can you actually staff," and it moves with recruitment. *Consolidate or expand* becomes the permanent question a house leader loses sleep over.

The map's finite site count is what bounds the number of viable houses. "Ten houses" isn't a rule — it's however many distinct territory portfolios the map supports.

### Two axes, retained from the old doc

- **Sovereignty** is house-held: taxation, access rights, defence, who may operate.
- **Claim ownership** is individual- or sept-held via equity.

They can be held by different parties. A sept operating in a house's territory without membership pays a baseline toll; a negotiated charter upgrades that to a transparent rate plus protection and infrastructure access. Adversarial squeeze is the *failure* case, not the default.

---

## 6. Production chain

Deliberately incomplete output at every step: **the extractor cannot refine, the refiner cannot assemble, the assembler cannot install.** Different proficiencies, different sites, different days.

| Step | Output | Typical holder |
|---|---|---|
| **Extraction** | Ore, polymer, salvage | Individual / small sept |
| **Refining** | Alloy, circuitry, composite | Sept |
| **Components** | Frames, actuators, cores | Specialist sept |
| **Assembly** | Proxies, tools, arms, structures | Multi-sept or house |
| **Great works** | Permanent map structures | House only |

A sept of ten covers two to three steps well. Everything past that requires either the open market (anonymous, unreliable, priced) or a house (known, reliable, political). **That choice is the game's central economic tension.**

---

## 7. Companies — the service layer

### Why this layer is structurally necessary

Territory is finite. Day-capacity isn't — it grows with every player who joins. Sooner or later the server holds more days than there is ground to spend them on, and without a non-territorial outlet those surplus days idle.

Companies are that outlet. **They scale with population instead of with the map**, letting the economy absorb growth the map can't. They also give a sept a viable specialisation path that sits outside house rule entirely.

Division of labour across the three organisations:

> **Septs produce goods. Houses hold ground. Companies sell outcomes.**

An outcome isn't a material or a site — it's a change to how the rules apply to someone. Lower estate tax, harder to assassinate, a contract made enforceable, a rival's claim raided, a stretch of unclaimed ground surveyed. Companies still spend days producing these; what differs is that the client pays **money** and receives an **effect**.

### The dividing line with septs

**Septs do standing, repeatable volume. Companies do the specific, non-fungible and consequential.**

- Mining copper every day → sept
- Cracking a rare-earth deposit that needs a specialist technique → company contract
- Routine proxy upkeep → sept (or a retained engineer)
- Assembling one particular high-tier proxy → engineering firm

This is the safe version of routing advanced extraction and refining through companies. Gating a whole second tier of the *ordinary* chain behind contractors would hollow the sept out and turn every session into contractor-hunting. Gating **rare, one-off, high-consequence** work behind them makes companies feel like specialists rather than tollbooths.

### Seats, not claims

A company holds a **seat** — a small footprint in a settlement or hub, cheap in land, expensive in proficiency and licensing. Deliberately not a claim upgrade: a claim is bound to a resource tier and to ground, and the whole point of a company is that it isn't.

Tiered by backing rather than territory:

| Tier | Backing | Scope |
|---|---|---|
| **Practice** | One character | A hired gun, a freelance broker. Single contract at a time. |
| **Firm** | Sept-backed | Standing capacity, several concurrent contracts. |
| **Institution** | Multi-sept | Rare. The major security house; the law firm every succession runs through. |

Multi-sept backing at the top tier keeps the great institutions scarce and makes them something houses want to control.

### The mechanic → engineer ladder

Repair and creation are **two separate services and two stages of one career.** This is the design's answer to the pinned engineer problem, and to the assembly-bottleneck risk it created.

| | Mechanic | Engineer |
|---|---|---|
| **Does** | Restoration — repair, refit, field maintenance, standing upkeep retainers | Creation — assembly above basic tier, one-off commissions |
| **Barrier** | Low. Accessible in week two. | High. Long proficiency climb. |
| **Volume** | High, routine, plentiful | Low, slow, rare |
| **Standing** | A working trade | Prestige, maker's mark |

The early-game chore is now a *business* rather than a duty, and it is literally the entry rung of the prestige track. Routine work flows to plentiful mechanics; engineers are pulled in only for rare things. **Nobody is ever blocked waiting on a scarce specialist to do an oil change.**

### Engineering firms as sole assemblers

**Above basic tier, only an engineering company can assemble a proxy or finished good.** You amass the materials, then commission an engineer with the right proficiency to build what you actually want.

- Creates a mandatory chokepoint that **isn't territory** — one bottleneck houses can't simply conquer.
- Turns the early chore into an endgame power broker who can be as aloof or as politically involved as the player chooses.
- **Maintenance is a sellable service**, so the specialist is a contractor with a client list — their own sept one client among several — rather than a member doing chores.
- Every unit carries a **maker's mark**. Engineers are remembered by objects the way great-work builders are remembered by the map.

**Required mitigation:** an NPC baseline practice must exist at low tier, mirroring the cold-start system companies, so basic proxies are always commissionable.

### Checks on engineer power

Engineering confers no rank, no vote weight and no territory — that is its own ceiling. Beyond it, four existing mechanics do the work, and no new rule is needed:

- **Proficiency decays.** An engineer who coasts stops being one. No resting on reputation.
- **Mortality kills the dynasty.** Skill isn't inherited, so an engineering *house* is impossible — every generation's master engineer earned it personally. The largest source of calcification is already closed here.
- **They have a body.** Engineers are safe in peace and **priority targets in war** — killing a rival's engineer denies their assembly pipeline for months. Untouchability is therefore conditional on staying useful to everyone, which is called neutrality, and neutrality is fragile. Favour one house openly and the others acquire a reason to come for you. This gives engineers a real appetite for security contracts and house patronage: political *involvement* without political *power*.
- **Vertical integration.** A house large enough can grow its own engineers at real cost in days.

**The failure mode to design against is a cartel, not a tyrant.** Price collusion among a handful of master engineers is the realistic abuse. The NPC baseline caps the low end; vertical integration caps the high end, priced so it's a response to gouging rather than a default.

### Specialist extraction: unlock, then operate

High-level extractors **open** rare deposits; septs then work them normally as standing claims.

A rare-earth or exotic deposit sits inert until someone with the proficiency cracks it. After that it's an ordinary sept claim. Contract the opening out, or keep a resident specialist as a sept-head company — both viable.

This deliberately avoids the tollbooth problem: the specialist is paid **once for the opening**, never skimming every cycle.

### Starter list of company types

| Type | Sells | Notes |
|---|---|---|
| **Engineering** | Assembly of proxies and high-tier goods; one-off commissions | Sole assembler above basic tier. Maker's mark. Rare and slow. |
| **Mechanic / repair** | Repair, refit, field maintenance, standing upkeep retainers | Separate trade. Low barrier, high volume. The entry rung of the engineering career. |
| **Security** | Defence retainers, escort, contracted raids on septs or houses | Fields many proxies because it *is* many people — the personal three-proxy cap is untouched |
| **Law** | Estate-tax reduction, contract enforcement, succession contests, charter negotiation | Shrinks the sink, never captures it. Reduction hard-capped. |
| **Prospecting** | Survey of unclaimed ground — tier, yield, what's underneath | Sells information. Feeds map growth and expedition content. |
| **Logistics** | Moving material across links; guaranteed delivery | Gives the node map's *links* real economic meaning |
| **Brokerage & finance** | Loans against claims, escrow, underwriting great works | Makes agreements between strangers enforceable |
| **Insurance** | Payouts on lost claims and destroyed proxies | Creates an actor that profits from peace and pays for war — a genuine political constituency |
| **Intelligence** | Reports on rival pledges, sept movements, holdings | The between-ticks attention layer, sold rather than free |
| **Specialist extraction** | Opening rare deposits — rare-earth, silica, exotics | Paid once for the unlock; the sept then works it as a standing claim |

**Medical / bio companies are cut.** Every version either extends life — which guts the mortality pillar the whole design rests on — or shortens personal downtime, which buys back days, the one thing money must never do. Repair is the honest home for that niche: a machine isn't a day. Revisit only if a hook appears that touches neither.

### The rogue sept path

A security, law or intelligence sept **needs no works or prime sites**, so it needs no house. That's a real alternative endgame for players who want no part of house politics — and it patches a hole in the design, which is that everything else funnels toward houses.

It isn't a loophole, because those septs need **clients**, and the clients are houses. Mercenaries end up structurally dependent on conflict between the very institutions they stand outside. Independent, and parasitic on the political layer.

### Reputation, scoped narrowly

The old doc was right to reject a general social score. But the service layer needs one narrow, mechanical exception: a **public contract-completion history.** A merc who takes payment and doesn't deliver should be visibly unhireable. In a game built on pledges, this is where honouring an agreement has to be legible.

### Guardrails

- **Estate tax must still evaporate.** A law firm reduces the amount destroyed and charges a fee for doing so — it never captures the tax, or a sink becomes a flow. Because the reduction erodes a sink, cap it hard.
- **The personal three-proxy cap stays personal.** A security firm fields many proxies because it is many people. Defence still scales with headcount and stays crackable by enough coordinated attackers. Hiring protection must never let one rich character exceed their own cap.
- **Contracting is buying days indirectly, and that's fine.** Money was always a claim on someone else's day. Companies make the reallocation more sophisticated; the fixed global pool is untouched.
- **Watch labour brokerage specifically.** A company that brokers freelancers to septs commodifies the one thing that shouldn't become a commodity. Probably fine as matchmaking; dangerous if it becomes a liquid market in days. Flagged, not decided.

---

## 8. Money: faucets and sinks

Keep the framing from the old doc, with money subordinated to days.

**Faucets:** NPC/system purchase of goods at a floor price; NPC contracts and bounties; small starting stipend on character creation.

**Sinks:** market tax (~5%); material components of upkeep bought from NPC suppliers; repair; estate tax; failed-action penalties.

**Flows:** all player-to-player trade; wages for freelance days; sept dividends; tribute and charter payments; inheritance.

**Target:** faucets and sinks roughly balanced over time, watched via a regular internal report rather than solved once at launch. Sinks firing is the health signal, not flat prices.

---

## 9. Mortality and legacy

Characters die. Assets and formal position pass to an heir; **proficiency and informal ties do not.**

The strategic consequence, which remains the best tension in the design:

> **Killing a leader weakens the house. Absorbing a house means you want it strong.**

Assassination is a *war* tool — you kill to cripple a rival. To take a house over, killing devalues what you're acquiring, and the right move is poaching their septs. Two paths to power, genuinely different toolkits.

### What you're building toward

**Great works persist.** In EVE, nothing you build survives; in WoW nothing persists at all. Here, the span built in year three by a named person is still standing and still credited in year eleven, after that character is dead and the house that built it has been torn apart.

So the summit is *being remembered by the map* — a top that cannot be hoarded, bought, or inherited, and one that a year-ten player can still reach, because the map always has room for one more.

---

## 10. The player's arc

- **Sessions 1–3:** Sell days — freelance, extract, take an NPC contract. Learn a proficiency. Save.
- **First claim, inside three sessions.** Something of yours produces while you're logged off. *This is when the game becomes itself; everything before it is a queue.*
- **Weeks 2–6:** You hit a personal ceiling and you're chained to your claim. Join or form a sept.
- **Months 2–6:** Three or four people, several claims, shared upkeep, emerging specialisation. You can take a weekend off. This is where most players live and it must be complete on its own terms.
- **Month 6+:** The sept wants something it can't staff. It joins a house — or founds one.
- **Year 1+:** Great works, prime sites, and the politics of holding a hundred septs together.

---

## 11. Gameplay cases to write next

Each of these should be written as a concrete narrated session before any code:

1. **First claim.** New player, sessions 1–3, from zero to something producing overnight.
2. **The two-person exchange.** One player covers the other's upkeep so the second can push a new claim. *If this doesn't feel good, nothing above it works — prototype this first.*
3. **Sept formation.** Three solo players merge. What changes on the screen and in the numbers.
4. **The engineer's week.** Does the maintenance role feel like a specialty or a chore?
5. **A sept joins a house.** What they gain, what they pledge, what it costs them to leave.
6. **The Thursday defection.** A sept walks. What breaks for the house, what the leader can do about it.
7. **A succession.** Leader dies; provisional heir; confirmation vote; rivals poaching in the window.
8. **Overextension.** A house takes ground it can't staff and watches it decay.
9. **Commissioning a proxy.** A player amasses materials, shops for an engineer, negotiates, and takes delivery of something with a maker's mark on it.
10. **The mechanic's week.** Standing upkeep retainers across three septs. Does the entry rung read as a business or a chore?
11. **Opening a rare deposit.** A sept hires a specialist extractor for a one-off unlock, then works the site themselves.
12. **Hiring a raid.** A house contracts a security firm against a rival's sept — what the client sees, what the merc sees, what the victim sees.

---

## 12. Open questions, ranked

**Blocking — must resolve before a build plan:**

- Exact day costs for extraction, refining, upkeep, claim establishment. Everything else is calibration on top of these.
- ~~The engineer role's reward structure.~~ **Answered** in section 7 — the mechanic → engineer ladder, sole assembly, maintenance as a sellable service. Still unproven; test against gameplay cases 4 and 10.
- **Where "basic tier" falls.** This line decides how much of the world needs a commission at all, and it's the difference between engineers being a satisfying bottleneck and an annoying one.
- Whether combat exists at all in v1, or whether the first build is purely economic. *Fighting needs a large population to be interesting; building doesn't. This probably decides the MVP.*

**Important:**

- Efficiency curve values; sept share/buyout mechanics on leaving.
- Pledge mechanics: granularity, cadence, how a sept decides internally.
- Vote-change cooldown; leadership-penalty size and duration; confirmation-vote window.
- How territory decay is surfaced so overextension is legible before it's fatal.
- Whether great works benefit non-members (leaky) or house-only (exclusive).
- Is a killer identified? Always-known gives clean retribution politics; forgeable evidence gives paranoia and purges — more interesting, much more work.

**Deferred:**

- Setting and theme, deliberately last. Candidates: machine wilderness, the belt, the deep.
- Map topology detail (node web: regions, sites, links as the contested layer).
- Multi-accounting deterrence.

---

## 13. Honest risks

- **Population dependency.** Nearly every system needs other people. Sixty active players is a lot of empty rooms. Mitigated — but not solved — by the sept-scale runway.
- **Social retention, not compulsive retention.** The flat daily pool deliberately kills variable-reward loops. People return because a sept needs them. That works above a population threshold and fails below it.
- **Mortality is high-variance.** Best idea and biggest churn risk at once. Paper cannot settle whether a death reads as a story beat or a quit trigger.
- **The engineer problem has a designed fix, not a proven one.** It's three players deep into the funnel, which is early enough to matter a great deal.
- **Assembly bottleneck**, substantially reduced by splitting mechanics out — routine work no longer queues behind scarce engineers — but not eliminated. The NPC baseline practice is the remaining mitigation.
- **Engineer cartel**, not engineer tyranny, is the realistic abuse of the sole-assembler rule. Checks are in place (section 7); none are proven.
