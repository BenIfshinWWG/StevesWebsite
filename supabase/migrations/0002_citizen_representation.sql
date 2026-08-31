-- Citizen intake: existing representation
--
-- Adds the "Are you already represented by a lawyer in this matter?" question
-- and the free-text follow-up shown only when the answer is "yes".
--
-- Safe to run on a database that already has 0001 applied.

alter table public.citizen_intakes
  add column if not exists represented text
    check (represented in ('yes','no'));

alter table public.citizen_intakes
  add column if not exists represented_reason text;

comment on column public.citizen_intakes.represented is
  'Whether the person already has a lawyer in this matter (yes/no).';
comment on column public.citizen_intakes.represented_reason is
  'If already represented: why they are seeking a lawyer through the Clearinghouse.';
