# XT Supabase migration — foundation only

Status: SQL preparation, not a deployed cloud application. The existing Next.js app still uses local SQLite and local customer authentication. Do not deploy it to ephemeral hosting as if this migration completed the port.

## Apply the foundation

1. In the intended XT Supabase project, open SQL Editor → New query.
2. Paste the entire `migrations/202610120001_xt_cloud_foundation.sql` file and run it.
3. The result should contain 23 `xt_` tables with both RLS flags true. Existing local users and records are not copied.

The SQL is transactional and can be rerun. It creates only XT-prefixed application tables, a private `xt-journal-files` storage bucket, and a policy scoped to that bucket. It does not delete existing business data or modify other applications' tables. Stop if it reports an incompatible existing table or a public XT bucket.

Every application row includes an authenticated user ID, a composite owner/key primary key, and an owner RLS policy. Existing foreign keys are also owner-scoped. Anonymous access is revoked. This preserves independent settings keys, journal dates and system-folder IDs between customers. Attachments use private object storage, not database BLOBs. New cloud accounts are import/manual only; automatic brokerage sync and live execution remain disabled.

Never put API tokens, encryption keys or broker passwords into these client-accessible tables (including `xt_settings`). Existing encrypted account credentials are deliberately excluded. A server-only secret store must be designed before cloud AI keys or broker sync are enabled.

## Configuration, after the application port

Use deployment environment variables, not hardcoded project credentials:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

These values identify the public client; they cannot run SQL migrations, administer the project, bypass row policies, or publish a Netlify site. No service-role key is required for this client configuration. Authentication still requires each user's session.

## Remaining work before customer rollout

- Replace local authentication with verified Supabase sessions; implement callback, confirmation and password recovery.
- Port the synchronous SQLite domain queries/transactions to PostgreSQL. Preserve tenant ownership and trade rebuild atomicity. Do not work around this by downloading/uploading whole SQLite files on each request.
- Create per-user notebook folders during authenticated onboarding.
- Adapt attachment upload/download to private storage and short-lived signed URLs.
- Keep confidential settings in server-only storage; do not expose them via owner-readable settings.
- Migrate any existing users/records explicitly, without reusing local password hashes as Supabase credentials.
- Validate cross-customer isolation, imports, rebuilds, concurrency, export/restore, serverless timeouts and mobile UI against the hosted staging project.
- Configure Supabase allowed redirect URLs for the final HTTPS website, then deploy the compatible app to Netlify Free. Quotas and project pausing still apply.

A publishable-key read-only connectivity check confirmed email login/signups are enabled and email confirmation is required for the supplied project. No live records, users, tables or settings were modified by this check.
