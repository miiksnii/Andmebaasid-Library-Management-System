# Pangaserver

Eesmärk: teeb kontoülekandeid ja salvestab tehingud andmebaasi.

## Voog

1. Server loob või uuendab ülekande protseduuri.
2. Raamatukogu saadab `/transfer` päringu.
3. Server kontrollib lähtekontot, sihtkontot ja summat.
4. PostgreSQL protseduur võtab raha ühelt kontolt maha.
5. Sama protseduur lisab raha teisele kontole.
6. Edukas ülekanne salvestatakse `transaction` tabelisse.
7. Kui midagi ebaõnnestub, pannakse veateade `info` tabelisse.
8. API tagastab kas loodud tehingu või veateate.
