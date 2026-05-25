import { SQL } from "bun";

const PORT = Number(process.env.BANK_PORT || 4001);
const DATABASE_URL =
  process.env.BANK_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/bank";

const sql = new SQL(DATABASE_URL);

// Loob panga ülekande protseduuri ja veateadete tabeli.
const procedureSql = `
CREATE SCHEMA IF NOT EXISTS customer;
CREATE SCHEMA IF NOT EXISTS account;

CREATE TABLE IF NOT EXISTS customer.customer (
  id serial PRIMARY KEY,
  firstname varchar(50) NOT NULL,
  lastname varchar(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS account.account (
  id serial PRIMARY KEY,
  customerid integer REFERENCES customer.customer(id),
  accountnumber bigint UNIQUE NOT NULL,
  balance numeric(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS account.transaction (
  id serial PRIMARY KEY,
  debitaccount integer NOT NULL REFERENCES account.account(id),
  creditaccount integer NOT NULL REFERENCES account.account(id),
  description varchar(256),
  referencenumber bigint NOT NULL,
  amount numeric(10, 2) NOT NULL,
  createdat timestamp DEFAULT CURRENT_TIMESTAMP
);

WITH inserted_customers AS (
  INSERT INTO customer.customer (firstname, lastname)
  SELECT firstname, lastname
  FROM (VALUES ('Test', 'Kasutaja'), ('Raamatukogu', 'Konto')) AS v(firstname, lastname)
  WHERE NOT EXISTS (SELECT 1 FROM account.account WHERE accountnumber IN (5500000001, 6600000006))
  RETURNING id, firstname
)
INSERT INTO account.account (customerid, accountnumber, balance)
SELECT id, 5500000001, 20.00 FROM inserted_customers WHERE firstname = 'Test'
UNION ALL
SELECT id, 6600000006, 0.00 FROM inserted_customers WHERE firstname = 'Raamatukogu'
ON CONFLICT (accountnumber) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.info_source (
  source varchar(16) PRIMARY KEY,
  description varchar(128)
);

INSERT INTO public.info_source (source, description)
VALUES ('PROC', 'Procedure')
ON CONFLICT (source) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.info (
  id serial PRIMARY KEY,
  source varchar(16) DEFAULT 'PROC',
  "time" timestamp DEFAULT CURRENT_TIMESTAMP,
  message text NOT NULL
);

CREATE OR REPLACE PROCEDURE public.accounttransfer(
  IN p_debaccount bigint,
  IN p_creaccount bigint,
  IN p_sum numeric,
  IN p_refnumber bigint,
  IN p_description varchar(256)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debit_id integer;
  v_credit_id integer;
  v_newbalance numeric(10,2);
  v_message text;
BEGIN
  IF p_sum IS NULL OR p_sum <= 0 THEN
    INSERT INTO public.info (source, message) VALUES ('PROC', 'ERROR: transfer amount must be positive');
    RETURN;
  END IF;

  IF p_debaccount = p_creaccount THEN
    INSERT INTO public.info (source, message) VALUES ('PROC', 'ERROR: debit and credit accounts cannot be the same');
    RETURN;
  END IF;

  SELECT id, balance - p_sum
    INTO v_debit_id, v_newbalance
    FROM account.account
    WHERE accountnumber = p_debaccount
    FOR UPDATE;

  IF v_debit_id IS NULL THEN
    INSERT INTO public.info (source, message) VALUES ('PROC', 'ERROR: debit account not found: ' || p_debaccount);
    RETURN;
  END IF;

  SELECT id
    INTO v_credit_id
    FROM account.account
    WHERE accountnumber = p_creaccount
    FOR UPDATE;

  IF v_credit_id IS NULL THEN
    INSERT INTO public.info (source, message) VALUES ('PROC', 'ERROR: credit account not found: ' || p_creaccount);
    RETURN;
  END IF;

  IF v_newbalance < 0 THEN
    INSERT INTO public.info (source, message)
    VALUES ('PROC', 'ERROR: debit account ' || p_debaccount || ' balance would be under 0: ' || v_newbalance);
    RETURN;
  END IF;

  UPDATE account.account SET balance = balance - p_sum WHERE id = v_debit_id;
  UPDATE account.account SET balance = balance + p_sum WHERE id = v_credit_id;

  INSERT INTO account.transaction (debitaccount, creditaccount, description, referencenumber, amount)
  VALUES (v_debit_id, v_credit_id, p_description, p_refnumber, p_sum);
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
  INSERT INTO public.info (source, message) VALUES ('PROC', 'ERROR: ' || v_message);
END;
$$;
`;

function json(data, status = 200) {
  // Saadab JSON vastuse õige staatusega.
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

async function body(req) {
  // Loeb päringu JSONi; vigane või tühi sisu muutub tühjaks objektiks.
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function accountFromCard(value) {
  // Selles demos kasutame kaardinumbrit nagu kontonumbrit.
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

async function installProcedure() {
  // Lisab või asendab PostgreSQL ülekande protseduuri.
  await sql.unsafe(procedureSql);
}

async function transfer(req) {
  // Liigutab raha ühelt kontolt teisele SQL protseduuri kaudu.
  const data = await body(req);
  const debitAccount = Number(data.debitAccount || accountFromCard(data.cardNumber));
  const creditAccount = Number(data.creditAccount);
  const amount = Number(data.amount);
  const referenceNumber = Number(data.referenceNumber || Date.now());
  const description = String(data.description || "Library subscription").slice(0, 256);

  if (!debitAccount || !creditAccount || !Number.isFinite(amount)) {
    return json({ error: "debitAccount/cardNumber, creditAccount and amount are required" }, 400);
  }

  // Kontrollib, kas sama viitenumbriga makse on juba tehtud.
  const before = await sql`
    SELECT count(*)::int AS count
    FROM account.transaction t
    JOIN account.account d ON d.id = t.debitaccount
    JOIN account.account c ON c.id = t.creditaccount
    WHERE d.accountnumber = ${debitAccount}
      AND c.accountnumber = ${creditAccount}
      AND t.referencenumber = ${referenceNumber}
  `;

  // Tegelik kontojäägi muutmine toimub PostgreSQLis.
  await sql`CALL public.accounttransfer(${debitAccount}, ${creditAccount}, ${amount}, ${referenceNumber}, ${description})`;

  // Loeb loodud tehingu tagasi, et API saaks selle tagastada.
  const after = await sql`
    SELECT t.id, t.amount, t.description, t.referencenumber, t.createdat,
           d.accountnumber AS debitaccount, c.accountnumber AS creditaccount
    FROM account.transaction t
    JOIN account.account d ON d.id = t.debitaccount
    JOIN account.account c ON c.id = t.creditaccount
    WHERE d.accountnumber = ${debitAccount}
      AND c.accountnumber = ${creditAccount}
      AND t.referencenumber = ${referenceNumber}
    ORDER BY t.id DESC
    LIMIT 1
  `;

  if (!after.length || Number(before[0].count) > 0) {
    // Kui protseduur ebaõnnestus, tagasta viimane veateade.
    const log = await sql`SELECT message FROM public.info ORDER BY id DESC LIMIT 1`;
    return json({ error: log[0]?.message || "Transfer failed" }, 400);
  }

  return json({ ok: true, transaction: after[0] });
}

// Enne päringuid kontrollime, et ülekande protseduur oleks olemas.
try {
  await installProcedure();
} catch (err) {
  console.error("Pangaserver ei saanud PostgreSQL andmebaasiga ühendust.");
  console.error("Käivita enne: docker compose up -d");
  console.error(`Andmebaasi aadress: ${DATABASE_URL}`);
  console.error(`Algne viga: ${err.message}`);
  process.exit(1);
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    // Lihtne ruuter: vaatab meetodit ja aadressi ning kutsub õige funktsiooni.
    const url = new URL(req.url);
    try {
      if (req.method === "OPTIONS") return json({ ok: true });
      if (req.method === "GET" && url.pathname === "/health") return json({ ok: true });
      if (req.method === "GET" && url.pathname === "/accounts") {
        // Näitab kontosid ja klientide nimesid testimiseks.
        const rows = await sql`
          SELECT a.id, a.accountnumber, a.balance, c.firstname, c.lastname
          FROM account.account a
          LEFT JOIN customer.customer c ON c.id = a.customerid
          ORDER BY a.id
        `;
        return json(rows);
      }
      if (req.method === "POST" && url.pathname === "/transfer") return transfer(req);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
});

console.log(`Bank API running on http://localhost:${PORT}`);
