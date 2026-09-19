# Automatisk driftsättning (GitHub Actions)

Ett alternativ till att bygga och FTP:a för hand vid varje ändring (se
INSTALL.md). Push till `main` → GitHub bygger React-appen och laddar upp kod
+ bygge till webbhotellet automatiskt. **Rör aldrig** `data/`, `database/`
eller `uploads/` — de finns inte ens med i det som laddas upp (se
`.github/workflows/deploy.yml`), så riktigt innehåll, konton och filer på
servern kan inte skrivas över eller raderas av ett push.

## Krav på webbhotellet

FTP eller FTPS-åtkomst (användarnamn, lösenord, värdnamn). **Inte** SFTP —
det stödjer inte den GitHub Action som används här. Har ni bara SFTP, säg
till så byter jag ut deploysteget mot en SFTP-variant.

De flesta webbhotell (t.ex. Inleed) visar de här uppgifterna under
"FTP-konton" eller motsvarande i kontrollpanelen.

## Engångsinställning

Fyra hemligheter läggs in på GitHub — **aldrig i koden, aldrig i den här
chatten**. Så här:

1. Öppna repot på github.com → **Settings** → **Secrets and variables** →
   **Actions**.
2. Under fliken **Secrets**, klicka **New repository secret** och lägg in,
   en i taget:

   | Namn | Värde |
   | --- | --- |
   | `FTP_SERVER` | Värdnamnet till FTP-servern, t.ex. `ftp.er-domän.se` |
   | `FTP_USERNAME` | FTP-användarnamnet |
   | `FTP_PASSWORD` | FTP-lösenordet |
   | `FTP_SERVER_DIR` | Målmappen på servern, **måste sluta med `/`** — t.ex. `public_html/` |

3. Stödjer webbhotellet inte FTPS (bara vanlig FTP)? Under fliken
   **Variables** i samma vy, lägg till en variabel `FTP_PROTOCOL` med värdet
   `ftp`. Annars används `ftps` (krypterat) som standard — lämna den
   ospecificerad om ni inte vet, de flesta moderna webbhotell stödjer det.

4. Klart. Nästa push till `main` (eller **Actions**-fliken → välj workflowen
   → **Run workflow** för att köra utan en ny commit) bygger och laddar upp.

## Första gången — i vilken ordning

Den här pipelinen laddar bara upp **kod**: `dist/` (byggd frontend),
`server/` och `.htaccess`. Den förutsätter att `data/`, `database/app.sqlite`
och `uploads/` redan finns på servern — annars gör den inte det åt er.

- **Har ni redan ett färdigt system lokalt** (er nuvarande situation): FTP:a
  över era riktiga `data/`, `database/` och `uploads/` för hand *en gång*
  (se INSTALL.md, steg 3), sätt upp hemligheterna ovan, och låt pipelinen
  sköta kod-uppdateringar därefter. Besök `install/migrate.php` en gång
  efter den allra första uppladdningen (se INSTALL.md).
- **Helt tomt webbhotellkonto**: låt pipelinen lägga upp koden först (push
  till main), ladda sedan upp `install/`-mappen för hand en gång och besök
  `install/index.php` för att skapa databasen och första kontot.

## Felsökning

| Symptom | Trolig orsak |
| --- | --- |
| Workflowen misslyckas på FTP-steget | Fel värde i någon av de fyra hemligheterna, eller fel protokoll (`ftp`/`ftps`) |
| "530 Login incorrect" | Fel användarnamn/lösenord, eller kontot kräver SFTP i stället |
| Sidan uppdateras inte trots lyckad körning | `FTP_SERVER_DIR` pekar på fel mapp — kontrollera att den matchar webbhotellets faktiska webroot |
| Riktigt innehåll försvann efter ett push | Ska inte kunna hända (`data`/`database`/`uploads` laddas aldrig upp av den här pipelinen) — hör av er om det ändå inträffar |
