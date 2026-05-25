import { SQL } from "bun";
import { createHmac, randomBytes } from "node:crypto";

const PORT = Number(process.env.LIBRARY_PORT || 4000);
const DATABASE_URL =
  process.env.LIBRARY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/library";
const BANK_URL = process.env.BANK_URL || "http://localhost:4001";
const LIBRARY_BANK_ACCOUNT = Number(process.env.LIBRARY_BANK_ACCOUNT || 6600000006);
const SUBSCRIPTION_PRICE = Number(process.env.SUBSCRIPTION_PRICE || 5);
const TOKEN_SECRET = process.env.TOKEN_SECRET || "assignment-secret";

const sql = new SQL(DATABASE_URL);

// Loob vajalikud raamatukogu tabelid, kui server käivitub.
const setupSql = `
CREATE TABLE IF NOT EXISTS works (
  id serial PRIMARY KEY,
  title varchar(255) NOT NULL,
  release_date date,
  language varchar(50) NOT NULL DEFAULT 'English',
  publisher varchar(100),
  file_path varchar(4096) UNIQUE,
  pages bigint,
  UNIQUE(title, release_date, publisher)
);

CREATE TABLE IF NOT EXISTS books (
  id serial PRIMARY KEY,
  work_id integer UNIQUE NOT NULL REFERENCES works(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  isbn varchar(32) UNIQUE NOT NULL,
  format varchar(32) NOT NULL,
  status varchar(32) DEFAULT 'Vaba'
);

CREATE TABLE IF NOT EXISTS members (
  personal_code varchar(50) PRIMARY KEY,
  email varchar(255) UNIQUE,
  status varchar(32) NOT NULL DEFAULT 'Tavaline',
  first_name varchar(50) NOT NULL,
  last_name varchar(50) NOT NULL
);

ALTER TABLE members ADD COLUMN IF NOT EXISTS email varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS members_email_unique ON members (email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS loans (
  id serial PRIMARY KEY,
  member_id varchar(50) NOT NULL REFERENCES members(personal_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  book_id integer NOT NULL UNIQUE REFERENCES books(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  loan_start date NOT NULL,
  loan_end date NOT NULL,
  CHECK (loan_end > loan_start)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id serial PRIMARY KEY,
  member_id varchar(50) NOT NULL REFERENCES members(personal_code) ON UPDATE CASCADE ON DELETE CASCADE,
  email varchar(255) NOT NULL,
  token text UNIQUE NOT NULL,
  amount numeric(10,2) NOT NULL,
  bank_transaction_id integer,
  starts_at timestamp DEFAULT CURRENT_TIMESTAMP,
  ends_at timestamp NOT NULL,
  active boolean DEFAULT true
);
`;

function json(data, status = 200) {
  // Saadab JSON vastuse õige staatusega.
  return Response.json(data, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

function tokenFor(email) {
  // Loob maksnud liikmele juhusliku tunnuse.
  const nonce = randomBytes(10).toString("hex");
  return createHmac("sha256", TOKEN_SECRET).update(`${email}:${Date.now()}:${nonce}`).digest("hex");
}

async function requireAuth(req) {
  // Kontrollib Bearer tunnust ja kas tellimus veel kehtib.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const rows = await sql`
    SELECT s.*, m.personal_code, m.email
    FROM subscriptions s
    JOIN members m ON m.personal_code = s.member_id
    WHERE s.token = ${token}
      AND s.active = true
      AND s.ends_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;
  return rows[0] || null;
}

async function routeAuthed(req, handler) {
  // Lubab kaitstud aadresse kasutada ainult maksnud kasutajatel.
  const auth = await requireAuth(req);
  if (!auth) return json({ error: "Valid paid subscription token required" }, 401);
  try {
    return await handler(auth);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

async function pay(req) {
  // Teeb makse pangaserveris ja loob siis tellimuse.
  const data = await body(req);
  const email = String(data.email || "").trim().toLowerCase();
  const personalCode = String(data.personalCode || data.personal_code || email || "").trim();
  const firstName = String(data.firstName || data.first_name || "Library").trim();
  const lastName = String(data.lastName || data.last_name || "Member").trim();
  const amount = Number(data.amount || SUBSCRIPTION_PRICE);

  if (!email || (!data.debitAccount && !data.cardNumber)) {
    return json({ error: "email and debitAccount/cardNumber are required" }, 400);
  }

  const bankResponse = await fetch(`${BANK_URL}/transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      debitAccount: data.debitAccount,
      cardNumber: data.cardNumber,
      creditAccount: LIBRARY_BANK_ACCOUNT,
      amount,
      referenceNumber: data.referenceNumber || Date.now(),
      description: `Library subscription for ${email}`,
    }),
  });

  const bankResult = await bankResponse.json().catch(() => ({}));
  if (!bankResponse.ok) return json({ error: "Bank payment failed", bank: bankResult }, 402);

  await sql`
    INSERT INTO members (personal_code, email, status, first_name, last_name)
    VALUES (${personalCode}, ${email}, 'Tavaline', ${firstName}, ${lastName})
    ON CONFLICT (personal_code)
    DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
  `;

  const token = tokenFor(email);
  const subscription = await sql`
    INSERT INTO subscriptions (member_id, email, token, amount, bank_transaction_id, ends_at)
    VALUES (
      ${personalCode},
      ${email},
      ${token},
      ${amount},
      ${bankResult.transaction?.id || null},
      CURRENT_TIMESTAMP + INTERVAL '30 days'
    )
    RETURNING id, member_id, email, token, amount, starts_at, ends_at
  `;

  return json({ ok: true, subscription: subscription[0], bank: bankResult.transaction });
}

async function login(req) {
  // Tagastab selle e-posti aktiivse tellimuse tunnuse.
  const data = await body(req);
  const email = String(data.email || "").trim().toLowerCase();
  const rows = await sql`
    SELECT token, ends_at
    FROM subscriptions
    WHERE email = ${email}
      AND active = true
      AND ends_at > CURRENT_TIMESTAMP
    ORDER BY ends_at DESC
    LIMIT 1
  `;
  return rows[0] ? json(rows[0]) : json({ error: "No active paid subscription" }, 401);
}

async function createWork(req) {
  // Lisab raamatukogu andmebaasi uue teose.
  const data = await body(req);
  const rows = await sql`
    INSERT INTO works (title, release_date, language, publisher, file_path, pages)
    VALUES (${data.title}, ${data.releaseDate || data.release_date || null}, ${data.language || "English"},
            ${data.publisher || null}, ${data.filePath || data.file_path || null}, ${data.pages || null})
    RETURNING *
  `;
  return json(rows[0], 201);
}

async function listWorks() {
  // Näitab teoseid otse library andmebaasi works tabelist.
  return json(await sql`
    SELECT *
    FROM works
    ORDER BY id DESC
  `);
}

async function createBook(req) {
  // Lisab teosele konkreetse raamatu eksemplari.
  const data = await body(req);
  const rows = await sql`
    INSERT INTO books (work_id, isbn, format, status)
    VALUES (${data.workId || data.work_id}, ${data.isbn}, ${data.format || "Digitaalne"}, ${data.status || "Vaba"})
    RETURNING *
  `;
  return json(rows[0], 201);
}

async function updateWork(req, id) {
  // Muudab ainult need teose väljad, mis päringus saadeti.
  const data = await body(req);
  const rows = await sql`
    UPDATE works
    SET title = COALESCE(${data.title || null}, title),
        release_date = COALESCE(${data.releaseDate || data.release_date || null}, release_date),
        language = COALESCE(${data.language || null}, language),
        publisher = COALESCE(${data.publisher || null}, publisher),
        file_path = COALESCE(${data.filePath || data.file_path || null}, file_path),
        pages = COALESCE(${data.pages || null}, pages)
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? json(rows[0]) : json({ error: "Work not found" }, 404);
}

async function createLoan(req, auth) {
  // Loob laenutuse ja märgib raamatu laenutatuks.
  const data = await body(req);
  const start = data.loanStart || data.loan_start || new Date().toISOString().slice(0, 10);
  const end = data.loanEnd || data.loan_end;
  const rows = await sql`
    INSERT INTO loans (member_id, book_id, loan_start, loan_end)
    VALUES (${auth.member_id}, ${data.bookId || data.book_id}, ${start}, ${end})
    RETURNING *
  `;
  await sql`UPDATE books SET status = 'Laenutatud' WHERE id = ${data.bookId || data.book_id}`;
  return json(rows[0], 201);
}

// Enne päringuid kontrollime, et tabelid oleks olemas.
try {
  await sql.unsafe(setupSql);
} catch (err) {
  console.error("Raamatukogu server ei saanud PostgreSQL andmebaasiga ühendust.");
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
    const workId = url.pathname.match(/^\/works\/(\d+)$/)?.[1];
    const loanReturnId = url.pathname.match(/^\/loans\/(\d+)\/return$/)?.[1];

    try {
      if (req.method === "OPTIONS") return json({ ok: true });
      if (req.method === "GET" && url.pathname === "/health") return json({ ok: true });
      if (req.method === "POST" && url.pathname === "/pay") return pay(req);
      if (req.method === "POST" && url.pathname === "/login") return login(req);
      if (req.method === "GET" && url.pathname === "/works") return routeAuthed(req, () => listWorks());
      if (req.method === "GET" && url.pathname === "/books") {
        // Näitab raamatuid ainult kehtiva tunnusega kasutajale.
        return routeAuthed(req, async () => json(await sql`
          SELECT b.*, w.title, w.language, w.publisher
          FROM books b JOIN works w ON w.id = b.work_id
          ORDER BY b.id
        `));
      }
      if (req.method === "POST" && url.pathname === "/works") return routeAuthed(req, () => createWork(req));
      if (req.method === "POST" && url.pathname === "/books") return routeAuthed(req, () => createBook(req));
      if (req.method === "PATCH" && workId) return routeAuthed(req, () => updateWork(req, Number(workId)));
      if (req.method === "DELETE" && workId) {
        // Kustutab enne seotud laenutused ja eksemplarid, siis teose.
        return routeAuthed(req, async () => {
          await sql`
            DELETE FROM loans
            WHERE book_id IN (SELECT id FROM books WHERE work_id = ${Number(workId)})
          `;
          await sql`DELETE FROM books WHERE work_id = ${Number(workId)}`;
          const rows = await sql`DELETE FROM works WHERE id = ${Number(workId)} RETURNING *`;
          return rows[0] ? json(rows[0]) : json({ error: "Work not found" }, 404);
        });
      }
      if (req.method === "POST" && url.pathname === "/loans") return routeAuthed(req, (auth) => createLoan(req, auth));
      if (req.method === "POST" && loanReturnId) {
        // Tagastamine eemaldab laenutuse ja teeb raamatu uuesti vabaks.
        return routeAuthed(req, async () => {
          const rows = await sql`DELETE FROM loans WHERE id = ${Number(loanReturnId)} RETURNING *`;
          if (rows[0]) await sql`UPDATE books SET status = 'Vaba' WHERE id = ${rows[0].book_id}`;
          return rows[0] ? json(rows[0]) : json({ error: "Loan not found" }, 404);
        });
      }
      return json({ error: "Not found" }, 404);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
});

console.log(`Library API running on http://localhost:${PORT}`);
