import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";
const { PGlite } = await import(process.env.XT_PGLITE_MODULE || "@electric-sql/pglite");
const script = await readFile(new URL("../xt_cloud_backups.sql", import.meta.url), "utf8");
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
test("backup SQL is repeatable, preserves snapshots, and denies cross-owner/anonymous/destructive access", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
   INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`);
    await db.exec(script);
    const login = async (id) => {
      await db.exec("RESET ROLE; SET ROLE authenticated;");
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    };
    await login(alice);
    await db.query("INSERT INTO public.xt_cloud_backups(user_id,payload) VALUES ($1,$2)", [
      alice,
      { marker: "Alice snapshot" },
    ]);
    await login(bob);
    assert.equal((await db.query("SELECT * FROM public.xt_cloud_backups")).rows.length, 0);
    await db.query("INSERT INTO public.xt_cloud_backups(user_id,payload) VALUES ($1,$2)", [
      bob,
      { marker: "Bob snapshot" },
    ]);
    await assert.rejects(
      db.query(
        "INSERT INTO public.xt_cloud_backups(user_id,payload) VALUES ($1,'{}') ON CONFLICT (user_id) DO UPDATE SET payload='{}'",
        [alice],
      ),
      /row-level security/,
    );
    await assert.rejects(
      db.query("UPDATE public.xt_cloud_backups SET user_id=$1 WHERE user_id=$2", [alice, bob]),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query(
          "UPDATE public.xt_cloud_backups SET payload='{}' WHERE user_id=$1 RETURNING user_id",
          [alice],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(db.exec("DELETE FROM public.xt_cloud_backups"), /permission denied/);
    await assert.rejects(db.exec("TRUNCATE public.xt_cloud_backups"), /permission denied/);
    await assert.rejects(
      db.exec("UPDATE public.xt_cloud_backups SET format_version=2"),
      /check constraint/,
    );
    await assert.rejects(
      db.exec("UPDATE public.xt_cloud_backups SET account_count=-1"),
      /check constraint/,
    );
    await assert.rejects(
      db.exec("UPDATE public.xt_cloud_backups SET payload='[]'"),
      /check constraint/,
    );
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(db.exec("SELECT * FROM public.xt_cloud_backups"), /permission denied/);
    await assert.rejects(
      db.query("INSERT INTO public.xt_cloud_backups(user_id,payload) VALUES ($1,'{}')", [alice]),
      /permission denied/,
    );
    await db.exec("RESET ROLE;");
    await db.exec(script);
    await login(alice);
    assert.deepEqual(
      (await db.query("SELECT payload FROM public.xt_cloud_backups")).rows[0].payload,
      { marker: "Alice snapshot" },
    );
    await db.exec('UPDATE public.xt_cloud_backups SET payload=\'{"marker":"replacement"}\'');
    assert.deepEqual(
      (await db.query("SELECT payload FROM public.xt_cloud_backups")).rows[0].payload,
      { marker: "replacement" },
    );
    await db.exec("RESET ROLE;");
    const flags = (
      await db.query(
        "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='xt_cloud_backups'",
      )
    ).rows[0];
    assert(flags.relrowsecurity && flags.relforcerowsecurity);
  } finally {
    await db.close();
  }
});
