# XT AI — Supabase connection smoke test

This is a **connectivity check only**. Existing XT customers still use XT's
own SQLite authentication and storage. Do not invite live users based only on
this check.

## Configure locally (Windows)

1. Make sure your Supabase project has been created.
2. Copy the **Project URL** and **Publishable key** from Supabase Dashboard.
   Never use a secret/service-role key for this test.
3. In the XT repository, create or edit `apps/web/.env.local` (this is
   ignored by Git). Put the following lines in the file, with your own values:

   ```env
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

4. Close and restart the XT development server (run
   `Start-XT-Customers.cmd`).
5. While XT is running, open `http://127.0.0.1:3000/api/cloud/health`.

Expected response: `{"connected":true,"status":"connected","authService":"reachable"}`.

`not_configured` means one or both environment variables are missing.
`invalid_project_url` means the Project URL is invalid.
`connection_failed` and `auth_service_unavailable` mean the upstream
Supabase Auth endpoint could not be reached successfully. This does not
guarantee correct database schema, RLS, permissions, or functioning login.

## Safety

- Never commit `.env.local`, database passwords, JWT secrets, service-role
  keys, or user financial records to GitHub.
- Even a publishable key should not be confused with a secret key. Supabase
  RLS and server-side authorization are still necessary.
- The endpoint is unauthenticated only in a limited sense: XT's middleware
  will still require the existing XT session in customer mode.
- This endpoint does not write any customer records or change XT's auth.
- Keep the existing user data backed up before any future migration.
