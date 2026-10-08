# Readiness — Supabase cloud storage

## What this implementation now does

Readiness is **local-first + cloud-backed**:

- localStorage keeps the app usable offline.
- Supabase Auth identifies the account.
- `public.readiness_data` stores the user's Readiness snapshot.
- RLS restricts database rows to the authenticated owner.
- Existing local data is never silently deleted during migration.
- If local and cloud data differ, the app asks which copy to use instead of silently overwriting one.
- Local changes are queued and uploaded automatically after a short debounce.
- Before a cloud overwrite, the app checks whether the cloud row changed since it was last loaded. If another device changed it, the app stops and reports a conflict.
- Password recovery is supported through Supabase email recovery.
- Export/import remains useful as an independent backup.

## One-time Supabase setup

### 1. Database

Run `supabase/schema.sql` in the Supabase SQL Editor.

The schema creates one row per authenticated user and enables RLS.

### 2. Data API

Make sure `public.readiness_data` is exposed through Supabase's Data API. The app uses the normal authenticated client; it does not use a service-role key.

### 3. Authentication

In Supabase Authentication settings:

1. Enable Email authentication.
2. Decide whether email confirmation is required. If enabled, users must verify their email before a normal password session is created.
3. Configure the production Site URL as the GitHub Pages site.
4. Add the production page URL to the allowed redirect URLs if required by your Auth settings.

For this app, the recovery link returns to the current Readiness page and the app then lets the user set a new password.

### 4. Frontend configuration

Open:

`Store/supabase-config.js`

Replace only these two placeholders:

```js
window.READINESS_SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  publishableKey: 'YOUR-PUBLISHABLE-OR-ANON-KEY'
};
```

Use the project's **publishable/anon key**. Never put the `service_role` key or database password into this GitHub Pages application.

Because GitHub Pages is a static frontend, a publishable/anon key is expected to be visible to the browser. Security comes from Auth + RLS, not from hiding that public client key.

## First login / migration behavior

### Case A — local data exists, cloud account is empty

The app asks:

- **Simpan data lokal ke cloud** → current device becomes the account's cloud data.
- **Mulai dari cloud kosong** → local data is backed up locally and replaced with an empty account.

There is no silent overwrite.

### Case B — cloud data exists, local browser is empty

The cloud snapshot is restored automatically.

This is the important recovery path after clearing Chrome site data or opening Readiness on a new device.

### Case C — both copies exist but differ

The app asks:

- **Gunakan data cloud**
- **Gunakan data perangkat**

The local copy is backed up before cloud restore.

### Case D — another device changed the cloud while this device was editing

The app detects the cloud timestamp change and refuses to overwrite the newer cloud version. This is intentionally conservative; the user must choose a safe resolution rather than losing data.

## Important limitation

The current implementation uses a **whole-account JSON snapshot** rather than field-level merging. Therefore, simultaneous edits on two devices are treated as a conflict instead of being automatically merged.

That is safer for the first cloud-sync version. A later version can add structured merge rules if needed.

## Backup

Cloud storage is not the only backup. Keep using Workout export/import or future full-app export for an independent JSON backup.

## Security rules

- Never commit a service-role key.
- Never commit a database password.
- Do not disable RLS.
- Do not create a public policy that lets anonymous users read another user's row.
- Do not automatically clear localStorage during login/logout.
- Logout leaves the local copy intact.
- Cloud deletion/account deletion is not implemented by the app.

## Testing checklist

Before treating cloud storage as production-ready, test:

- Register.
- Email confirmation if enabled.
- Login.
- Logout.
- Refresh while logged in.
- Create/edit habit and verify cloud sync.
- Record workout and verify cloud sync.
- Close/clear site data, reopen, login, verify restore.
- Login on a second browser/device and verify the same account data.
- Create two different accounts and verify neither can see the other's data.
- Edit on two devices and verify conflict protection.
- Go offline, make changes, reconnect, and verify retry.
- Reset password and verify recovery.
- Export a backup and verify import.

## Current status

The application code for Auth, migration, cloud sync, conflict protection, and recovery is in the feature branch. It is **not yet merged to `main`**.

The final production step still requires entering the actual Supabase project URL/publishable key in `Store/supabase-config.js` and completing the Supabase dashboard configuration above.
