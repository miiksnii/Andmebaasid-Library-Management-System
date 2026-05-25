import { SQL } from "bun";

const adminUrl = process.env.TEST_ADMIN_DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

function databaseUrl(databaseName) {
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function clearDatabase(databaseName) {
  const sql = new SQL(databaseUrl(databaseName));

  try {
    const tables = await sql`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `;

    if (!tables.length) {
      console.log(`${databaseName}: no tables found`);
      return;
    }

    const tableList = tables
      .map((table) => `"${table.schemaname}"."${table.tablename}"`)
      .join(", ");

    await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    console.log(`${databaseName}: cleared ${tables.length} tables`);
  } finally {
    await sql.close();
  }
}

await clearDatabase("bank");
await clearDatabase("library");

console.log("Done. All rows were deleted from bank and library.");
