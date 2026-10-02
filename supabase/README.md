# FanWars database version control

Updated 2 October 2026. Status: local Supabase migration replay validated.
No direct production connection or production changes were made.

Docker is now working. The first three ordered migration files rebuilt the fresh local
database with the pinned Supabase CLI 2.119.0. Sixteen checks passed on Supabase
PostgreSQL 17.11, including real Auth/Storage schemas, exact types, constraints,
functions, grants, RLS, default privileges, extensions and publications. The
captured production server was 17.6; no public schema/default-privilege drift
was found. Historical dropped-column numbering gaps differ physically while
logical column order remains identical. Browser/HTTP and concurrent voting
checks remain pending. See [capture review](CAPTURE_REVIEW.md).

Migrations, in order:

- `20261002140000_baseline_existing_schema.sql`: captured application schema;
  refuses application to a populated public schema.
- `20261002140100_fanwars_media_bucket.sql`: captured bucket configuration;
  leaves an existing bucket unchanged.
- `20261002140200_closed_fanwar_options.sql`: SELECT access to live and closed
  options, preserving private vote rows and hidden pending/rejected options.
- `20261002140300_public_results_visibility.sql`: subsequent locally applied
  results RPC fix; returns public scores only for live/closed battles. Both API
  roles were tested, preserving the original signature, owner and grants.

Production baseline adoption is a separate, explicitly authorized history
operation. Do not run the initial baseline DDL against existing production.

## One-time dashboard capture

To avoid repeated query/result exchanges, run all of
`audit/capture_once.sql` in the Supabase SQL Editor. It is one read-only SELECT
returning one JSON column, `schema_snapshot`. Export the result as CSV and save
it as `supabase/.captures/database_inventory.csv`. This folder is ignored by
Git. Tell Codex the file is ready; it can inspect it locally without printing
raw definitions or asking for each result separately. This inventory is not a
complete PostgreSQL schema dump, and additional dependencies may still require
capture after inspection.

The user reported twelve public tables with RLS enabled and not forced, and no
`supabase_migrations.schema_migrations` table. These are user-supplied dashboard
results; no direct production connection was used. See the code inventory for
the additional tables. Captured permissions and function definitions have now
been compared successfully with the reconstructed local database.

A migration is a SQL file recording a database change. The first baseline must
describe the existing production database, including permissions, rather than
create a replacement database inferred from frontend code.

## Repository findings

- Eight database relations, nineteen RPC names, and one storage bucket are
  referenced by the current application. See [code inventory](CODE_INVENTORY.md).
- No SQL definitions, migration history files, Supabase config, generated
  database types, or database CI workflow were found before this preparation.
- The Supabase JavaScript SDK is installed; it is not the migration CLI.
  Supabase CLI, Docker, `psql`, and `pg_dump` were not found on PATH, and no
  project-local Supabase CLI executable was found. This does not establish that
  these tools are absent elsewhere on the computer.
- The browser client uses a publishable key. That is insufficient to obtain a
  complete authoritative schema, policies, grants, or function definitions.
- Existing application edits are preserved. This preparation changes only
  documentation, a read-only inspection script, ignore rules, and the empty
  migration directory.

## Files and their purpose

| Path | Purpose |
| --- | --- |
| `CODE_INVENTORY.md` | What the current code expects; not production DDL |
| `audit/schema_inventory.sql` | Read-only catalog inspection; not a migration |
| `migrations/` | Reviewed, ordered SQL migrations; currently empty |
| `drafts/baseline_candidate.sql` | Local-only capture-derived draft; not approved for migration use |
| `CAPTURE_REVIEW.md` | Capture provenance, smoke-test results, findings, and remaining gaps |
| `baseline_manifest.json` | Exact source hashes and captured non-secret environment requirements |
| `.captures/` | Ignored location for private, unreviewed exports |
| `config.toml` | To be generated later by a pinned CLI, after environment decisions |

Never place the audit script or raw export in `migrations/`. Do not add a dummy
baseline: an empty migration would falsely imply that production is captured.

## Safe baseline procedure

### 1. Establish the capture context

Identify the intended production project privately. Record the PostgreSQL major
version, capture time, exposed API schemas, installed extensions, and schemas
owned by the application. Arrange a brief pause in manual schema changes during
capture; users can continue using the app. Confirm backup availability separately:
a schema export is not a data backup.

Obtain authorized read-only metadata access, or a schema-only export prepared by
the project owner. Do not post passwords, connection strings, access tokens, or
service-role keys in chat or committed files. Use an existing account's secure
connection setup; creating a new database role would itself modify production
and is outside this inspection.

### 2. Inventory production without changing it

The audit script uses a read-only transaction, selects PostgreSQL catalogs, and
ends with rollback. It does not invoke FanWars RPCs or read users/votes/referrals.
Run it only through a confirmed metadata connection and save the results in the
ignored `.captures/` directory. Start with the schema listing, then extend the
`public`-scoped queries if application-owned objects exist in other schemas.

The optional statements at the end are comments. After confirming table
existence, separately capture storage bucket configuration and migration version
metadata. Do not export migration SQL bodies before checking for embedded secrets.
Metadata permissions may hide objects: partial results are not proof of absence.

Collect tables, views, types, sequences, defaults, primary/foreign/unique/check
constraints, indexes, RLS enabled/forced flags, complete policy expressions,
function overload signatures and bodies, owners, execution grants, default
privileges, triggers, extensions, and publication membership. Identify custom
objects on managed `auth` and `storage` schemas without treating managed schemas
as application migrations. Inspect cron/webhook/Edge Function dependencies if
production metadata reveals them; no references were found in the app.

### 3. Capture schema and existing history

Select and pin a Supabase CLI version and matching dump tooling after checking
their requirements. Initialize only local configuration. Keep production unlinked
while validating local replay if practical, so a local command cannot target it.

For the first strictly read-only capture, prefer PostgreSQL `pg_dump` with
`--schema-only` and an existing securely configured connection, or Supabase
`db dump` after reviewing that installed version's help and dump script. Keep
the application schema export in `.captures/`, not automatically in migrations.
Record tool versions and a SHA-256 digest. Do not use data-only or role/password
dumps. Review function bodies, comments, foreign server options, and other DDL
for hardcoded secrets before committing anything.

Supabase's default dump excludes managed schemas and does not include data or
custom roles. Therefore, separately account for application-owned auth triggers,
storage policies, custom role dependencies, and bucket configuration. Bucket
settings are rows, so a schema-only dump cannot recreate the bucket. Uploaded
files and auth/dashboard settings require separate handling. See the official
[CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump).

Do not use `db pull` as the initial unattended read-only export. The documented
workflow can update remote migration history; do not answer yes to that prompt
or use automatic yes flags. `migration repair` inserts/deletes history records.
Neither belongs to this production-read-only phase. See the official
[migration history reference](https://supabase.com/docs/reference/cli/supabase-migration-repair).

If production already has migration records, recover the corresponding original
SQL where available and compare it with an independently captured current schema.
Record unresolved history gaps. Do not delete existing history or arbitrarily
mark it reverted. If no history exists, prepare one captured baseline for new
databases; it must never be replayed against the populated production database.

### 4. Assemble and review the local baseline

Preserve production semantics. Do not redesign constraints or policies during
capture. Order extensions/custom schemas/types, tables/sequences, constraints,
functions, triggers, indexes, RLS, and grants by actual dependencies. Include
application-owned auth/storage customizations with the local Supabase managed
schemas as prerequisites; never recreate those entire managed schemas.

Review grants and target default privileges together: a successful restore can
still change effective access. Capture custom role requirements without
passwords. Version bucket configuration separately as a local setup or reviewed
future provisioning migration. Keep seeds fictional and local-only, including
any featured battle fixture; do not copy production records or hardcode guessed
IDs into schema migrations.

Use `<UTC timestamp>_baseline_existing_schema.sql` only after the actual export
is reviewed. Generate TypeScript database types from the reconstructed local
database after validation, then consider wiring them into the browser client.

### 5. Replay in a disposable local environment

Generate local config with the pinned CLI and match the production PostgreSQL
major version and relevant extensions. Use local credentials for the app.
Restore into a fresh local Supabase instance or isolated staging project.
Reset/replay commands must explicitly target local infrastructure and must not
include `--linked` or a production connection URL.

Compare schema definitions and effective privileges with the capture. Test with
anonymous, ordinary authenticated, captain, and moderator identities rather than
only a privileged connection. Verify duplicate and concurrent voting, closed
battles, ownership checks, referral abuse rules, storage paths, moderation, and
the RPC return shapes in the code inventory. Repeat local replay from scratch
to establish that a clean clone can reconstruct the application schema.

### 6. Adopt version control without applying the baseline to production

Commit reviewed config, migrations, local-only fixtures, generated types, and
verification instructions together. Add CI that builds a disposable database
and runs SQL/RLS tests without production credentials. Existing npm auth tests
mock Supabase and do not establish database correctness.

Production history alignment is a separate, explicitly authorized operation.
If appropriate, a reviewed baseline can later be recorded as already applied,
without executing its DDL. That metadata write still changes production and has
not been authorized by this task. Resolve existing history before choosing exact
versions to mark. Do not run `db push`, `db reset`, migration application,
`migration repair`, or config push on production during this preparation.

For future changes: create a new migration, test locally, review the SQL and
staging results, and make production deployment a separate deliberate step.
Do not rewrite applied migrations. Check dashboard changes for drift before
deployment. See [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations).

## Current validation and next steps

The scoped captures, application contract comparison and fresh local migration
rebuild are complete. No further manual CSV exports are required for this scope.
Detailed results and credentials remain in Git-ignored `.captures/`.

To check the already migrated local database, run:

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
node supabase/audit/validate_local_supabase.mjs --migrated
```

This uses only the local `supabase_db_fanwars` Docker container and rolls back
fictional test records. It never reads `.env.local` or a production database URL.
The initial setup used `db reset --local --no-seed` exclusively on the new
disposable database; do not reset local databases containing work you need.

Existing production finding: captured `get_battle_results` is SECURITY DEFINER and exposes
pending/rejected option names and counts when called directly. This behavior was
confirmed using fictional local records, not a production request. Table SELECT
policies still hide those rows. The baseline preserves existing behavior; the
fourth migration now fixes it locally. Regression checks pass for both API roles.
The production fix has not been deployed.

Next: launch an isolated app session with local Supabase credentials, complete
browser flows, generate database types, and add synthetic fixtures/CI. Preserve
the existing production app configuration. Review a production rollout that
marks the baseline already applied before applying the follow-up migrations.
That production history alignment and deployment have not been authorized or
performed. Commit the reviewed migration/config/test files when ready; raw
captures and credentials must remain excluded.
