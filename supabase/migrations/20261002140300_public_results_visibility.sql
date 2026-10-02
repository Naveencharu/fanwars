-- Public results are available only for live and closed FanWars.
-- Keeps the RPC signature, option ordering and existing owner/execute grants.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_battle_results(p_battle_id bigint)
 RETURNS TABLE(option_id bigint, option_name text, vote_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select o.id as option_id, o.name as option_name, count(v.id)::bigint as vote_count
    from public.battle_options o
    join public.battles b on b.id = o.battle_id
    left join public.votes v on v.option_id = o.id and v.battle_id = p_battle_id
    where o.battle_id = p_battle_id and b.status in ('live', 'closed')
    group by o.id, o.name, o.position
    order by o.position;
$function$;
COMMIT;
