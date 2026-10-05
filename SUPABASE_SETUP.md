# Readiness — Supabase Cloud setup (Phase 1)

## Current scope
This branch adds the database foundation and setup notes only. The app still uses its existing browser localStorage; cloud sync is NOT enabled yet. Do not treat this as a completed backup system until account flow, migration, sync conflict handling, and restore tests are implemented.

## Design
The public.readiness_data table stores one JSON document per authenticated Supabase user. Its primary key is the Auth user ID, and Row Level Security (RLS) restricts operations to that same user. This phase does not delete or rewrite existing browser data.

## Setup
1. Create a Supabase project.
2. Run supabase/schema.sql in the Supabase SQL Editor.
3. Keep the Project URL and publishable/anon key available for a later frontend configuration step.
4. Never put the service_role key or database password in this static GitHub Pages app or commit them to Git.
5. Configure an authentication method and account recovery before relying on cloud data.

## Planned rollout (not yet implemented)
- Add frontend configuration using the Project URL and publishable key.
- Add sign-in/sign-out UI and session handling.
- Add a user-confirmed one-time migration that copies existing local data without deleting its local copy.
- Add cloud load/save, offline queue, visible sync status, and conflict rules.
- Add export/import backup and test account isolation, refresh, browser-data deletion, offline edits, and recovery.

## Data safety
Cloud persistence helps survive clearing this browser's site data only after successful sync. It does not protect against deleting the cloud account/row, losing account access, or a sync that never completed. Keep periodic JSON exports as an independent backup. Do not share private credentials in chat or commit them to this repository.
