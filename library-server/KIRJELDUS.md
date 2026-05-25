# Raamatukogu server

Eesmärk: haldab raamatukogu teoseid, raamatuid, laenutusi ja tasulisi tellimusi.

## Voog

1. Server loob vajalikud tabelid.
2. Kasutaja teeb `/pay` päringu ja maksab pangaserveri kaudu.
3. Kui makse õnnestub, luuakse liikme tellimus ja ligipääsu token.
4. Token on pikk kood, mis näitab serverile, et kasutaja on maksnud.
5. `/login` tagastab aktiivse tellimuse tokeni.
6. Kaitstud tegevused vajavad seda tokenit.
7. Tokeniga saab vaadata raamatuid, lisada/muuta/kustutada teoseid ja teha laenutusi.
8. Raamatu laenutamisel muutub staatus `Laenutatud`.
9. Tagastamisel kustutatakse laenutus ja staatus muutub tagasi `Vaba`.
