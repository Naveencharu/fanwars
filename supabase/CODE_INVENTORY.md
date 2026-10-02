# Database assumptions in the current FanWars code

Inspected 2 October 2026. This inventories application expectations, not verified
production schema. Table names may resolve to views; column types, nullability,
defaults, relationships, policies, and indexes require production metadata.
The client has no explicit schema override, so `public` is the expected default.

## User-supplied production metadata

The dashboard query results provided by the user list twelve public tables:
the eight below plus `battle_tribes`, `fan_referrals`,
`fan_reputation_events`, and `fanwar_moderators`. All twelve report RLS enabled
and RLS forced false. A subsequent existence query returned false for
`supabase_migrations.schema_migrations`. This confirms the reported table
inventory and absence of that migration-history table at the time of the
queries, not the correctness of policies, indexes, or functions. Definitions
for the additional four tables must be captured rather than inferred.

## Relations and direct operations

| Relation | Columns directly read, filtered, ordered, or written | Direct operations and evidence |
| --- | --- | --- |
| `profiles` | `id`, `username`, `handler`, `display_name`, `avatar_url`, `banner_url`, `bio`, `created_at` | Read; insert identity fields during onboarding; update avatar/banner for the current profile. `app/onboarding/page.tsx`, `app/profile/page.tsx` |
| `tribes` | `id`, `name`, `description` | Read/list/filter. Creation goes through an RPC. `app/home/page.tsx`, `app/create-fanwar/page.tsx` |
| `tribe_members` | `user_id`, `tribe_id` | Read, insert, and delete the signed-in user's memberships. `app/tribes/page.tsx`, `app/tribes/[id]/page.tsx` |
| `battles` | `id`, `title`, `description`, `category`, `status`, `image_url`, `tribe_id`, `created_at`, `created_by` | Read and count by `pending`/`live`; create/moderate through RPCs. `app/battle/[id]/page.tsx`, `app/admin/fanwars/page.tsx` |
| `battle_options` | `id`, `battle_id`, `name`, `position`, `clan_id` | Read by battle/clan, order by position. `app/battle/[id]/page.tsx`, `app/clans/[id]/page.tsx` |
| `votes` | `option_id` | Read matching vote rows to calculate clan totals. Casting is via RPC. The code does not establish other vote columns. `app/clans/[id]/page.tsx` |
| `clans` | `id`, `tribe_id`, `name`, `description`, `image_url`, `created_by`, `status`, `created_at` | Read `active` clans; create through RPC. `app/clans/[id]/page.tsx`, `app/tribes/[id]/page.tsx` |
| `clan_members` | `clan_id`, `user_id`, `role`, `joined_at` | Read membership lists/counts and captain status; join through RPC. Client models `member` and `captain`. `app/clans/[id]/page.tsx`, `app/create-fanwar/page.tsx` |

JavaScript converts battle, option, tribe, and clan IDs with `Number`; verify
integer ranges and database types instead of inferring `bigint` or `integer`.
Profile IDs are matched to Supabase Auth user IDs; verify the actual FK and
delete behavior. Client uniqueness handling assumes PostgreSQL error `23505`
for username/handler collisions, but their precise constraints are unknown.
`starts_at`/`ends_at`, tribe images, and `rejection_reason` appear in RPC result
types, not sufficient evidence for their underlying table definitions.

## RPC contracts

Argument names are exact client parameter keys. SQL argument types, overloads,
return types, volatility, owners, security mode, search paths, and grants are
unknown until captured. "No arguments" means the client passes none.

| Function | Client argument keys | Client expectation / evidence |
| --- | --- | --- |
| `get_battle_results` | `p_battle_id` | Array of `option_id`, `option_name`, `vote_count`; landing, battle, rankings |
| `get_my_vote` | `p_battle_id` | Scalar option ID or empty; battle page |
| `get_battle_creator` | `p_battle_id` | First result row includes `handler`, `display_name`; battle page |
| `cast_vote` | `p_battle_id`, `p_option_id` | Error indicates rejected vote; refreshes totals on success; battle page |
| `get_my_battle_history` | No arguments | Rows with battle/option IDs and names, title, category; profile |
| `get_my_created_fanwars` | No arguments | Created battle rows including status, tribe ID, rejection reason; profile |
| `get_public_fanpage` | `p_handler` | First row: identity, counts, tribes array, battle history array; public fan page |
| `get_tribe_page` | `p_tribe_id` | Object or first row: tribe fields, member count/preview, live battles; tribe detail |
| `get_or_create_tribe` | `p_name` | Tribe ID; FanWar creation |
| `create_fanwar` | `p_title`, `p_description`, `p_category`, `p_tribe_id`, `p_option_a`, `p_option_b` | Scalar battle ID; expects pending submission |
| `set_fanwar_clans` | `p_battle_id`, `p_clan_a_id`, `p_clan_b_id` | Error indicates association failure; FanWar creation |
| `set_fanwar_image` | `p_battle_id`, `p_image_url` | Error checked; FanWar creation |
| `create_clan` | `p_tribe_id`, `p_name`, `p_description` | Scalar clan ID; clan creation |
| `join_clan` | `p_clan_id` | Error checked; clan detail |
| `claim_referral` | `p_referral_handler`, `p_source_type`, `p_source_id` | Called with `onboarding` and null source ID; failure logged |
| `is_fanwar_moderator` | No arguments | Boolean-like result; header and moderation page |
| `approve_fanwar` | `p_battle_id` | Error checked; moderation page |
| `reject_fanwar` | `p_battle_id`, `p_reason` | Error checked; moderation page |
| `complete_fanwar` | `p_battle_id` | Error checked; moderation page |

Referrals and moderator roles may rely on tables not queried directly by the
frontend. Do not invent their names or definitions. Capture all application
objects, not just this list of eight relations and nineteen entry points.

## Auth and Storage

- Supabase email/password signup, login, session/user lookup, and signout are
  used. Confirmation settings, redirect allowlists, email templates, SMTP, and
  auth provider configuration are project settings requiring separate inventory.
- `fanwars-media` is a Storage bucket, not an application table. Uploads use
  `<auth-user-id>/<folder>/<random-uuid>.webp` with `upsert: false` and public URL
  generation. The UI allows image files up to 10 MB and crops them to WebP.
  These client limits do not establish server-side limits or upload policies.
- Verify bucket visibility/configuration and policies on `storage.objects`,
  including ownership/path checks. Capture app-specific auth triggers if present.
- Result pages poll every five seconds; no Realtime channel subscriptions were
  found. Inventory production publications before deciding what to version.

## Permission and integrity assumptions to verify

The browser uses a publishable key, so RLS and grants/RPC authorization enforce
access. UI route restrictions are not database security evidence.

- Public battle/result/fan page access must agree with actual grants and RLS.
- Profile reads must expose only intended fields. Profile inserts/updates and
  tribe membership changes must enforce the signed-in user's identity.
- Clan pages calculate totals from raw `votes.option_id` rows. Restrictive RLS
  or API row limits can undercount these totals; compare with authoritative RPC
  totals during local validation. Do not broaden vote access to make counts work.
- Verify one vote per authenticated user per battle under concurrent requests;
  verify option belongs to the battle and battle status/timing permits voting.
  Required vote identity columns/constraints are hypotheses until inspected.
- Verify captain and creator permissions for clan association and image changes;
  moderator RPCs must reject ordinary users independently of the UI.
- Verify referral uniqueness, self-referral prevention, and identity binding.
- Inspect `SECURITY DEFINER` owners, safe search paths, and execute permissions.
  Preserve existing definitions in the baseline; propose corrections separately.

Candidate index coverage to inspect, not automatically add: vote identity and
option lookups, battle options by battle/clan, membership pairs and user lookups,
clans by tribe/status, battles by status, profile handles/usernames. Existing
unique constraints may already supply indexes. Capture definitions and actual
query plans before making performance changes.

## Data and setup assumptions

The landing page expects battle ID `1` to be live and links to fixed battle IDs
`2`, `3`, and `4`. This is a data dependency, not schema. Document it and use
fictional fixtures for local testing. No production data belongs in migrations.

Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
required. Their values were not printed. No migration credentials or remote
metadata access were configured for this preparation.
