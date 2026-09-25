-- Marks accounts that are actual playtesters vs. real/eventual players.
-- Plain boolean, same shape as players.subscribed (db/022_energy.sql) —
-- no gameplay wired to it yet; this migration is just the flag.
alter table players add column playtester boolean not null default false;
