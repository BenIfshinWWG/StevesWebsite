-- Correct the ack_need column comment: the attestation is now REQUIRED
--
-- 0004 introduced ack_need as an optional box and its comment says false means
-- "did not say, not has funds". That is no longer true: the form and the Edge
-- Function both reject a submission without it, so for anything submitted
-- after this migration, true is the only value that can occur.
--
-- 0004 is already applied, so its comment is corrected here rather than by
-- editing that file, which would leave the database and the repo disagreeing.
--
-- The column stays `not null default false` -- the default now only covers the
-- rows written before the box existed, where false still means "never asked".

comment on column public.citizen_intakes.ack_need is
  'Attested: cannot afford a lawyer and has tried and been unable to retain one. Required on the form since 0005; false only on rows predating the question.';
