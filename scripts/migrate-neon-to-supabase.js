/**
 * Additive Neon -> Supabase migration.
 *
 * Required GitHub Actions repository secrets:
 *   SOURCE_DATABASE_URL = rotated Neon connection string (raw URI, no quotes)
 *   TARGET_DATABASE_URL = Supabase Session Pooler connection string (raw URI, no quotes)
 *   MIGRATION_CONFIRM = YES (required to write)
 *
 * Safety: preflight by default; never truncates, drops, or overwrites target rows.
 * Existing target conflicts are skipped. Source is only read.
 */
'use strict';
const { Client } = require('pg');

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
const confirmed = process.env.MIGRATION_CONFIRM === 'YES';
const batchSize = Math.max(1, Math.min(250, Number(process.env.MIGRATION_BATCH_SIZE) || 100));

if (!sourceUrl || !targetUrl) {
  console.error('Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL.');
  process.exit(2);
}
if (sourceUrl === targetUrl) {
  console.error('Source and target URLs are identical; refusing to run.');
  process.exit(2);
}

function safeHost(label, value) {
  try {
    const u = new URL(value);
    console.log(label + ' host:', u.hostname || '(missing)');
    if (!u.hostname || u.hostname === 'base' || u.hostname.includes('[') || u.hostname.includes(']')) {
      throw new Error(label + ' connection URL has an invalid hostname.');
    }
  } catch (error) {
    throw new Error(label + ' connection URL is invalid. Check that the GitHub Secret contains the full PostgreSQL URI (postgresql://...) without quotes or placeholder text. ' + error.message);
  }
}
safeHost('SOURCE_DATABASE_URL', sourceUrl);
safeHost('TARGET_DATABASE_URL', targetUrl);

const options = (connectionString) => ({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  statement_timeout: 0,
  query_timeout: 0,
});
const qi = (value) => '"' + String(value).replace(/"/g, '""') + '"';
const qt = (table) => 'public.' + qi(table);

async function tables(client) {
  const r = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  return r.rows.map(x => x.table_name);
}
async function columns(client, table) {
  const r = await client.query(`
    SELECT column_name, data_type, udt_name, is_generated, is_identity
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position
  `, [table]);
  return r.rows;
}

async function main() {
  const src = new Client(options(sourceUrl));
  const dst = new Client(options(targetUrl));
  let roleChanged = false;
  try {
    await src.connect();
    await dst.connect();

    const [srcMeta, dstMeta, srcTables, dstTables] = await Promise.all([
      src.query('SELECT current_database() AS db, current_user AS usr'),
      dst.query('SELECT current_database() AS db, current_user AS usr'),
      tables(src),
      tables(dst),
    ]);
    console.log('Source:', srcMeta.rows[0].db, '/', srcMeta.rows[0].usr);
    console.log('Target:', dstMeta.rows[0].db, '/', dstMeta.rows[0].usr);

    const dstSet = new Set(dstTables);
    const missing = srcTables.filter(t => !dstSet.has(t));
    if (missing.length) throw new Error('Target schema missing tables: ' + missing.join(', ') + '. No data was copied.');

    const map = new Map();
    for (const table of srcTables) {
      const [sc, dc] = await Promise.all([columns(src, table), columns(dst, table)]);
      const dmap = new Map(dc.map(c => [c.column_name, c]));
      const missingCols = sc.filter(c => c.is_generated !== 'ALWAYS' && !dmap.has(c.column_name));
      if (missingCols.length) throw new Error('Target public.' + table + ' missing columns: ' + missingCols.map(c => c.column_name).join(', '));
      const selected = sc.filter(c => c.is_generated !== 'ALWAYS' && dmap.has(c.column_name));
      map.set(table, selected.map(c => c.column_name));
    }

    console.log('Preflight passed:', srcTables.length, 'matching public tables.');
    if (!confirmed) {
      console.log('DRY RUN ONLY. Target database was not changed. Set MIGRATION_CONFIRM=YES to start additive import.');
      return;
    }

    // Requires the Supabase postgres role. It disables FK triggers only for this
    // dedicated connection and is restored in finally; constraints remain intact.
    await dst.query('SET session_replication_role = replica');
    roleChanged = true;

    let total = 0;
    for (const table of srcTables) {
      const cols = map.get(table);
      if (!cols.length) continue;
      const colSql = cols.map(qi).join(', ');
      let offset = 0;
      let imported = 0;

      while (true) {
        const page = await src.query(
          'SELECT ' + colSql + ' FROM ' + qt(table) + ' LIMIT $1 OFFSET $2',
          [batchSize, offset]
        );
        if (!page.rows.length) break;

        const values = [];
        const tuples = page.rows.map(row => '(' + cols.map(col => {
          values.push(row[col]);
          return '$' + values.length;
        }).join(', ') + ')');

        await dst.query(
          'INSERT INTO ' + qt(table) + ' (' + colSql + ') OVERRIDING SYSTEM VALUE VALUES ' +
          tuples.join(', ') + ' ON CONFLICT DO NOTHING',
          values
        );
        imported += page.rows.length;
        offset += page.rows.length;
        if (page.rows.length < batchSize) break;
      }

      // Move serial/identity sequences forward without changing table contents.
      for (const col of cols) {
        const seq = await dst.query(
          'SELECT pg_get_serial_sequence($1, $2) AS name',
          ['public.' + table, col]
        );
        const seqName = seq.rows[0] && seq.rows[0].name;
        if (!seqName) continue;
        const max = await dst.query('SELECT MAX(' + qi(col) + ') AS v FROM ' + qt(table));
        if (max.rows[0].v !== null) {
          await dst.query('SELECT setval($1::regclass, $2, true)', [seqName, max.rows[0].v]);
        }
      }

      total += imported;
      console.log('Processed', table + ':', imported, 'source rows (target conflicts skipped)');
    }

    console.log('Additive migration completed. Source rows processed:', total);
    console.log('No target rows were deleted or overwritten.');
  } finally {
    if (roleChanged) {
      try { await dst.query('SET session_replication_role = origin'); } catch (e) {
        console.error('Warning: could not restore session_replication_role:', e.message);
      }
    }
    await Promise.allSettled([src.end(), dst.end()]);
  }
}

main().catch(error => {
  console.error('Migration stopped:', error.message || error);
  process.exitCode = 1;
});
