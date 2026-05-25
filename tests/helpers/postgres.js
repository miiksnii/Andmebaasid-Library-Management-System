import { SQL } from "bun";

const DEFAULT_ADMIN_URL = "postgres://postgres:postgres@localhost:5432/postgres";

export function databaseUrl(databaseName, baseUrl = process.env.TEST_ADMIN_DATABASE_URL || DEFAULT_ADMIN_URL) {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteIdent(value) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe database identifier: ${value}`);
  }
  return `"${value}"`;
}

export async function createFreshDatabase(databaseName) {
  const sql = new SQL(process.env.TEST_ADMIN_DATABASE_URL || DEFAULT_ADMIN_URL);
  const quoted = quoteIdent(databaseName);

  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
  } catch {
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${databaseName}
        AND pid <> pg_backend_pid()
    `;
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoted}`);
  }

  await sql.unsafe(`CREATE DATABASE ${quoted}`);
  await sql.close();
}

export async function assertPostgresAvailable() {
  const sql = new SQL(process.env.TEST_ADMIN_DATABASE_URL || DEFAULT_ADMIN_URL);

  try {
    await sql.unsafe("SELECT 1");
  } catch (error) {
    throw new Error(
      [
        "Postgres is required for this e2e test.",
        `Start Postgres and set TEST_ADMIN_DATABASE_URL if it is not ${DEFAULT_ADMIN_URL}.`,
        `Original error: ${error.message}`,
      ].join(" "),
    );
  } finally {
    await sql.close().catch(() => undefined);
  }
}

export async function dropDatabase(databaseName) {
  const sql = new SQL(process.env.TEST_ADMIN_DATABASE_URL || DEFAULT_ADMIN_URL);
  const quoted = quoteIdent(databaseName);

  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
  } finally {
    await sql.close();
  }
}

export async function seedBankDatabase(bankDatabaseUrl) {
  const sql = new SQL(bankDatabaseUrl);

  await sql`
    CREATE SCHEMA IF NOT EXISTS customer
  `;
  await sql`
    CREATE SCHEMA IF NOT EXISTS account
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS customer.customer (
      id serial PRIMARY KEY,
      firstname varchar(50) NOT NULL,
      lastname varchar(50) NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account.account (
      id serial PRIMARY KEY,
      customerid integer REFERENCES customer.customer(id),
      accountnumber bigint UNIQUE NOT NULL,
      balance numeric(10, 2) NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS account.transaction (
      id serial PRIMARY KEY,
      debitaccount integer NOT NULL REFERENCES account.account(id),
      creditaccount integer NOT NULL REFERENCES account.account(id),
      description varchar(256),
      referencenumber bigint NOT NULL,
      amount numeric(10, 2) NOT NULL,
      createdat timestamp DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const customers = await sql`
    INSERT INTO customer.customer (firstname, lastname)
    VALUES ('E2E', 'Member'), ('Library', 'Account')
    RETURNING id
  `;

  await sql`
    INSERT INTO account.account (customerid, accountnumber, balance)
    VALUES
      (${customers[0].id}, 5500000001, 20.00),
      (${customers[1].id}, 6600000006, 0.00)
  `;

  await sql.close();
}
