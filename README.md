# Kiire testimine õpetajale

## Vajalikud tehnoloogiad

1. Docker Desktop
2. Bun
3. Veebibrauser

Eesmärk: kontrollida, et raamatukogu server kasutab pangaserverit tellimuse maksmiseks.

Projekt kasutab kahte PostgreSQL andmebaasi:

1. `bank` - pangaserveri kontod ja tehingud.
2. `library` - raamatukogu teosed, raamatud, liikmed, laenutused ja tellimused.

## Mida Docker siin teeb?

Dockerit kasutatakse ainult PostgreSQL andmebaasi käivitamiseks.

Käsk:

```bash
docker compose up -d
```
Selleks peab Docker Desktop olema arvutis installitud ja käima.

## Käivitamine imlma

1. Käivita PostgreSQL:
   ```bash
   docker compose up -d
   ```

2. Käivita pangaserver:
   ```bash
   bun run start:bank
   ```

3. Käivita teises terminalis raamatukogu server:
   ```bash
   bun run start:library
   ```

4. Ava brauseris fail:
   ```text
   teacher-test.html
   ```

Kui Dockerit ei kasutata, peab PostgreSQL ise töötama aadressil:

```text
postgres://postgres:postgres@localhost:5432
```

Ja andmebaasid `bank` ning `library` peavad olemas olema.

## Testi voog

1. Vajuta `Kontrolli /health`.
2. Vajuta `Näita pangakontosid`.
3. Vajuta `Proovi lisada ilma tellimuseta`.
4. Tulemus peab olema `401`, sest kasutaja pole veel maksnud.
5. Vajuta `Maksa tellimus`.
6. Vajuta `Login ja küsi token`.
7. Vajuta `Lisa teos + raamatu eksemplar`.
8. Vajuta `Näita library andmebaasi sisu`.
9. Vajuta `Muuda teost`.
10. Vajuta `Kustuta teos`.

Kui makse töötab, liigub raha testkasutaja kontolt `5500000001` raamatukogu kontole `6600000006`.
Kui raamatukogu töötab, ilmub lisatud teos ja raamatu eksemplar `library` andmebaasi.
