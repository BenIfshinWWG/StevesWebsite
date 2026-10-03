-- Citizen intake: financial-need attestation
--
-- Records the applicant's statement that they cannot afford a lawyer and have
-- already tried and failed to retain one.
--
-- The box is OPTIONAL on the form: someone who can partly afford a lawyer, or
-- who has not yet tried to find one, must still be able to ask for help. So
-- false means "did not say", NOT "has funds" -- do not screen on it as though
-- it were a declaration of ability to pay. For the same reason the staff
-- notification email mentions it only when it is true.
--
-- Defaults to false for rows submitted before this box existed, which is
-- accurate: those applicants were never asked.

alter table public.citizen_intakes
  add column if not exists ack_need boolean not null default false;

comment on column public.citizen_intakes.ack_need is
  'Attested: cannot afford a lawyer and has tried and been unable to retain one.';
