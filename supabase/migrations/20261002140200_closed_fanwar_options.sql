-- Verified locally with real Supabase Auth/Storage/RLS; not deployed to production.
-- This preserves the existing policy name, roles and SELECT-only scope.
-- Pending and rejected FanWars remain excluded; vote rows remain private.
BEGIN;

ALTER POLICY battle_options_select_live ON public.battle_options
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.battles
        WHERE battles.id = battle_options.battle_id
          AND battles.status IN ('live', 'closed')
    )
);

COMMIT;
