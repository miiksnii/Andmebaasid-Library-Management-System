# Projekti kirjeldus

Süsteem haldab:

- teoseid,
- autorite infot,
- raamatu eksemplare (füüsilised ja digitaalsed),
- liikmeid,
- töötajaid,
- laenutusi.

Eesmärk on pakkuda lihtsat ja tõhusat lahendust raamatukogu töö automatiseerimiseks.
Süsteem peab toetama nii füüsiliste kui ka digitaalsete raamatute haldamist.

# Raamatukogu funktsioonid

Raamatukogu hoiab ja müüb raamatuid (füüsilisi ja digitaalseid).
Liikmetel on staatusest sõltuvad soodustused.
Kasutajad saavad laenutada raamatuid, kusjuures süsteem salvestab tähtajad ja võib neid meeldetuletada.
Ostmine võib toimuda ilma sisselogimiseta; laenutamine nõuab liikmelisust.

## 1. Andmemudel (kõrgtaseme kirjeldus, mitte SQL skeem)

#### 1.1 Teosed (Works)

Kirjeldab raamatu sisu ja detaile.

Väljad:

- pealkiri
- ilmumisaasta / kuupäev
- autorid
- keel
- kirjastus
- lehekülgede arv
- ISBN

digitaalne failitee (digiraamatute puhul)

#### 1.2 Raamatu eksemplarid (Books)

Üks teos võib olla mitmes eksemplaris.
Iga eksemplar on füüsiline või digitaalne "koopia".

Väljad:

- eksemplari kood / triipkood
- teose viide
- formaat (füüsiline / digitaalne)
- staatus (vaba / laenutatud / ostetud)

  #### 1.3 Liikmed

  Väljad:

- isikukood
- eesnimi
- perekonnanimi
- staatus (tavaline, kuldliige, VIP jne)

  #### 1.4 Töötajad

  Väljad:

- eesnimi
- perekonnanimi
- osakond (nt IT tugi, admin)
- vanus
- palk
- boonus
- telefoninumber

  #### 1.5 Laenutused

Väljad:

- liikme viide
- raamatu eksemplari viide
- laenutuse alguskuupäev
- laenutuse lõppkuupäev

### 2. Mittefunktsionaalsed nõuded

Andmestruktuur peab võimaldama kiireid päringuid (näiteks otsing teose, eksemplari või liikme järgi).
Andmemudel peab toetama laiendatavust.
Süsteem peab tagama andmete tervikluse (näiteks ei saa laenutada raamatut, mis on juba laenutatud).

### 3. Seosenõuded

Iga laenutuse loomine muudab raamatu eksemplari staatuse "laenutatuks".
Laenutuse lõppemisel või tagastamisel muutub eksemplari staatus tagasi „vabaks“.
Ühel liikmel võib olla korraga piiratud arv aktiivseid laenutusi (nt 5).
Töötajate ja liikmete andmed peavad olema seotud autentimis- ja rollisüsteemiga (ligipääsuõigused).

### 4. Rollid ja ligipääsud

Raamatukoguhoidja

- lisab ja haldab teoseid
- lisab ja haldab raamatu eksemplare
- registreerib laenutusi
- registreerib tagastusi
- haldab liikmeid

Administraator

- lisab töötajaid
- haldab liikmeid

jälgib statistikat (laenutused, tagastused, ostud)

### 5. Kasutajastsenaariumid

Stsenaarium A (Raamatukoguhoidja)

- lisab uue teose (pealkiri, autorid, info)
- lisab teosele 3 uut füüsilist eksemplari
- registreerib liikme
- registreerib laenutuse
- kontrollib tagastusi

Stsenaarium B (Administraator)

- lisab uue töötaja
- muudab liikme staatust
- vaatab süsteemi statistikat

### 6. Laiendusvõimalused

Õppeainete tabel (kooliraamatukogu jaoks)
Kasutajakontod rollidega (õpilased, õpetajad, administraatorid)
Puudumiste haldus (koolikontext)
Tunniplaanide haldus
Inventari jälgimine (seadmed, õppematerjalid)
