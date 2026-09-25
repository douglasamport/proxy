-- Metagame foundation: persistent character energy, replacing money as the
-- cost of a mining claim and adding a flat energy cost to launching a
-- refine batch (see the Smashies/arena outline and the energy design
-- conversation — this is the resource jobs and arena matches will also
-- draw from later, per the outline, but mining/refine are its first real
-- consumers, not just plumbing).
--
-- Lives on characters, not players: it's the entity the outline actually
-- describes owning play resources, and unlike balance (moving it would
-- have touched every existing purchase/sell/settle call site) this is a
-- brand-new column with nothing to migrate.
--
-- Regen is computed lazily at read/spend time from `energy` + `energy_
-- updated_at` + elapsed wall-clock time (see lib/energy.ts) — no cron job.
-- Starting everyone at a full 250 rather than 0 avoids stranding existing
-- testers the moment this ships.
alter table characters add column energy numeric not null default 250;
alter table characters add column energy_updated_at timestamptz not null default now();

-- Subscribed players get 50% more energy (both cap and regen rate — see
-- lib/energy.ts). Plain boolean for now; whatever payment/subscription
-- system eventually sets this is out of scope here.
alter table players add column subscribed boolean not null default false;
