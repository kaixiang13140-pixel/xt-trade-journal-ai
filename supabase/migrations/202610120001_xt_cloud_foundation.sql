-- XT cloud foundation, version 1. Run only in the intended XT Supabase project.
-- This creates new xt_ tables. It does not migrate local records or enable cloud mode.
-- No passwords, API secrets, service-role keys, or broker credentials belong in these tables.
BEGIN;

CREATE TABLE IF NOT EXISTS public.xt_accounts (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  broker TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'import')),
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  profit_calc_method TEXT NOT NULL DEFAULT 'fifo',
  auto_sync BIGINT NOT NULL DEFAULT 0 CHECK (auto_sync = 0),
  last_sync_at TEXT,
  ibkr_sync_time_zone TEXT,
  snapshot_json TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_executions (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  fee DOUBLE PRECISION NOT NULL DEFAULT 0,
  executed_at TEXT NOT NULL,
  asset_class TEXT,
  source TEXT NOT NULL,
  import_metadata_json TEXT,
  content_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_trades (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset_class TEXT,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  quantity DOUBLE PRECISION NOT NULL,
  open_quantity DOUBLE PRECISION NOT NULL,
  avg_entry DOUBLE PRECISION NOT NULL,
  avg_exit DOUBLE PRECISION,
  gross_pnl DOUBLE PRECISION NOT NULL,
  fees DOUBLE PRECISION NOT NULL,
  net_pnl DOUBLE PRECISION NOT NULL,
  execution_count BIGINT NOT NULL,
  execution_ids_json TEXT NOT NULL,
  exits_json TEXT NOT NULL,
  duration_ms BIGINT,
  notes TEXT,
  tags_json TEXT,
  mistakes_json TEXT,
  playbook_id TEXT,
  rating BIGINT,
  stop_loss DOUBLE PRECISION,
  profit_target DOUBLE PRECISION,
  reviewed_at TEXT,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS public.xt_market_csv_datasets (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  resolution TEXT NOT NULL,
  currency TEXT NOT NULL,
  price_basis TEXT NOT NULL,
  bars_json TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  bar_count BIGINT NOT NULL,
  first_time BIGINT NOT NULL,
  last_time BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_trade_excursions (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  provider TEXT NOT NULL,
  symbol TEXT NOT NULL,
  resolution TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  estimate_json TEXT NOT NULL,
  PRIMARY KEY (user_id, trade_key),
  FOREIGN KEY (user_id, trade_key) REFERENCES public.xt_trades (user_id, key) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.xt_journal_days (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS public.xt_folders (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_notes (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags_json TEXT,
  trade_key TEXT,
  day_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_playbooks (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_settings (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS public.xt_attachments (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_path TEXT NOT NULL CHECK (split_part(storage_path, '/', 1) = user_id::text),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_note_templates (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_trade_rule_checks (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  trade_key TEXT NOT NULL,
  playbook_id TEXT NOT NULL,
  rule TEXT NOT NULL,
  followed BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_progress_rules (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  stage TEXT NOT NULL,
  weekdays_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_progress_checks (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  date TEXT NOT NULL,
  done BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_missed_trades (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  playbook_id TEXT,
  entry DOUBLE PRECISION,
  stop DOUBLE PRECISION,
  target DOUBLE PRECISION,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  archived_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_prop_accounts (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  firm TEXT NOT NULL,
  name TEXT NOT NULL,
  program TEXT NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  size_minor BIGINT,
  parent_id TEXT,
  journal_account_id TEXT,
  opened_on TEXT NOT NULL,
  closed_on TEXT,
  renewal_on TEXT,
  renewal_minor BIGINT,
  notes TEXT NOT NULL DEFAULT '',
  archived BIGINT NOT NULL DEFAULT 0,
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, parent_id) REFERENCES public.xt_prop_accounts (user_id, id),
  FOREIGN KEY (user_id, journal_account_id) REFERENCES public.xt_accounts (user_id, id) ON DELETE SET NULL (journal_account_id)
);

CREATE TABLE IF NOT EXISTS public.xt_prop_entries (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  account_id TEXT,
  firm TEXT NOT NULL,
  kind TEXT NOT NULL,
  category TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  split_bps BIGINT NOT NULL,
  fee_minor BIGINT NOT NULL,
  occurred_on TEXT NOT NULL,
  due_on TEXT,
  status TEXT NOT NULL,
  parent_id TEXT,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  voided BIGINT NOT NULL DEFAULT 0,
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES public.xt_prop_accounts (user_id, id),
  FOREIGN KEY (user_id, parent_id) REFERENCES public.xt_prop_entries (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_prop_receipts (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  payout_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_minor BIGINT NOT NULL,
  occurred_on TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  voided BIGINT NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, payout_id) REFERENCES public.xt_prop_entries (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_prop_audit (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.xt_import_sources (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  format TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES public.xt_accounts (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.xt_import_source_aliases (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  format TEXT NOT NULL,
  alias_key TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES public.xt_accounts (user_id, id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, source_id) REFERENCES public.xt_import_sources (user_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.xt_import_batches (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  format TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  from_time TEXT NOT NULL,
  to_time TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES public.xt_accounts (user_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS xt_executions_account_hash ON public.xt_executions (user_id, account_id, content_hash);
CREATE INDEX IF NOT EXISTS xt_executions_account_symbol ON public.xt_executions (user_id, account_id, symbol);
CREATE INDEX IF NOT EXISTS xt_trades_account_closed ON public.xt_trades (user_id, account_id, closed_at);
CREATE INDEX IF NOT EXISTS xt_trades_symbol ON public.xt_trades (user_id, symbol);
CREATE INDEX IF NOT EXISTS xt_trades_opened ON public.xt_trades (user_id, opened_at);
CREATE INDEX IF NOT EXISTS xt_trades_account_opened ON public.xt_trades (user_id, account_id, opened_at);
CREATE INDEX IF NOT EXISTS xt_market_csv_symbol_resolution ON public.xt_market_csv_datasets (user_id, symbol, resolution);
CREATE INDEX IF NOT EXISTS xt_notes_folder ON public.xt_notes (user_id, folder_id);
CREATE INDEX IF NOT EXISTS xt_attachments_owner ON public.xt_attachments (user_id, owner_type, owner_id);
CREATE INDEX IF NOT EXISTS xt_trade_rule_checks_trade ON public.xt_trade_rule_checks (user_id, trade_key);
CREATE INDEX IF NOT EXISTS xt_progress_checks_date ON public.xt_progress_checks (user_id, date);
CREATE INDEX IF NOT EXISTS xt_prop_entries_account_date ON public.xt_prop_entries (user_id, account_id, occurred_on);
CREATE INDEX IF NOT EXISTS xt_prop_entries_date ON public.xt_prop_entries (user_id, occurred_on);
CREATE INDEX IF NOT EXISTS xt_prop_receipts_payout ON public.xt_prop_receipts (user_id, payout_id);
CREATE INDEX IF NOT EXISTS xt_prop_audit_entity ON public.xt_prop_audit (user_id, entity_type, entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS xt_import_source_alias_unique ON public.xt_import_source_aliases (user_id, account_id, format, alias_key);
CREATE UNIQUE INDEX IF NOT EXISTS xt_import_batch_unique ON public.xt_import_batches (user_id, account_id, format, fingerprint);

-- Owner checks apply to SELECT, INSERT, UPDATE (old and new owner) and DELETE.
-- Deliberately do not grant access to anon. Publishable key alone cannot read records.
DO $xt$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['xt_accounts', 'xt_executions', 'xt_trades', 'xt_market_csv_datasets', 'xt_trade_excursions', 'xt_journal_days', 'xt_folders', 'xt_notes', 'xt_playbooks', 'xt_settings', 'xt_attachments', 'xt_note_templates', 'xt_trade_rule_checks', 'xt_progress_rules', 'xt_progress_checks', 'xt_missed_trades', 'xt_prop_accounts', 'xt_prop_entries', 'xt_prop_receipts', 'xt_prop_audit', 'xt_import_sources', 'xt_import_source_aliases', 'xt_import_batches'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated, PUBLIC', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS xt_owner_access ON public.%I', t);
    EXECUTE format('CREATE POLICY xt_owner_access ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', t);
  END LOOP;
END
$xt$;

-- This directory never receives public URLs. Object names start with the signed-in UUID.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('xt-journal-files', 'xt-journal-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;
DO $xt$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'xt-journal-files' AND public) THEN
    RAISE EXCEPTION 'Existing XT bucket is public. Review it before applying this migration.';
  END IF;
END
$xt$;
DROP POLICY IF EXISTS xt_journal_files_owner ON storage.objects;
CREATE POLICY xt_journal_files_owner ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'xt-journal-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
WITH CHECK (bucket_id = 'xt-journal-files' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
COMMIT;

-- Expected: every returned row has rls_enabled = true and rls_forced = true.
SELECT tablename, rowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_tables p JOIN pg_class c ON c.relname = p.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
WHERE p.schemaname = 'public' AND p.tablename LIKE 'xt\_%' ESCAPE '\'
ORDER BY tablename;
