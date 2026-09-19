# Rögleskogen — portabel version (React-build + PHP + JSON + SQLite)

Fork av det Appwrite-baserade projektet, byggd för att kunna köras på ett vanligt
PHP-webbhotell. Ingen Appwrite, ingen Node-server i produktion, inga
Vercel-funktioner, ingen cron, inga `.bat`-filer.

Originalprojektet (`NCC-Stenbrott-Johanna/NCC-Draft-RS`) lämnas orört.

## Stack

| Del | Teknik |
| --- | --- |
| Publik sida + admin + intranät | React 19 + TypeScript, byggt med Vite (statisk build) |
| API och serverlogik | PHP 8.1+ (ingen composer, inga externa beroenden) |
| Redaktionellt innehåll (inkl. kartpunkter/-områden) | JSON-filer i `data/`, en fil per post |
| Konton, sessioner, meddelanden, vittnesmål | SQLite via PDO (`database/app.sqlite`) |
| Uppladdningar | Filsystem (`uploads/`) |

## Struktur

```
├── src/            React-källkod, kopierad från NCC-Draft-RS (components/, pages/, lib/)
│                   + src/api/client.ts (fetch-wrapper mot PHP-API:t)
├── dist/           Byggd React-app → laddas upp till webroot
├── server/         PHP: front controller (index.php), lib/, api/
├── data/           JSON-innehåll + revisions/
├── uploads/        Dokument och bilder
├── database/       SQLite (app.sqlite, skapas av scripts/install.php)
└── tests/          PHP-tester
```

## Status

Se [MIGRATION_PLAN.md](MIGRATION_PLAN.md) för fullständig analys, mappning från
Appwrite och fasordning.

Hela React-appen (publik sida, adminpanel, intranät — oförändrat utseende och
oförändrade funktioner jämfört med NCC-Draft-RS) kör mot PHP-API:t:
autentisering (sessioner, CSRF, rate limiting), redaktionellt innehåll (sidor,
nyheter, ämnen, FAQ, dokument, media, karta, tidslinje, meny, sponsorer,
ändringslogg) via en generisk JSON-kollektionsmotor, användarhantering och
konton i SQLite, kontaktformulär och vittnesmål (publik inskickning +
admingranskning), filuppladdning, och intranätets anteckningar/uppgifter/
notiser. Ingen Appwrite-, Vercel- eller Node-serverkod kvar i klienten.

`scripts/import-appwrite-data.php` importerar riktigt innehåll, konton och filer
direkt från en levande Appwrite-installation (körd och verifierad mot
produktionsdatan). Kvarstår: audit log-skrivning, och verifiering på ett
riktigt PHP-webbhotell. Se MIGRATION_PLAN.md för detaljer.

## Utveckling

```bash
# PHP-API lokalt (kräver PHP 8.1+)
php scripts/install.php   # skapar database/app.sqlite + första admin (en gång)
php -S 127.0.0.1:8123 server/index.php

# Testa
curl http://127.0.0.1:8123/api/data/pages
curl http://127.0.0.1:8123/api/data/pages/bakgrund

# PHP-tester
php tests/json_store_test.php
php tests/json_collection_test.php
php tests/auth_test.php
```

React-appen körs som vanligt med `npm run dev`. `/api` finns inte i Vite-devservern
(bara PHP-servern), så peka om anrop dit med `API_PROXY=http://127.0.0.1:8123` i
`.env.local` (se `vite.config.ts`).

## Testa mot riktig Apache (XAMPP)

`php -S` (ovan) läser aldrig `.htaccess` — vissa buggar (felaktiga
omskrivningsregler, `mod_rewrite`-beteende) syns bara mot en riktig
webbserver. Med XAMPP installerat:

```bash
npm run build
powershell -ExecutionPolicy Bypass -File scripts\deploy-to-xampp.ps1
```

Synkar en färdigbyggd kopia till `C:\xampp\htdocs\rogleskogen` (annan mapp med
`-Target`). Rör aldrig `data/`, `database/` eller `uploads/` om de redan finns
i målet — kör igen efter varje `npm run build` för att uppdatera frontend/PHP
utan att röra din testdata.

Lägg till en egen VirtualHost så appen körs från roten (annars blir `/api`-sökvägen
fel eftersom appen förutsätter att den ligger på domänens rot, inte i en
undermapp av `htdocs`) — i `apache/conf/extra/httpd-vhosts.conf`:

```apache
Listen 8081
<VirtualHost *:8081>
    DocumentRoot "C:/xampp/htdocs/rogleskogen"
    ServerName localhost
    <Directory "C:/xampp/htdocs/rogleskogen">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

(`Listen 8081` läggs i `httpd.conf` om porten inte redan lyssnas på.) Starta om
Apache, testa sedan `http://localhost:8081/`.

## Installation på webbhotell

Se [INSTALL.md](INSTALL.md) — manuellt, eller [DEPLOY.md](DEPLOY.md) för
automatisk driftsättning via GitHub Actions (push till `main` → byggs och
laddas upp automatiskt).
