# FanWars captured schema review

Reviewed 2 October 2026 from the user's local export. No production connection
was used. No production SQL, schema changes, or history updates were performed.

## Capture provenance

- Source: ignored `.captures/database_inventory.csv`, 404,312 bytes.
- SHA-256: `a78018fa6f5fa24afcd3f8f71c8e7bf1f25c729fded12132be4ffd900faaa103`.
- Capture timestamp: `2026-10-02T11:10:10.332351+00:00`.
- Source PostgreSQL version: 17.6.
- Raw captures and diagnostic files remain ignored by Git. No application rows
  or credentials were intentionally collected by the metadata query.
- Supplemental metadata: `.captures/database_details.csv`, 47,726 bytes,
  captured `2026-10-02T11:31:03.08875+00:00`. Exact source hashes and non-secret
  environment requirements are recorded in `baseline_manifest.json`.
- Automated checks found no matching common secret/connection-token patterns
  in the capture. This heuristic is not a guarantee that arbitrary DDL comments
  or literals are safe; review them before committing future exports.

## Captured objects

| Object category | Count | Interpretation |
| --- | --- | --- |
| Public tables | 12 | All report RLS enabled and not forced |
| Public identity sequences | 7 | All identity columns use `BY DEFAULT` |
| Public columns | 76 | Bigint/integer, text, UUID, timestamptz |
| Public constraints | 46 | All captured constraints report validated |
| Public indexes | 37 | Includes 15 primary/unique constraint indexes |
| Public functions | 24 | All 19 current client RPC names are present |
| Policies | 19 | 15 public policies and 4 Storage policies |
| Triggers | 11 | 4 public reputation triggers, 7 Storage infrastructure triggers |
| Public views/materialized views | 0 | None captured |
| Migration-history relations | 0 | No history schema relations captured |
| Storage bucket | 1 | `fanwars-media`, public, 5 MiB limit, JPEG/PNG/WebP |

Additional functions are `leave_clan` and four reputation trigger functions.
These, plus the four tables not queried directly by the frontend, are included
in the draft. The Storage infrastructure triggers are not recreated as app
objects. A publication exists but no table membership was captured; publications
that include all tables must be interpreted from their flags, not just membership.

## Work prepared locally

- `audit/prepare_baseline.mjs` converts the captured catalog metadata into
  `drafts/baseline_candidate.sql`. It makes no database connection.
- The draft recreates the 12 public tables, identity sequences, 46 constraints,
  standalone indexes, all 24 verbatim function definitions, public triggers,
  captured RLS/policies, and captured public table/sequence/function ACLs.
- It preserves the existing definitions and known permission behavior; it does
  not mix in security fixes or feature redesigns.
- A guard refuses replay unless a disposable local target is explicitly marked.
  This is an accident-prevention check, not permission to run it on production.
- The file remains outside `migrations/`. It is a candidate, not an approved or
  complete production baseline. No baseline migration has been applied or
  recorded as applied anywhere.

## Local verification

Twelve smoke checks passed using an in-memory PGlite PostgreSQL 18.3 engine.
Auth user storage, `auth.uid()`, `storage.objects`, and `storage.foldername()`
were minimal test stubs. This validates core SQL behavior, not the full Supabase
managed services or compatibility with the exact production PostgreSQL 17.6
runtime. PGlite supports disposable in-memory databases; see its
[official documentation](https://pglite.dev/docs/).

Checks covered the draft replay guard, complete SQL replay, object counts,
exact sequence bounds/RLS flags, verbatim function definitions and application
table/sequence/function ACL equality, authenticated and duplicate votes,
rejection of anonymous votes, rejection of ordinary-user moderation and profile
edits on other users, referral self-claim/repeat behavior, and folder ownership
in the captured Storage policies. Multi-connection concurrency, email auth,
bucket provisioning, Storage service enforcement, and full privilege equality
were not tested. The captured raw-vote access issue and closed-battle option
visibility issue were also reproduced. Validation now checks both capture
hashes against the draft and refuses to test a stale draft.

Static application comparison checked eight literal relation names, nineteen
RPC names and supplied parameter keys, and forty literal column references.
No missing relations, RPCs, columns, or parameter-name mismatches were found.
RPC return-shape expectations were reviewed against captured signatures:
results/history/list RPCs return tables, current vote/referral/creation RPCs
return bigint IDs, and moderator checks return boolean. `cast_vote` returns a
row with vote/option IDs; the client currently checks its error and refreshes
results rather than consuming that row. Dynamic queries and complete runtime
UI behavior are outside the static comparison.

The test engine was pinned to `@electric-sql/pglite@0.5.8` and installed only
under ignored `.captures/validation/`, with install scripts disabled. App
dependencies and package manifests were not changed by this installation.

Reproduce the offline preparation and smoke tests with:

```powershell
node supabase/audit/prepare_baseline.mjs
node supabase/audit/validate_baseline.mjs
node supabase/audit/verify_app_contracts.mjs
```

The second command requires that private local test-engine installation.
The first reads the CSV directly and preserves bigint strings; the generated
private JSON copy is not required for either command.

## Confirmed findings and separately scoped follow-up work

1. **Clan totals can be zero despite real votes.** `votes` has no captured
   SELECT policy. A local ordinary user saw zero rows through a direct query
   while `get_battle_results` reported the recorded vote. The clan page currently
   reads raw vote rows. Fix by using an authorized aggregate, rather than
   broadening access to raw votes; implement as a separate app change.
2. **Two different image limits exist.** The UI accepts inputs up to 10 MB;
   the bucket allows uploaded objects up to 5 MiB. Cropping/compression may make
   an input small enough, but a larger output can fail upload. Align validation
   against the actual uploaded WebP blob in a separate change.
3. **One-vote integrity has database support.** The capture includes a unique
   constraint on `(battle_id, user_id)`, and `cast_vote` checks auth, live battle
   status, and option membership before insertion. Local repeat voting failed.
   This is not a live concurrency/load test or a claim of one-human-one-account.
4. **Referrals and reputation are implemented beyond the UI inventory.** The
   export contains their tables/functions/triggers. Preserve these in the
   baseline, even though their complete UI and scoring rules remain separate
   product decisions.
5. **Closed battle options are hidden.** The battle SELECT policies permit
   `closed` battles, but the sole option SELECT policy permits only `live`
   battles. A local ordinary user could read a closed battle and obtain results
   through the RPC, but could not read its option rows. The battle UI calculates
   the winner from those option IDs. Align final-result access in a separately
   reviewed policy migration; preserve the existing policy in the baseline.

## Capture precision issue and remaining completeness checks

The dashboard parsed the original JSONB result before exporting CSV and rounded
all seven bigint sequence maxima to `9223372036854776000`, which is outside
PostgreSQL bigint range. The value is already rounded in the original CSV;
changing the local JSON parser cannot recover it. The local-only draft uses
PostgreSQL's default bigint maxima for smoke testing and clearly labels that
assumption. Those exact maxima were deliberately excluded from equality checks.
Do not approve the draft on that basis.

`audit/capture_once.sql` now returns the JSON as text to prevent this dashboard
conversion. A smaller `audit/capture_details.sql` obtains exact text-valued
sequence bounds, dependency/identity ownership, formatted column types,
collations, explicit column ACLs, storage/compression settings, and relation
properties/comments in one read-only export. Save it privately as
`.captures/database_details.csv`. Preparation will merge the sequence metadata
and verify the additional properties when this file is present.

Full adoption still requires verifying schema ownership/default privileges and
effective grants in a fresh Supabase PostgreSQL 17 environment, deciding how to
provision the captured bucket configuration locally, reviewing any unmanaged
dependencies revealed by the supplemental capture, and obtaining a schema-only
dump if catalog coverage is insufficient. No production records, Storage files,
managed Vault secrets, or role passwords should enter the baseline. Schema
changes between captures must be reconciled before approval.

### Supplemental capture completed

The supplemental CSV is now present and merged. All seven sequence maxima are
exactly `9223372036854775807`, and sequence names are resolved through actual
identity dependencies. The draft no longer substitutes default maxima. Column
types/defaults and relation/column counts match the initial capture. All
captured collations are absent or PostgreSQL's standard `pg_catalog."default"`;
the generator now recognizes that quoted spelling. No explicit column ACLs,
compression overrides, non-default relation options, partitions, or tablespaces
were found. The generator initially stopped on the quoted default collation;
after fixing that local check, the draft regenerated and all twelve smoke checks
passed. This was a local code correction, not a production schema change.

The read-only catalog capture and application comparison are complete for the
scoped public application schema and captured Storage policies. No further
manual metadata pasting is needed for this comparison. The snapshot spans two
capture times; it is not a direct check of the production database's present
state. It also does not establish a complete cluster backup or migrate managed
Supabase infrastructure. Full baseline adoption remains pending the exact
Supabase/PostgreSQL 17 replay, role/default-privilege/schema comparisons, and
bucket setup noted above.

### Version-control contents

Version reviewed application DDL, all public functions/triggers, constraints,
indexes, RLS/policies and grants; include the additional referral/reputation
objects. `baseline_manifest.json` retains the captured public schema ownership,
default privileges, exact sequence configuration, bucket settings, extension
prerequisites, and publication settings for deliberate replay design. These
settings are not silently applied by the draft. Promote a validated baseline
to a timestamped migration only after full local Supabase replay and permission
comparison. Keep future feature/security fixes in subsequent migrations.

Also version local config, synthetic fixtures, generated database types and
database tests once they are prepared. Keep raw CSVs, private diagnostics,
credentials, production records and uploaded files outside Git. No production
migration-history entries should be created in this read-only phase.

Production history adoption remains a later explicitly authorized metadata
operation; never execute the initial schema creation draft against the populated
production database.

## Current status: real local migration replay completed

On 2 October 2026 Docker became available. The draft replayed on actual Supabase
PostgreSQL 17.11 with managed Auth/Storage schemas. Three ordered migration files
were prepared (baseline, bucket settings, closed-option policy), and a fresh
`db reset --local --no-seed` rebuilt the disposable database successfully.

The migration-aware validator passed 16 checks, including exact column types,
identity associations, definitions/ACLs, RLS, constraints, indexes, triggers,
extension versions, publication membership and schema/default privileges in
both directions. No infrastructure permission differences were found. Tests
with actual managed schemas verify voting, referral and ownership rules and
the closed-options change; fictional records roll back. Five physical column
numbers differ due to production's historical dropped-column gaps; logical
column order matches. The captured production version was 17.6, not 17.11.

This supersedes earlier statements that real PostgreSQL 17 replay or migration
promotion is pending. Managed service HTTP/browser flows and concurrent voting
still need testing. No production connection, changes or history adoption have
occurred; no Git commit was created. See README for the current procedure.

Additional existing access finding: SECURITY DEFINER `get_battle_results` returns
pending/rejected option names and counts without a status check, bypassing the
table SELECT restriction. Confirmed with fictional records on local Supabase,
including an anonymous rejected-results call. The baseline intentionally retains
this captured definition. A separate visibility migration/test is recommended
before production rollout; production was not queried for this test.
