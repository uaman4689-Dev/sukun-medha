/**
 * One-time Neon -> Supabase data migration.
 *
 * Required env:
 *   SOURCE_DATABASE_URL = rotated Neon connection string
 *   TARGET_DATABASE_URL = Supabase Session Pooler connection string
 *
 * Safety:
 *   Default mode is a read-only preflight.
 *   Actual migration requires MIGRATION_CONFIRM=YES.
 *   It replaces rows in matching public tables on the TARGET only.
 *   It never changes or deletes data on SOURCE.
 */
const { Client } = require("pg");

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
const doMigration = process.env.MIGRATION_CONFIRM === "YES";

if (!sourceUrl || !targetUrl) {
  console.error("Missing SOURCE_DATABASE_URL or TARGET_DATABASE_URL.");
  process.exit(2);
}

const clientOptions = (connectionString) => ({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  statement_timeout: 0,
  query_timeout: 0,
});

const quoteIdent = (value) => '"' + String(value).replace(/"/g, '""') + "'";
const qualified = (schema, table) => quoteIdent(schema) + "." + quoteIdent(table);

async function getTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name);
}

async function getColumns(client, table) {
  const result = await client.query(
    `
      SELECT column_name, data_type, udt_name, is_generated, is_identity
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  );
  return result.rows;
}

async function main() {
  const source = new Client(clientOptions(sourceUrl));
  const target = new Client(clientOptions(targetUrl));
  let transactionOpen = false;

  try {
    await source.connect();
    await target.connect();

    const [sourceVersion, targetVersion] = await Promise.all([
      source.query("SELECT current_setting('server_version') AS version"),
      target.query("SELECT current_setting('server_version') AS version"),
    ]);
    console.log("Source PostgreSQL:", sourceVersion.rows[0].version);
    console.log("Target PostgreSQL:", targetVersion.rows[0].version);

    const [sourceTables, targetTables] = await Promise.all([
      getTables(source),
      getTables(target),
    ]);

    const missingOnTarget = sourceTables.filter((name) => !targetTables.includes(name));
    const extraOnTarget = targetTables.filter((name) => !sourceTables.includes(name));

    if (missingOnTarget.length || extraOnTarget.length) {
      console.error("Table mismatch. No target data was changed.");
      if (missingOnTarget.length) console.error("Missing on target:", missingOnTarget.join(", "));
      if (extraOnTarget.length) console.error("Extra on target:", extraOnTarget.join(", "));
      process.exitCode = 3;
      return;
    }

    const tableColumns = new Map();
    for (const table of sourceTables) {
      const [sourceCols, targetCols] = await Promise.all([
        getColumns(source, table),
        getColumns(target, table),
      ]);
      const shape = (cols) => cols.map((c) =>
        [c.column_name, c.data_type, c.udt_name, c.is_generated, c.is_identity].join("|")
      );
      if (JSON.stringify(shape(sourceCols)) !== JSON.stringify(shape(targetCols))) {
        console.error(`Column mismatch in public.${table}. No target data was changed.`);
        process.exitCode = 4;
        return;
      }
      tableColumns.set(table, sourceCols.filter((c) => c.is_generated === "NEVER"));
    }

    console.log(`Preflight passed: ${sourceTables.length} matching public tables.`);
    console.log("Target data has NOT been changed.");

    if (!doMigration) {
      console.log("DRY RUN ONLY. To perform the one-time import, set MIGRATION_CONFIRM=YES.");
      return;
    }

    if (sourceTables.length === 0) {
      console.log("No public tables found; nothing to migrate.");
      return;
    }

    await target.query("BEGIN");
    transactionOpen = true;
    await target.query("SET LOCAL session_replication_role = replica");

    const tableList = sourceTables.map((t) => qualified("public", t)).join(", ");
    await target.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

    let totalRows = 0;
    for (const table of sourceTables) {
      const columns = tableColumns.get(table);
      if (!columns.length) continue;

      const columnNames = columns.map((c) => c.column_name);
      const selectSql = `SELECT ${columnNames.map(quoteIdent).join(", ")} FROM ${qualified("public", table)}`;
      const sourceRows = await source.query(selectSql);
      const batchSize = Math.max(1, Math.min(250, Math.floor(60000 / columnNames.length)));

      for (let offset = 0; offset < sourceRows.rows.length; offset += batchSize) {
        const batch = sourceRows.rows.slice(offset, offset + batchSize);
        const values = [];
        const tuples = batch.map((row, rowIndex) => {
          const placeholders = columnNames.map((column, colIndex) => {
            values.push(row[column]);
            return `$${rowIndex * columnNames.length + colIndex + 1}`;
          });
          return "(" + placeholders.join(", ") + ")";
        });
        const insertSql = `INSERT INTO ${qualified("public", table)} (${columnNames.map(quoteIdent).join(", ")}) VALUES ${tuples.join(", ")}`;
        await target.query(insertSql, values);
      }

      totalRows += sourceRows.rows.length;
      console.log(`Imported public.${table}: ${sourceRows.rows.length} rows`);

      for (const column of columns) {
        const sequence = await target.query(
          "SELECT pg_get_serial_sequence($1, $2) AS sequence_name",
          [`public.${table}`, column.column_name]
        );
        const sequenceName = sequence.rows[0]?.sequence_name;
        if (!sequenceName) continue;
        const maxResult = await target.query(
          `SELECT MAX(${quoteIdent(column.column_name)}) AS max_value, COUNT(*) > 0 AS has_rows FROM ${qualified("public", table)}`
        );
        const maxValue = maxResult.rows[0].max_value;
        const hasRows = maxResult.rows[0].has_rows;
        await target.query(
          "SELECT setval($1::regclass, $2::bigint, $3::boolean)",
          [sequenceName, maxValue || 1, hasRows]
        );
      }
    }

    await target.query("COMMIT");
    transactionOpen = false;
    console.log(`Migration committed successfully. Total rows imported: ${totalRows}`);
  } catch (error) {
    if (transactionOpen) {
      try { await target.query("ROLLBACK"); } catch (_) {}
    }
    console.error("Migration failed. Target transaction was rolled back when possible.");
    console.error(error.message || String(error));
    process.exitCode = 1;
  } finally {
    try { await source.end(); } catch (_) {}
    try { await target.end(); } catch (_) {}
  }
}

main();
