import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
const { PGlite } = await import(process.env.XT_PGLITE_MODULE || "@electric-sql/pglite");
const migration = await readFile(
  new URL("../migrations/202610120001_xt_cloud_foundation.sql", import.meta.url),
  "utf8",
);
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
test("PostgreSQL migration is repeatable and enforces ownership for records and files", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth, public TO anon, authenticated;
 CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);
 CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
 INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`);
    await db.exec(migration);
    await db.exec(migration);
    const tables = await db.query(
      `SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'xt_%'`,
    );
    assert.equal(tables.rows.length, 23);
    assert(tables.rows.every((r) => r.relrowsecurity && r.relforcerowsecurity));
    const identity = async (id) => {
      await db.exec("RESET ROLE; SET ROLE authenticated;");
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    };
    await identity(alice);
    await assert.rejects(db.exec("TRUNCATE public.xt_accounts"), /permission denied/);
    await db.exec(
      "INSERT INTO public.xt_settings(key,value) VALUES ('timezone','Asia/Kuala_Lumpur'); INSERT INTO public.xt_accounts(id,name,kind,created_at) VALUES ('same','Alice account','manual','2026-10-12');",
    );
    await db.query("INSERT INTO storage.objects VALUES ('alice-file','xt-journal-files',$1)", [
      alice + "/screenshot.png",
    ]);
    await identity(bob);
    assert.equal((await db.query("SELECT * FROM public.xt_accounts")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM public.xt_settings")).rows.length, 0);
    assert.equal((await db.query("SELECT * FROM storage.objects")).rows.length, 0);
    await db.exec(
      "INSERT INTO public.xt_accounts(id,name,kind,created_at) VALUES ('same','Bob account','manual','2026-10-12'); INSERT INTO public.xt_settings(key,value) VALUES ('timezone','UTC');",
    );
    await assert.rejects(
      db.query("INSERT INTO public.xt_settings(user_id,key,value) VALUES ($1,'injected','x')", [
        alice,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query("UPDATE public.xt_settings SET user_id=$1 WHERE key='timezone'", [alice]),
      /row-level security/,
    );
    await assert.rejects(
      db.query("INSERT INTO storage.objects VALUES ('bad','xt-journal-files',$1)", [
        alice + "/other.png",
      ]),
      /row-level security/,
    );
    await db.query("UPDATE public.xt_accounts SET name='bad' WHERE user_id=$1", [alice]);
    await db.query("DELETE FROM public.xt_accounts WHERE user_id=$1", [alice]);
    await assert.rejects(
      db.exec(
        "INSERT INTO public.xt_accounts(id,name,kind,created_at) VALUES ('sync','invalid','sync','2026-10-12')",
      ),
      /check constraint/,
    );
    await db.exec(
      "INSERT INTO public.xt_playbooks(id,name,created_at) VALUES ('bob-only','Bob private','2026-10-12');",
    );
    // Existing cross-table foreign keys also include the owner.
    await db.exec(
      "INSERT INTO public.xt_import_sources(id,account_id,format,name,created_at) VALUES ('bob-source','same','csv','Bob report','2026-10-12');",
    );
    await identity(alice);
    assert.equal(
      (await db.query("SELECT name FROM public.xt_accounts")).rows[0].name,
      "Alice account",
    );
    assert.equal(
      (await db.query("SELECT value FROM public.xt_settings")).rows[0].value,
      "Asia/Kuala_Lumpur",
    );
    await assert.rejects(
      db.exec(
        "INSERT INTO public.xt_import_source_aliases(id,account_id,format,alias_key,source_id) VALUES ('bad','same','csv','alias','bob-source')",
      ),
      /foreign key/,
    );
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(db.query("SELECT * FROM public.xt_accounts"), /permission denied/);
    await assert.rejects(
      db.exec("INSERT INTO public.xt_settings(key,value) VALUES ('x','x')"),
      /permission denied/,
    );
    await db.exec("RESET ROLE;");
    assert.equal(
      (await db.query("SELECT public FROM storage.buckets WHERE id='xt-journal-files'")).rows[0]
        .public,
      false,
    );
  } finally {
    await db.close();
  }
});
