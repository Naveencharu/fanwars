# FanWars — Codex project handover

Prepared for Naveen Charugundla on 2 October 2026.

## Evidence and authority

This consolidates recoverable FanWars conversation context. It is not a full transcript export, source-code archive, or inspection of the current repository/database. Historical assistant summaries are labelled separately from code excerpts. The current project files and inspected database definitions must establish what is actually implemented. Do not overwrite newer code with historical chat snippets.

## Owner and working approach

Naveen owns the product and is acting as CTO. Explain technical findings in beginner-friendly language and give clear steps. Prefer economical, open/free-first technology and focused improvements to the existing application.

## Product purpose

FanWars is an India-first, mobile-first fan participation platform. Users choose a side in a battle, participate, see results, and share to recruit others. The intended loop is choose a side → team movement → share battle card → referral/recruitment → rival response.

Free participation is the proposed growth engine. Paid identity/status and sponsorship are later monetisation ideas, not proof of current implementation or revenue.

## Existing project locations

- Current local folder visible in Naveen's VS Code screenshot: `C:\Users\NAVEEN\fanwars`.
- Historically recorded GitHub repository: `Naveencharu/fanwars`. Verify the actual Git remote before using it.
- Historically recorded deployment: `fanwars-poc.vercel.app`, using Vercel. Verify current deployment settings and branch.
- Product decisions and earlier code discussions: the Ideation project's “FanWars Tech Roadmap” conversation.

## Technology context

Earlier context identifies Next.js, React, TypeScript, Tailwind CSS/shadcn, Supabase PostgreSQL and Auth, GitHub, and Vercel. Earlier summaries also mention Supabase Storage/Realtime and Cloudflare; their active configuration is unverified.

Determine installed versions, package manager, and run/build/test scripts from project manifests and lockfiles. No exact current run command has been verified in this handover.

## Initial POC scope

The original two-day POC was limited to Join → Tribe → Battle → Vote → Result → Share. It excluded payments, video, microservices, Kubernetes, Kafka, Redis, native apps, ML, and social-scale functionality. Later roadmap phases are separate proposals; do not expand current implementation scope without a specific task.

## Features reported in earlier implementation summaries

These were reported historically, not freshly tested:

- Landing page and signup/login.
- Onboarding, profiles, and user handles.
- Tribes and battle pages.
- Voting, repeat-vote prevention, results, and rankings.
- Creator attribution.
- Sharing/referral URLs and a reported duplicate-referral-parameter fix.
- User-created FanWars through `/create-fanwar`.
- A historical example: battle #6, iPhone vs Android, at `/battle/6`.
- Later discussions include moderation and image functionality; completeness is unverified.

## Specific behaviour found in recovered code excerpts

These excerpts establish historical code behaviour, not deployed correctness:

### Voting

- Authenticated users call Supabase RPC `cast_vote(p_battle_id, p_option_id)`.
- The client prevents repeat voting in its UI and refreshes results.
- A recovered version polls results every five seconds. This does not establish that Supabase Realtime is currently used for results.
- Inspect database constraints/RPC logic to verify server-side enforcement under concurrent requests; a client lock alone does not establish one-user-one-vote integrity.

### Sharing and referrals

- Sharing appends `ref=<handler>` when the live profile has a handler.
- Onboarding creates a `profiles` record including `username`, `handler`, and `display_name`.
- It then calls `claim_referral(p_referral_handler, p_source_type="onboarding", p_source_id=null)`.
- Duplicate username/handler handling checks PostgreSQL error `23505`.
- Verify referral persistence across signup/login, duplicate claims, self-referrals, and attribution using current code and database logic.

### Moderation

- Recovered client code uses Supabase auth, `profiles`, `battles`, and RPC `is_fanwar_moderator`.
- A moderator UI loads pending battles and associated creator, tribe, and option data.
- This is not evidence of complete server-side authorisation or a fully deployed approval workflow.

## Database handover gaps

Recovered references include `profiles`, `battles`, and `tribes`, plus the RPCs above. The complete schema, option/vote/referral table names, constraints, indexes, RLS policies, grants, triggers, functions, storage policies, and migration history are not available in this consolidation.

Inspect checked-in SQL and migrations first. Clearly separate SQL present locally from SQL confirmed applied to Supabase. If definitions exist only in Supabase, request the relevant schema/function exports without secret values. Do not invent migrations from incomplete chat descriptions.

## Roadmap proposals

- P0: Chai vs Coffee, a no-login MVP experiment, share cards, and legal/payment-gateway checks.
- P1: category expansion, identity, and a weekly cadence.
- P2: proposed Razorpay monetisation and ₹49/₹99 tiers.
- P3: user-generated wars, moderation, captains, and a supporter wall.
- P4: sponsored wars before heavier dashboards/paid insights.

These are planning phases, not a verified completion sequence. The no-login experiment conflicts with the later authenticated implementation; confirm the intended flow before changing auth.

## Decisions still unresolved

- No-login participation versus signup/identity/tribe onboarding.
- One-person-one-vote positioning versus referral or eventual monetary boosts.
- Exact scoring formula and whether ranking points differ from vote totals.
- A discussed 24-hour moderation target: service intent, not a verified automated SLA.
- Which image, moderation, analytics, and monetisation features are actually completed.

Preserve current behaviour until a product decision resolves these items.

## Validation and known issues

Earlier discussion reported a duplicate-referral URL fix, but it has not been retested here. There is no verified current bug inventory.

Participation, referral conversion, and return behaviour were not established by the recovered context. A roadmap proposed Gate 1 targets of vote ≥10% and share ≥5%; denominators, observation window, and instrumentation must be specified before interpreting them.

Priorities for validation: vote integrity, referral attribution, mobile usability/performance, concentrated traffic, repeat participation, and independent organisers. Do not describe the POC as billion-user-ready without measured evidence.

## First task for Codex

Inspect this existing application before editing. Read this handover alongside the repository. Report:

1. Architecture, current routes/features, package manager, and actual run/build/test scripts.
2. Which historical features are implemented, incomplete, or absent.
3. Existing build/type errors and what checks can run without production changes.
4. Database definitions available locally and definitions still needed.
5. Differences between code and roadmap, and a focused next task.

Do not print secret values, deploy, or change the live database during this first inspection. Explain findings in simple language. After inspection, use Naveen's next feature request to define the implementation scope.

## Continuing work

Work on the existing application incrementally. For each task, explain the user-facing result, make the relevant changes, run suitable checks, and report what was and was not verified. Keep roadmap updates distinct from completed implementation. Save product context in this file so future coding sessions can recover it.

## Local implementation update 2 October 2026

The first MVP stability changes are implemented locally, not deployed:

- Fixed the nine ESLint errors found during inspection by moving initial data loaders inside their effects and escaping apostrophes in page text. Result polling uses a stable callback.
- Onboarding now opens `/home` after profile setup, or returns to the original same-origin destination when supplied. The two-step onboarding indicator was removed to match this flow.
- Login carries both the referral and original destination into onboarding when a profile is missing. A shared helper rejects external or malformed destinations and avoids adding a second referral parameter.
- Profile submission checks for an existing profile before insertion, catches submission failures, and restores the submit button. A referral claim failure is logged but does not block a successfully created profile. Failed claims are not automatically retried or persisted by this change.
- Added six local auth-flow regression tests using fake auth/database services. Run them with `npm test`; they do not write to Supabase.

Validation: the local regression tests pass. TypeScript and a production build passed during implementation; the build needed network access to download the existing Google fonts. ESLint reached zero errors with twenty warnings remaining. Live authentication, voting constraints, referral attribution, and moderator/storage permissions still require browser/database verification.

The existing uncommitted clan-page changes were preserved. Crimson styling, feed personalization, elections, payments, sponsorships, and analytics were not implemented in this stability change. The next product enhancement is the crimson design and mobile layout, followed by a small-group MVP test.

## Supabase baseline preparation 2 October 2026

Repository inspection found eight directly queried database relations, nineteen RPC names, and the `fanwars-media` Storage bucket. No existing migration SQL or Supabase configuration was found. Supabase CLI, Docker, `psql`, and `pg_dump` were not on PATH; no project-local Supabase CLI was found. Production definitions and migration history have not been inspected.

The safe capture and adoption plan is in [supabase/README.md](supabase/README.md), with exact frontend contracts in [supabase/CODE_INVENTORY.md](supabase/CODE_INVENTORY.md). A read-only catalog inventory script is prepared at `supabase/audit/schema_inventory.sql` but has not been executed. `supabase/migrations/` is reserved and contains no baseline SQL. Raw exports and local CLI state are ignored by Git.

Capture actual production schema, policies, function definitions, indexes, grants, custom auth/storage objects, bucket configuration, and existing migration versions before writing baseline migrations. Validate reconstruction in an isolated environment. Production schema application and migration-history alignment remain separate future operations; no production connection, object changes, history changes, or deployment occurred during this preparation.

The user subsequently supplied dashboard results: twelve public tables, all RLS enabled and not forced, including the additional `battle_tribes`, `fan_referrals`, `fan_reputation_events`, and `fanwar_moderators` tables. The migration-history existence check returned false. To reduce repeated prompts, `supabase/audit/capture_once.sql` now collects metadata in one read-only result for local CSV export to ignored `supabase/.captures/database_inventory.csv`. It has not been executed; raw results should be inspected locally without printing definitions that might contain secrets.

The user then saved the capture CSV. Local review confirmed twelve public tables, twenty-four functions (all nineteen client RPCs), thirty-seven indexes, forty-six constraints, and nineteen policies. `supabase/CAPTURE_REVIEW.md` records provenance and findings. A local-only capture-derived draft is at `supabase/drafts/baseline_candidate.sql`; it is not a migration and was not run against production. Ten smoke checks passed in disposable PGlite PostgreSQL 18.3 using Auth/Storage test stubs. Full Supabase PostgreSQL 17 validation is still required.

The captured absence of a vote SELECT policy reproduces the clan-page zero-count issue locally. The captured Storage bucket limit is 5 MiB while the input UI allows 10 MB. These are separate future fixes, not baseline changes. The initial dashboard JSONB export rounded seven sequence maxima, so the draft's local test uses default maxima pending exact capture. The original capture query now returns JSON as text, and `supabase/audit/capture_details.sql` batches the precision correction and remaining catalog details into one CSV export. No live object or migration-history modifications have occurred.

The supplemental CSV was subsequently saved under `supabase/.captures/` and merged. All seven sequence bounds and identity associations are now exact; the draft no longer uses assumed maxima. The default collation is recorded as `pg_catalog."default"`; a local generator check was corrected to accept that standard quoted spelling. Twelve local PostgreSQL smoke checks now pass, including exact sequence limits, function definitions and application ACL comparisons. Static code checks verified eight directly used relations, nineteen RPC names/parameter keys, and forty literal column references with no missing objects. A closed-battle option visibility mismatch also reproduced locally. Findings and remaining full-Supabase/PostgreSQL 17 validation requirements are documented in `supabase/CAPTURE_REVIEW.md`. A versionable metadata manifest records non-secret environment requirements and source hashes. The scoped catalog capture/application comparison is complete, but the draft remains outside migrations pending full integration validation; production is unchanged.
# Crimson and FanWar results follow-up — 2026-10-02

Applied the crimson/rose palette throughout the app, with shared `brand` tokens
in `app/globals.css`. Updated the logo, buttons, badges, backgrounds, gradients
and focus styles. Existing semantic success/error colours remain available.

Clan scores now use `get_battle_results` rather than reading private vote rows.
Requests are batched four at a time; errors are surfaced instead of showing false
zero scores. Closed FanWar pages recover option labels from the existing RPC in
its captured position order when the current options SELECT policy hides them.

`supabase/proposals/closed_fanwar_options.sql` is an unapplied follow-up policy
proposal. It permits option reads for live and closed battles, preserving the
existing policy name/roles. Closed clan history still requires this policy
change. Adopt and validate the original baseline first, then promote the proposal
to a subsequent timestamped migration. No production objects were changed.

Local regression tests cover aggregate counts above 1,000, RPC failure handling,
and closed option recovery. `validate_closed_options.mjs` checks the policy with
fake records in in-memory PostgreSQL: both API roles see live/closed options,
while pending/rejected options and raw votes remain hidden. This is a smoke test,
not a complete Supabase/PostgreSQL 17 replay.

Verification: production build and TypeScript passed; all nine regression tests
passed; lint reported zero errors and the same 20 existing warnings. Offline
application-contract checks found no missing objects. The compiled stylesheet
contains the new crimson tokens. Authenticated browser testing is still pending.

### Local Supabase readiness check — 2026-10-02

Re-ran all 12 disposable baseline checks, the application contract comparison
(19 RPCs; no missing objects), and the proposed closed-options policy check;
all passed. These tests still use PostgreSQL 18.3 with managed-schema stubs.
Supabase CLI 2.119.0 is now installed locally. Created `supabase/config.toml`
using `supabase init`; its database major version is 17. No baseline migration
was promoted and no production connection or write was performed.

Docker Desktop is installed per user under AppData/Local/Programs/DockerDesktop
and its UI/backend processes are running. The Docker daemon reports "Docker
Desktop is unable to start", even outside the filesystem sandbox. Windows WSL
status explicitly reports the WSL 2 kernel file missing, and Win32_Processor
reports VirtualizationFirmwareEnabled=false. Full local Supabase replay is
blocked until the WSL kernel is updated and firmware virtualization is checked.
These are Windows prerequisites, not application/schema failures. No WSL update,
BIOS changes, container resets, or system restart was attempted.

### Real Supabase validation completed — 2026-10-02

Docker now responds (engine 29.8.1), and WSL 2 has a docker-desktop distribution.
Started local PostgreSQL, Auth, Storage, REST, gateway and metadata services.
Realtime, image proxy, email, Studio, Edge and analytics were excluded for this
schema/permission validation. Detailed startup/status logs remain private.

The original draft replayed on actual Supabase PostgreSQL 17.11 (production
capture: 17.6). Schema/default privileges matched without adjustments. Five
column attribute numbers differed because production retains historical
dropped-column gaps; logical ordering and exact remaining column types match.

Promoted the verified schema, captured bucket configuration and closed-option
policy into three ordered SQL files under `supabase/migrations/`. Pinned the
already installed Supabase CLI to 2.119.0 in package manifests. A fresh LOCAL
reset replayed all three migrations, then `validate_local_supabase.mjs
--migrated` passed 16 checks, with zero infrastructure permission differences.
Checks compare exact types/identities, 12 tables, 24 functions, 37 indexes,
46 constraints, public/Storage policies, triggers, grants, extensions and
publications. Functional checks use actual Auth/Storage schemas and verify
voting, duplicate votes, moderation denial, profile ownership, referrals,
Storage folder ownership and closed/pending/rejected option access. Fictional
test records and temporary policy alterations roll back.

The local environment is running. Production was never connected to, reset,
altered or given migration-history entries. The initial schema migration must
be recorded as already applied through a separately reviewed production history
adoption, never executed against the populated production schema. Browser/HTTP,
concurrent voting, generated database types, synthetic fixtures and CI remain
next steps. No Git commit or production deployment was performed.

Additional validation finding: the captured SECURITY DEFINER
`get_battle_results` function has no battle-status filter. Fictional real-local
tests confirmed it returns option labels/counts for pending and rejected battles,
including rejected results for anonymous callers, despite the table SELECT policy
hiding those rows. Baseline preservation is expected; prepare a separate RPC
visibility fix and tests before rollout. No production request was used to
confirm this finding.

### Functionality fixes — 2026-10-02

Added `20261002140300_public_results_visibility.sql` and applied it only to local
Supabase. `get_battle_results` now returns scores only for live/closed battles;
its signature, option ordering, owner and execute grants are preserved. Real
local role tests verify live/closed totals and hidden pending/rejected results
for both anonymous and authenticated users, plus empty unknown-battle results.
All 16 migration/schema checks pass with four local migration-history entries.
The pending/rejected RPC exposure remains in production until an authorized
rollout; only the local environment has been fixed.

ImageUpload now checks source and cropped output against the captured 5 MiB
bucket limit, rejects empty/unsupported output, and shows crop/save errors inside
the editor. PNG canvas fallback uploads use `.png` and `image/png` instead of
being labelled WebP. Save/cancel actions are guarded while uploads are running.
Thirteen regression tests pass, including actual upload-handler tests proving
oversized crops never reach Storage and PNG uploads have matching MIME/filename.
No production database or Storage writes were made by these checks.

### Navigation and battle covers - 2026-10-02

Landing, Home and battle pages now use the shared account-aware AppHeader,
matching the other application pages. Restored sessions show a Profile link
and a Sign out button on desktop and mobile. The signed-in header logo and
Home link open `/home`; Profile opens `/profile`. Public visitors retain
landing navigation, Log in and Join. Removed duplicate Back Home controls.
Auth changes refresh the header outside the synchronous auth callback.
Sign out checks errors, clears account controls after success and returns to
the public landing page; failures keep a visible retry message. Sign out
uses local scope (this browser's session).

Home preserves its destination through login/onboarding and surfaces auth
lookup failures instead of redirecting users to login for every failure.
Its battle cards keep uploaded covers where available, with bundled original
SVG illustrations for chai/coffee, sports, food, cinema, technology and other
topics. Failed uploaded-image requests also fall back to those illustrations.
No production image uploads or database changes were needed.

Validation: production build and TypeScript passed; all 17 regression tests
passed, including restored sessions, successful/failed sign-out and bundled
cover selection. Targeted ESLint passed with one existing battle-page img
warning. All six SVGs parsed as valid XML. Browser control was unavailable
in this session, so visual layout and a real browser sign-out still need a
manual check. No deployment or Git commit was performed.

Home tribe navigation: the Your Tribes pills were plain divs styled like
buttons. Converted each to a Next Link targeting `/tribes/{id}`, with hover
and keyboard-focus feedback. Explore tribes continues to open `/tribes`.
Home tribe links now include `?from=home`. Tribe details use that explicit
origin to show Back to Home and return to `/home#your-tribes`, including the
not-found/error view. Links from the tribe directory retain Back to Tribes.
Only the exact `home` origin changes the destination; arbitrary input is not
used as a redirect URL.

### Photographic covers and Boost entry point - 2026-10-02

Replaced default SVG selection with six locally bundled Unsplash JPEG category
photos, cropped to 1200 x 560. Added a taller photographic card cover, richer
colour and subtle glossy light/shadow overlays. Uploaded covers remain first
choice; failed uploaded requests use a bundled photo. Reviewed all six photo
crops directly. Source pages, photographers and the free Unsplash license are
recorded in `public/battle-covers/CREDITS.md`; no production uploads were made.

Read the Oct 1 Gemini meeting DOCX as reference only. It proposes revenue from
vote-boosting payments but specifies no prices, limits, scoring formula or
payment flow. Added a live battle-page Boost your side button and expandable
invite panel as the provisional MVP interpretation. It calls the existing
share/referral flow and explains that sharing adds no votes. Closed battles
disable Boost. The panel explicitly says paid boosts are still being planned.
There is no checkout, fabricated boost count, database write or vote multiplier.
Asked the owner to choose share/invite versus paid preview; no choice was
received during implementation, so the recommended invite flow was used.
Paid implementation remains a separate product decision and backend task.

All 19 tests passed, including Boost disclosure/sharing, duplicate action guards
and closed battle behavior. Targeted ESLint has no errors and one existing
battle-page img warning. Browser UI verification remains unavailable here.

### Corrected image relevance - 2026-10-02

The owner rejected single category photos because they did not represent both
sides. Replaced that selection logic with side-specific photo matching for chai,
coffee, cricket, football, biryani, pizza, Marvel (Iron Man), DC (Batman), Android
(Samsung) and iPhone. Home uses real option names in option order, with title
parts as a matching fallback. Each half has its own photo and label, separated
by a VS badge. Reversed matchups reverse the photos. Unknown subjects use a
neutral initials/name treatment rather than an unrelated category photograph.
Uploaded covers remain preferred. Landing battle previews share the same paired
cover, and the Tribes directory uses the corresponding single side image.
Updated featured-side photo routing and source credits. Reviewed the square
crops; replaced weaker Marvel, iPhone and cricket selections after inspection.

All 19 tests pass, including exact side matching, reverse order, actual tribe
names and unknown-subject behavior. No production writes or changes to Boost.

### Crew banners and remaining matchup photos - 2026-10-02

Tribe detail pages now have a full photographic hero instead of the generic
fire emoji. Uses the tribe's uploaded `image_url` when present, otherwise the
matching named side photo. White text has dark shading for contrast; membership
actions and existing stats remain intact. Profile tribe tiles also use named
photos. Added locally bundled, reviewed square stock-photo crops for mountain,
beach, MacBook and Windows laptop, with sources recorded in CREDITS.md.
Resolver supports singular/plural mountains/beaches, the Moutain spelling,
Mac/MacBook/macOS aliases and Windows/Microsoft/PC aliases, preserving order.

FanWar detail pages now show the same paired cover as Home even when no uploaded
battle image exists. Unknown custom names still use initials until a matching
subject or uploaded image is provided. Failed tribe uploads fall back to their
named photo; failure tracking prevents repeated upload/local-image retry loops.

All 20 regression tests pass, including the two new matchups, reversed order,
crew aliases and uploaded-to-bundled-photo fallback. Reviewed all four downloaded
images directly. Production Supabase and Storage remain unchanged.

### Complete community image pass and wireframe reference - 2026-10-02

Applied the supplied Fanwars.jpeg as a visual reference for photographic cards,
community tiles and banners. Landing featured sides and voting cards now use
photographs instead of the remaining SVG/emoji logos. Landing tribe tiles are
photographic links; the closing invitation has a full-width crowd backdrop.
Home has a responsive cover alongside its welcome message. Clan headers and
clan cards now have full covers, and clan/tribe battle lists show paired images.
Private and public profiles have default cover photos, tribe thumbnails and
photographic created-battle/history entries. Ranking thumbnails use photos.
Member avatars remain actual user uploads or initials.

Added seven topic photos (community, music, film, anime/manga, gaming, tennis,
basketball) and a wide crowd banner. Sources and licenses are recorded in
public/battle-covers/CREDITS.md. The active image collection contains 22 locally
bundled JPEGs. No runtime stock-photo search or external hotlink is needed.

Matching prefers uploaded covers, then a named subject, description, and parent
tribe. Unspecified communities use a neutral fan crowd image; initials are now
only the final fallback when image files also fail. Added subject aliases for
IPL teams/players, football clubs/players and other interests. Generic franchise
defaults illustrate the sport rather than claiming to be official team artwork.

Some existing RPCs omit image fields. Supplementary read-only queries retrieve
the available covers under existing RLS without changing functions or policies.
Anonymous public-profile visitors cannot read profile/tribe uploads under the
captured authenticated-only table policies, so they see topic defaults; signed-in
visitors can see permitted uploads. Created pending/rejected battles inaccessible
through table SELECT also retain defaults. No production database/Storage writes.

Validation: 21 regression tests pass; production build passes. Targeted ESLint
has no errors, with existing navigation/raw-avatar/unused-state warnings.
Reviewed the new stock photos directly. Browser screenshot verification remains
unavailable in this tool session; responsive layout still needs an in-browser
review. Existing Boost behavior, voting, moderation and membership actions are
preserved; no mock creators, activity counters or unsupported wireframe features
were introduced.

### Clan challenges moved into Tribes - 2026-10-03

General /create-fanwar now renders only the open-battle creation form and no
longer loads clans or captain memberships. Shared form logic lives in
components/fanwar-form.tsx. Clan challenges have a dedicated route,
/tribes/[id]/challenge, entered through Challenge a Clan in the tribe's Clans
section when at least two active clans are available. Creating a clan remains
in the existing tribe-scoped Create Clan flow.

The challenge form fixes the tribe from the route, filters active clans by that
tribe, and offers only the user's captain clans as the initiating side. Before
any creating RPC, it validates captain eligibility, distinct clans, and the
same parent tribe. Clan submissions use the existing tribe ID directly rather
than get_or_create_tribe. Cancel and confirmation navigation return to the
tribe; login retains the challenge destination. Existing moderation, optional
images and create_fanwar/set_fanwar_clans RPC behavior are preserved. No
production database changes or live creation tests were performed.

Validation: 25 regression tests pass, including open-form independence from
clan queries, tribe locking/filtering, successful mocked clan association, and
rejection of non-captains, cross-tribe/self challenges and invalid tribe IDs.
Production build includes the new dynamic challenge route and passes.
### Initial-user release preparation - 2026-10-03

The user authorized publishing the current local application and database changes
for the initial user trial. Fresh release checks passed: 44 Node regression tests,
Next.js production build including TypeScript, ESLint with zero errors and twelve
warnings, 16 local Supabase PostgreSQL checks and the application contract check.
Windows process/network restrictions required running release checks with access
outside the sandbox. Private exports, local credentials and generated local state
remain ignored. GitHub deployment records confirm Vercel Production deploys main.
The historical fanwars-poc.vercel.app address returned DEPLOYMENT_NOT_FOUND.
Production database access is not configured in this workspace; database migration
application and history adoption still require a verified production connection.
