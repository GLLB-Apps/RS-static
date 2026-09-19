# Installation

> Delar av installationen förutsätter funktioner som byggs i senare faser
> (SQLite-init, första administratören, Appwrite-import). De stegen är markerade
> **[kommer]** och beskrivs här så att dokumentationen är komplett från början.

## 1. Krav

- **PHP 8.1 eller senare**
- PHP-extensions: `json`, `pdo_sqlite`, `mbstring`, `fileinfo`, `dom` (för signaturhämtning), `openssl`
- Apache med `mod_rewrite` (eller motsvarande omskrivningsregler i Nginx/LiteSpeed)
- Skrivrättigheter för webbserveranvändaren på `data/`, `uploads/`, `database/`
- Node 20.19+ **endast för att bygga** React-appen lokalt — behövs inte på servern

Kontrollera version på servern:
```bash
php -v
php -m | grep -E 'pdo_sqlite|mbstring|fileinfo|dom'
```

## 2. Bygg React-appen

```bash
npm install
npm run build      # skapar dist/
```

Ligger API:t på samma domän behövs ingen konfiguration (klienten använder `/api`).
Annars sätts `VITE_API_BASE` före bygget.

## 3. Ladda upp

| Lokalt | På servern | Kommentar |
| --- | --- | --- |
| `dist/*` | `public_html/` | React-appen (inkl. `index.html`) |
| `.htaccess` | `public_html/.htaccess` | Routing: `/api` → PHP, SPA-fallback |
| `server/` | `public_html/server/` | PHP-koden |
| `data/` | **utanför** webroot om möjligt | Redaktionellt innehåll |
| `uploads/` | `public_html/uploads/` | Bilder måste kunna serveras |
| `database/` | **utanför** webroot om möjligt | SQLite |
| `.env.example` | `.env` (ifylld) | Aldrig i git |

Ligger `data/` och `database/` utanför webroot: peka dit med `DATA_DIR` och
`DB_PATH` i `.env`. Går det inte skyddas de av medföljande `.htaccess`-filer.

## 4. Rättigheter

```bash
chmod -R 775 data uploads database
```

Webbservern måste kunna skriva i alla tre. `data/revisions/` skapas automatiskt.

## 5. Initiera databasen

```bash
php scripts/install.php
```

Skapar `database/app.sqlite` med tabeller för användare, sessioner,
meddelanden, vittnesmål, audit log och inloggningsförsök (`database/schema.sql`).
Skriptet vägrar köra igen efter slutförd installation utan uttrycklig
återställning (`--reset`, kräver att man skriver "RESET" för att bekräfta),
så att en ominstallation inte kan skriva över befintliga konton.

## 6. Skapa första administratören

Ingår i `scripts/install.php`: e-post, lösenord (minst 10 tecken) och namn
anges interaktivt (eller via miljövariablerna `INSTALL_ADMIN_EMAIL` /
`INSTALL_ADMIN_PASSWORD` / `INSTALL_ADMIN_NAME` för icke-interaktiv körning).
Lösenordet lagras med `password_hash()`. Inga standardlösenord i koden.
Kontot får rollen `superadmin` och full intranätsåtkomst.

## 7. Ange Skrivunder-URL

I `data/settings.json`:
```json
{ "petition": { "enabled": true, "url": "https://www.skrivunder.com/EXAKT_SLUG_HAR" } }
```
eller via `PETITION_URL` i `.env`.

Uppdatering sker manuellt från adminpanelen (**Uppdatera antal underskrifter**).
Ingen cron i denna version.

## 8. E-post (kontaktformulär, nya lösenord)

Ingen extern tjänst krävs — PHP:s inbyggda `mail()` används som standard, och
fungerar normalt direkt på ett delat webbhotell (t.ex. Inleed) eftersom
värden redan konfigurerat servern att skicka från kontots domän. Sätt en
riktig avsändaradress på er egen domän i `.env`:

```
MAIL_FROM_ADDRESS=no-reply@raddarogleskogen.se
MAIL_FROM_NAME=Rädda Rögleskogen
```

Testa genom att skicka via kontaktformuläret (kräver `contact_delivery` satt
till `email` eller `both` i Inställningar) eller "Skicka nytt via mejl" under
Användare. Kommer inte mejlet fram: kontrollera värdens
skräppostfilter/domänautentisering (SPF/DKIM) — de flesta webbhotell sätter
upp det automatiskt för sin egen domän, men en avsändaradress på en *annan*
domän (t.ex. `@gmail.com`) hamnar ofta i skräppost eller nekas helt, eftersom
webbhotellets server inte får skicka som avsändare för Gmails domän.

Har ni redan ett [Resend](https://resend.com)-konto, eller vill ha
leveransstatistik, sätt `RESEND_API_KEY` i `.env` så används det i stället —
annars kan raden lämnas tom.

## 9. Importera Appwrite-data

Kopplar direkt mot den *levande* Appwrite Cloud-installationen (inte en manuell
export-fil) via samma `.env.local` som `NCC-Draft-RS` redan använder, och
skriver innehåll, konton och filer rakt in i den här installationen.

```bash
php scripts/import-appwrite-data.php
# eller peka på en annan .env-fil:
php scripts/import-appwrite-data.php --env=/sökväg/till/.env.local
```

Skriver inte över befintliga poster utan `--force`. `--skip-files` hoppar över
filnedladdning (snabbare vid omkörning). `--only=topics,posts,...` begränsar
till valda tabeller.

Riktiga lösenord går aldrig att hämta ut ur Appwrite (ingen auth-tjänst
exponerar dem). Konton som inte redan finns lokalt (matchat på e-post) skapas
med ett nytt slumpat lösenord, sparat i `import/generated-passwords.txt`
(git-ignorerad, innehåller persondata — radera filen när lösenorden är
utdelade). Ett konto som redan finns lokalt (t.ex. skapat av
`scripts/install.php`) får sin roll/profil uppdaterad men **behåller sitt
befintliga lösenord**.

Appwrite Storage-filer laddas ner till `uploads/images` eller
`uploads/documents`, och varje URL som pekar på en Appwrite-fil skrivs om till
den nya lokala sökvägen — oavsett hur djupt nästlad den är i innehållet (t.ex.
en bild inuti ett content-block).

## 10. Backup

Säkerhetskopiera dessa tre:
```bash
tar czf backup-$(date +%F).tar.gz data uploads database
```
`data/` är innehållet, `uploads/` filerna, `database/` konton och meddelanden.
`data/revisions/` innehåller tidigare versioner av allt redigerat innehåll.

## 11. Flytta till ett annat webbhotell

1. Kopiera `data/`, `uploads/`, `database/` och `.env`.
2. Ladda upp `dist/`, `server/` och `.htaccess` som ovan.
3. Justera `DATA_DIR`, `UPLOADS_DIR`, `DB_PATH` i `.env` efter nya sökvägar.
4. Sätt om rättigheter enligt steg 4.

Inget är låst till en specifik leverantör — ingen extern databas, inga
molnfunktioner.

## Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| API svarar med HTML i stället för JSON | `.htaccess` skriver inte om `/api` → kontrollera `mod_rewrite` |
| 500 på alla API-anrop | Fel sökväg i `DATA_DIR`/`DB_PATH`, eller saknad skrivrättighet |
| React visar tom sida vid direktlänk | SPA-fallbacken saknas i `.htaccess` |
| Uppladdning misslyckas | `upload_max_filesize`/`post_max_size` i PHP, eller rättigheter på `uploads/` |
