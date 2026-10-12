-- XT Trade Journal AI — opt-in cloud backup pilot, v1
-- Run in Supabase SQL Editor for the XT-specific Supabase project.
-- Copies trading data on demand; XT continues to use local SQLite.
-- This schema does NOT enable live synchronization or restore.
create table if not exists public.xt_cloud_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  format_version integer not null default 1 check (format_version = 1),
  captured_at timestamptz not null default now(),
  account_count integer not null default 0 check (account_count >= 0),
  execution_count integer not null default 0 check (execution_count >= 0),
  trade_count integer not null default 0 check (trade_count >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);

alter table public.xt_cloud_backups enable row level security;

-- Only authenticated customers may access the table; RLS restricts each
-- customer to their own user_id. Never put a secret/service-role key in XT.
revoke all on table public.xt_cloud_backups from public, anon, authenticated;
grant select, insert, update, delete on table public.xt_cloud_backups to authenticated;

drop policy if exists "xt_backups_select_own" on public.xt_cloud_backups;
create policy "xt_backups_select_own" on public.xt_cloud_backups
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "xt_backups_insert_own" on public.xt_cloud_backups;
create policy "xt_backups_insert_own" on public.xt_cloud_backups
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "xt_backups_update_own" on public.xt_cloud_backups;
create policy "xt_backups_update_own" on public.xt_cloud_backups
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "xt_backups_delete_own" on public.xt_cloud_backups;
create policy "xt_backups_delete_own" on public.xt_cloud_backups
for delete to authenticated using ((select auth.uid()) = user_id);
