-- Grant the Edge Function's role permission to write submissions
--
-- The tables have RLS enabled with no policies (see 0001), and `service_role`
-- bypasses RLS -- but bypassing RLS does not grant ordinary SQL privileges.
-- On projects created under Supabase's newer API-key/permission defaults,
-- tables created by a migration do NOT automatically grant anything to
-- `service_role`, so the Edge Function's inserts failed with:
--
--   42501  permission denied for table lawyer_signups
--
-- INSERT only, deliberately. The function never reads these tables: it calls
-- .insert() without .select(), so PostgREST sends `return=minimal` and no
-- SELECT privilege is required. Clearinghouse staff read submissions in the
-- dashboard, which connects as a superuser role and is unaffected by this.
-- Withholding SELECT means a leaked service-role key cannot read back the
-- case details of everyone who has ever submitted the form.

grant insert on public.citizen_intakes to service_role;
grant insert on public.lawyer_signups  to service_role;
