import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import {
  assertPostgresAvailable,
  createFreshDatabase,
  databaseUrl,
  dropDatabase,
  seedBankDatabase,
} from "./helpers/postgres.js";
import { requestJson, startService, waitForHealth } from "./helpers/services.js";

const runId = `${Date.now()}_${process.pid}`;
const bankDatabase = `bank_e2e_${runId}`;
const libraryDatabase = `library_e2e_${runId}`;
const bankUrl = "http://127.0.0.1:4101";
const libraryUrl = "http://127.0.0.1:4100";
const bankDatabaseUrl = databaseUrl(bankDatabase);
const libraryDatabaseUrl = databaseUrl(libraryDatabase);

// Hoiame serverid muutujates, et test saaks need lõpus kinni panna.
let bankService;
let libraryService;
let bankDatabaseCreated = false;
let libraryDatabaseCreated = false;

describe("subscription-gated library writes", () => {
  beforeAll(async () => {
    // Loome selle testi jaoks puhtad ajutised andmebaasid.
    await assertPostgresAvailable();

    await createFreshDatabase(bankDatabase);
    bankDatabaseCreated = true;
    await createFreshDatabase(libraryDatabase);
    libraryDatabaseCreated = true;
    await seedBankDatabase(bankDatabaseUrl);

    // Käivitame mõlemad API-d ainult testi portidel.
    bankService = startService("bank-server/server.js", {
      BANK_PORT: "4101",
      BANK_DATABASE_URL: bankDatabaseUrl,
    });
    libraryService = startService("library-server/server.js", {
      LIBRARY_PORT: "4100",
      LIBRARY_DATABASE_URL: libraryDatabaseUrl,
      BANK_URL: bankUrl,
      LIBRARY_BANK_ACCOUNT: "6600000006",
      TOKEN_SECRET: "e2e-secret",
    });

    // Ootame, kuni mõlemad serverid vastavad /health päringule.
    await Promise.all([waitForHealth(bankUrl), waitForHealth(libraryUrl)]);
  });

  afterAll(async () => {
    // Paneme serverid kinni ja kustutame ajutised andmebaasid.
    const [bankOutput, libraryOutput] = await Promise.all([
      bankService?.stop(),
      libraryService?.stop(),
    ]);

    if (bankDatabaseCreated) await dropDatabase(bankDatabase);
    if (libraryDatabaseCreated) await dropDatabase(libraryDatabase);

    if (process.env.DEBUG_E2E_SERVERS) {
      console.log("bank server", bankOutput);
      console.log("library server", libraryOutput);
    }
  });

  test("rejects create, edit and delete before payment, then allows them after subscription purchase", async () => {
    // Need kaitstud tegevused peavad enne maksmist ebaõnnestuma.
    const unauthenticatedWork = {
      title: `Blocked Work ${runId}`,
      releaseDate: "2026-05-22",
      language: "English",
      publisher: "E2E Press",
      filePath: `/tmp/blocked-${runId}.pdf`,
      pages: 101,
    };

    for (const action of [
      ["POST", "/works", unauthenticatedWork],
      ["PATCH", "/works/1", { title: "Blocked Update" }],
      ["DELETE", "/works/1"],
    ]) {
      const [method, path, body] = action;
      const { response, json } = await requestJson(libraryUrl, path, { method, body });

      expect(response.status).toBe(401);
      expect(json.error).toBe("Valid paid subscription token required");
    }

    // Ostame tellimuse, makstes raamatukogule pangaserveri kaudu.
    const email = `subscriber-${runId}@example.test`;
    const referenceNumber = Number(String(Date.now()).slice(-9));
    const payment = await requestJson(libraryUrl, "/pay", {
      method: "POST",
      body: {
        email,
        personalCode: `MEM-${runId}`,
        firstName: "E2E",
        lastName: "Subscriber",
        debitAccount: 5500000001,
        amount: 5,
        referenceNumber,
      },
    });

    expect(payment.response.status).toBe(200);
    expect(payment.json.ok).toBe(true);
    expect(payment.json.subscription.token).toBeString();
    expect(payment.json.bank.amount).toBe("5.00");

    // Login tagastab sama tunnuse, mis maksega loodi.
    const login = await requestJson(libraryUrl, "/login", {
      method: "POST",
      body: { email },
    });
    expect(login.response.status).toBe(200);
    expect(login.json.token).toBe(payment.json.subscription.token);

    // Kehtiva tunnusega saab kasutaja teose lisada.
    const token = payment.json.subscription.token;
    const create = await requestJson(libraryUrl, "/works", {
      method: "POST",
      token,
      body: {
        title: `Paid Work ${runId}`,
        releaseDate: "2026-05-22",
        language: "English",
        publisher: "E2E Press",
        filePath: `/tmp/paid-${runId}.pdf`,
        pages: 123,
      },
    });

    expect(create.response.status).toBe(201);
    expect(create.json.id).toBeNumber();
    expect(create.json.title).toBe(`Paid Work ${runId}`);

    // Sama tunnus lubab seda teost ka muuta.
    const update = await requestJson(libraryUrl, `/works/${create.json.id}`, {
      method: "PATCH",
      token,
      body: {
        title: `Updated Paid Work ${runId}`,
        pages: 234,
      },
    });

    expect(update.response.status).toBe(200);
    expect(update.json.title).toBe(`Updated Paid Work ${runId}`);
    expect(Number(update.json.pages)).toBe(234);

    // Kustutamine toimib korra; sama id uuesti kustutamine annab 404.
    const remove = await requestJson(libraryUrl, `/works/${create.json.id}`, {
      method: "DELETE",
      token,
    });

    expect(remove.response.status).toBe(200);
    expect(remove.json.id).toBe(create.json.id);

    const removeAgain = await requestJson(libraryUrl, `/works/${create.json.id}`, {
      method: "DELETE",
      token,
    });

    expect(removeAgain.response.status).toBe(404);

    // Lõpuks kontrollime, et raha liikus liikme kontolt raamatukogu kontole.
    const bankSql = new SQL(bankDatabaseUrl);
    const balances = await bankSql`
      SELECT accountnumber, balance
      FROM account.account
      ORDER BY accountnumber
    `;
    await bankSql.close();

    expect(balances).toEqual([
      { accountnumber: 5500000001, balance: "15.00" },
      { accountnumber: 6600000006, balance: "5.00" },
    ]);
  });
});
