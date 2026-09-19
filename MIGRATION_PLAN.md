# Migrationsplan — Rögleskogen: React + Appwrite → React-build + PHP + JSON + SQLite

Fork av `NCC-Stenbrott-Johanna/NCC-Draft-RS`. Målet är en portabel lösning som
kan laddas upp till ett vanligt PHP-webbhotell utan Appwrite, Vercel-funktioner,
Node-server, `.bat`-filer eller cron.

Originalprojektet lämnas orört — detta är en separat mapp.

---

## 1. Analys av nuvarande projekt

### Arkitektur idag
- **Frontend:** React 19 + TypeScript, byggt med Vite. Publik sida + adminpanel + intranät.
- **Backend:** Appwrite Cloud (databas, konton, fillagring). Webbläsaren pratar direkt med Appwrite.
- **Kompatibilitetslager:** `src/lib/supabase.ts` härmar Supabase-klientens API mot Appwrite
  (`supabase.from('x').select().eq()…`). Hela appen går genom detta lager — vilket gör migrationen
  lättare: byt ut lagret, inte varje komponent.
- **Serverfunktioner:** `api/set-user-password.js`, `api/set-access.js`, `api/sync-signatures.js` (Vercel).
- **Signaturskrapa:** `api/sync-signatures.js` + `scripts/sync-signatures.mjs` + `scripts/sync-signatures.bat`
  skrapar Skrivunder.com och skriver `site_settings.signature_count`.

### Appwrite-inventering

**Kollektioner (databas):**

| Kollektion | Innehåll | Mål |
| --- | --- | --- |
| `site_settings` | Namn, hero, kampanjläge, kontakt, texter | `data/settings.json` |
| `pages` | Redigerbara texter + innehållsblock per sida | `data/pages/{slug}.json` |
| `navigation_items` | Meny, nästlade val | `data/navigation.json` |
| `topics` | Ämnesområden (rik text/block) | `data/topics/{slug}.json` + `data/topics.json` (index) |
| `posts` | Nyheter | `data/posts/{slug}.json` + index |
| `faq_categories`, `faq_items` | Frågor & svar | `data/faq.json` |
| `documents` | Dokumentmetadata (publika) | `data/documents.json` + `uploads/documents/` |
| `media_items` | Bild-/videoarkiv | `data/media.json` + `uploads/images/` |
| `map_locations` | Kartpunkter | `data/map.geojson` (Feature: Point) |
| `map_areas` | Områdespolygoner | `data/map.geojson` (Feature: Polygon) |
| `timeline_events` | Tidslinje | `data/timeline.json` |
| `contacts` | Kontaktpersoner | `data/contacts.json` |
| `contact_messages` | Formulärmeddelanden | **SQLite** `messages` |
| `testimonies` | Vittnesmål (inskick + granskning) | **SQLite** `testimonies` (inkl. status) |
| `user_roles` | Admin-roller | **SQLite** `users` (role-kolumn) |
| `profiles` | Visningsnamn | **SQLite** `users` |
| `audit_log` | Ändringslogg | **SQLite** `audit_log` |
| `internal_documents`, `internal_doc_categories` | Intern dokumentbank | `data/internal/*` + `uploads/documents/` (skyddad) |
| `intranet_members` | Intranätsåtkomst | **SQLite** `users` (access-kolumn) |
| `intranet_notes`, `intranet_tasks`, `intranet_notices` | Intranätsinnehåll | `data/intranet/*.json` eller SQLite |

**Buckets:** en `media`-bucket, publik läsning (`read("any")`), admin/medlem skriver.
→ Ersätts av `uploads/` på filsystemet.

**Autentisering:** Appwrite-konton + e-post/lösenord-session. Behörighet via kontots **label**
(`admin` / `member`) + `user_roles`-rad. `isAdmin` = user_roles-rad finns; `isMember` = admin eller
`intranet_members`-rad.
→ Ersätts av PHP-sessioner + SQLite (`password_hash`/`password_verify`), roll- och access-kolumner.

**Permissions (Appwrite):** kollektionsnivå. Publikt innehåll `read("any")`; skrivning `label:admin`
(+ `label:member` för intranät). Känsligt (meddelanden-läsning, vittnesmål/kontakt-skrivning, audit)
låst till `label:admin`.
→ Ersätts av PHP-behörighetskontroll per endpoint (publik läsning, admin/medlem för skrivning).

### Var React läser/skriver
Allt går via `src/lib/supabase.ts`:
- **Publik läsning:** `PublicLayout` (site_settings), `usePage` (pages), `HomePage`, `MapPage`,
  `DocumentsPage`, `FaqPage`, `NewsPage`, `TopicsPage`, `TimelinePage`, `MediaPage`, `PressPage`, `ContactPage`.
- **Publik skrivning:** `ContactPage` (contact_messages), `TestimoniesPage` (testimonies).
- **Admin läsning/skrivning:** alla `src/pages/admin/*`.
- **Auth:** `src/lib/auth.tsx` via `supabase.auth.*`.

### Signaturmekanismen (ska ersättas)
`api/sync-signatures.js` hämtar Skrivunder-HTML (browser-User-Agent, ev. ScraperAPI-proxy pga
Cloudflare), matchar `class="…signatureAmount…">NNN<` och skriver `site_settings.signature_count`.
Kördes dagligen via Vercel-cron och `scripts/sync-signatures.bat` (lokal dator).
→ Ersätts av PHP-endpoint `POST /api/admin/signatures/refresh` (manuell), som skriver
`data/signatures.json`. Publika sidan läser `GET /api/signatures`. Ingen `.bat`, ingen cron.

---

## 2. Målarkitektur

- **React-build** (statisk) i webroot (`dist/` → `public_html`).
- **PHP 8.1+** front controller under `server/`, routar `/api/*`.
- **JSON** för redaktionellt innehåll (`data/`), en fil per post (`data/{tabell}/{id}.json`),
  revisioner i `data/revisions/`. En generisk motor (`JsonCollection` + `RowFilter`, se
  `server/api/data.php`) täcker alla dessa tabeller med samma eq/order/limit/ilike/gte/lte-filter
  som klientens gamla Appwrite-`QueryBuilder` uttryckte — i stället för en controller per typ.
- **Kartobjekt** (`map_locations`, `map_areas`) landade som vanliga `JsonCollection`-tabeller i
  stället för ett separat `data/map.geojson` — enklare, och identiskt admin-beteende. GeoJSON-export
  kan läggas till senare som ett tillval om det behövs för externa GIS-verktyg.
- **SQLite** (`database/app.sqlite`, PDO) för användare/sessioner (`Auth`, `UserCollections` —
  `user_roles`/`intranet_members`/`profiles` är vyer ovanpå en enda `users`-tabell), meddelanden och
  vittnesmål (`SqliteCollection`, samma DataCollection-gränssnitt som JSON-tabellerna, fast med en
  kolumn-vitlista per tabell mot SQL-injektion).
- **Filsystem** för uppladdningar (`uploads/`, via `server/api/uploads.php`).
- Känsliga mappar (`data/`, `database/`, `server/`, `uploads/documents`) utanför webroot där möjligt,
  annars skyddade med `.htaccess`.

### API-svarsformat (genomgående)
```json
{ "success": true,  "data": { }, "error": null }
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

---

## 3. Fasordning och status

| # | Steg | Status |
| --- | --- | --- |
| 1 | Inventera Appwrite + datamodeller | ✅ (detta dokument) |
| 2 | Migrationsplan + målstruktur | ✅ |
| 3 | PHP-bootstrap, config, gemensamma API-svar | ✅ |
| 4 | Säkra JSON-funktioner (lås, atomiskt, revision, validering) | ✅ |
| 5 | SQLite + autentisering (sessioner, CSRF, rate limit) | ✅ |
| 6 | Ersätt Appwrite-läsning för publika sidor | ✅ |
| 7 | Ersätt Appwrite-skrivning i admin | ✅ (generisk motor, se §2) |
| 8 | Migrera menyer, FAQ, sidblock | ✅ |
| 9 | Migrera dokumentbanken | ✅ (publika dokument + intranätets `internal_documents`/`internal_doc_categories`) |
| 10 | Migrera kartdata | ✅ (som JsonCollection, se §2) |
| 11 | Ersätt `.bat`-skrapning med manuell PHP-uppdatering | ✅ (`GET /api/sync-signatures`, se `server/api/signatures.php`) |
| 12 | Revisionshistorik + audit log | 🟡 (revision klar, `audit_log`-tabell finns men skrivs inte än) |
| 13 | Ta bort kvarvarande Appwrite-beroenden | ✅ (grep efter `appwrite`/`VITE_APPWRITE` ger inga träffar i kod) |
| 14 | Produktionsbuild + installationsdokumentation | 🟡 (`npm run build` grönt; INSTALL.md uppdaterad för steg 5–6; overifierad på riktigt webbhotell) |
| 15 | Verifiera på PHP-webbhotell | 🟡 verifierad lokalt mot riktig Apache (XAMPP), inte ett riktigt webbhotell än |

**Detta lager:** React-appen (hela `src/` från NCC-Draft-RS, admin/publikt/intranät oförändrat i
utseende) kör mot PHP-API:t. Verifierat end-to-end med `php -S` + curl (alla endpoints, CSRF,
statusgrindar, rate limiting, publika skrivningar för kontakt/vittnesmål) och en riktig
Chromium-webbläsare via Playwright: publik startsida/kontakt/vittnesmål/karta läser och skriver mot
API:t, adminlogin fungerar, ett ämne skapades och syntes i listan, kontaktmeddelandet syntes i
adminvyn, och intranätets anslagstavla/dokument/anteckningar/uppgifter laddade — noll nätverksfel.
`npm run build` (tsc + vite) är grönt.

En verifieringsrunda hittade att en trasig JSON-body (ogiltig UTF-8) tystnade till en tom `[]`
i stället för ett fel (`Request::json()`), vilket kunde skapa en nästan tom post utan felsignal —
fixat: en icke-tom body som inte går att avkoda avvisas nu med `VALIDATION_ERROR` (400).

**Verifierat mot riktig Apache (XAMPP), inte bara `php -S`** — `php -S` läser aldrig `.htaccess`
alls, så två allvarliga buggar syntes först här, båda fixade i den här leveransen:

1. **`/api` fungerade inte alls under riktig Apache.** Root-`.htaccess`s
   `RedirectMatch 404 ^/(data|database|server|tests)(/|$)` matchar (en Apache-egenhet) inte bara
   direkta webbläsaranrop mot `/server/...`, utan även den INTERNA omskrivningen `/api` →
   `server/index.php` — regeln stängde alltså av hela API:t. `server` togs bort ur mönstret;
   `server/.htaccess` skyddar redan katalogen mer precist (nekar allt utom `index.php`, som ändå
   ska vara nåbar). `data`/`database`/`tests` kvar som de var.
2. **En tom miljövariabel i `.env` (t.ex. `DATA_DIR=`) vann över standardvärdet i stället för att
   falla tillbaka på det**, tvärt emot vad `.env.example` lovar ("Lämnas de tomma används
   projektets egna mappar"). `config.php`s `.env`-inläsning satte `putenv()` även för tomma värden,
   vilket fick `env_str()` att returnera `''` i stället för defaulten — kraschade `Db::get()`
   (`mkdir(): Invalid path`) så fort `.env` fanns med tomma rader, vilket är precis hur
   `.env.example` instruerar att lämna oanvända inställningar. Fixat: tomma rader sätter inte
   längre `putenv()`.

Test-setup: `scripts/deploy-to-xampp.ps1` (nytt) synkar `dist/` + `.htaccess` + `server/` till en
lokal XAMPP-webroot (rör aldrig `data/database/uploads` om de redan finns där) och en egen
VirtualHost på en egen port så appen körs från roten — precis som på en riktig domän, i stället för
i en undermapp av `htdocs` (som annars ger fel `/api`-sökväg, ett separat problem från de två ovan).
Efter fixarna: hela flödet (publik sida med riktigt importerat innehåll, inloggning med ett riktigt
importerat konto, adminpanelen) verifierat via Chromium mot `http://localhost:8081/` med noll fel.

**`scripts/import-appwrite-data.php`** kör nu klart: kopplar direkt mot den levande
Appwrite-installationen (samma `.env.local` som NCC-Draft-RS), importerar samtliga
27 kollektioner + Appwrite Users + hela Storage-bucketen (70 filer, URL:er omskrivna
rekursivt oavsett nästling). Körd mot produktionsdatan 2026-09-17: alla kollektioner
importerade med exakt matchande antal mot källan (topics=9, posts=14, media_items=39,
changelog_entries=47, m.fl.), 8 konton sammanfogade (ett — ägarens egna, matchat på
e-post — fick sin roll uppdaterad utan att röra lösenordet; 7 nya fick slumpade
lösenord i `import/generated-passwords.txt`). Verifierat i webbläsare efteråt: riktiga
ämnen/nyheter/dokument/media renderas, riktiga adminräknare (utkast, meddelanden,
vittnesmål) stämmer, inloggning med ett importerat konto fungerar. Två 403-fel mot
`fbcdn.net` observerades — ett externt Facebook-hotlänkat foto som Facebook själva
blockerar, opåverkat av migrationen.

Under importen hittades och fixades två skrivbuggar som annars bara syns med riktig
data: `JsonCollection`/`SqliteCollection` stämplade alltid `updated_at` till importtillfället
i stället för att respektera ett redan angivet värde (förstörde historiken vid en
dataåterställning), och `SqliteCollection` kunde krascha mot ett NOT NULL-villkor när
ett bool-attribut saknades i källan (Appwrite-attribut kan vara ounset) — nollställs nu
till 0 i stället.

**Kvarstår innan produktion:**
- `audit_log`-skrivning från adminvägarna (tabellen finns i SQLite; RS skrev heller inte aktivt till
  motsvarande Appwrite-kollektion, så ingen regression — men värt att lägga till här).
- Verifiering på ett riktigt PHP-webbhotell (steg 15) — hittills bara `php -S` lokalt.
- `internal_documents` delar samma publika uppladdningsendpoint (`/api/uploads`) som allt annat —
  precis som i originalets Appwrite-bucket (en gissningssäker filnamn är hela skyddet). Genuin
  åtkomstkontroll på fil-nivå (lagring utanför webroot + autentiserad nedladdning) vore en
  förbättring utöver paritet, inte en regression mot nuvarande beteende.

---

## 4. React-integration

**Reviderat från den ursprungliga planen** (som föreslog ett separat `src/api/{pages,documents,
auth,signatures}.ts` per resurs): i stället byttes bara *insidan* av `src/lib/supabase.ts` —
Appwrite-SDK:t ersattes med `apiFetch()`/`apiUpload()` (i `src/api/client.ts`, den enda nya
API-filen) mot `/api/data/{table}` m.fl., men den **publika ytan är identisk**
(`supabase.from(table).select().eq()...`, `supabase.auth.*`). Det innebar att i stort sett ingen av
de ~30 adminsidorna eller de publika sidorna behövde ändras alls — bara `supabase.ts` själv, plus en
handfull ställen som pratade direkt med de gamla Vercel-funktionerna
(`AdminAdmins.tsx`, `ChangelogImport.tsx`, `src/lib/storage.ts`) och nu använder
`apiFetch`/`apiUpload` direkt. Enklare att underhålla än en controller/klientfil per resurs, och
lägre risk eftersom komponenterna rördes minimalt — precis den ursprungliga tanken, fast genomförd
som ett enda kompatibilitetslager i stället för flera typade klienter.

---

## 5. Migrering av befintlig Appwrite-data

`scripts/import-appwrite-data.php` (skapas i steg 8–10) läser en Appwrite-export (JSON) och skapar
sid-, meny-, FAQ-, dokument- och kartfiler. Mappar gamla `$id` → nya id/slug. Skriver inte över
befintliga filer utan `--force`. Rapporterar poster som inte kunde migreras.

Saknas export skapas ändå strukturen; exporten placeras i `import/appwrite-export.json` och körs manuellt.

---

## 6. Kända risker / TODO

- **Tomma kartor i JSON round-trip:** PHP kan inte skilja `{}` från `[]` efter
  `json_decode(..., true)`. En tom `texts: {}` som läses och skrivs tillbaka av
  `JsonStore` blir `texts: []` i filen. API:t normaliserar på utgående svar
  (`(object)`-cast i `PagesController`), så klientkontraktet är korrekt — men när
  **skrivning** av sidor byggs (steg 7) måste samma normalisering ske före
  lagring, annars driver filerna. Åtgärd: en `PageSchema::normalize()` som
  används av både läs- och skrivvägen. Upptäcktes av `tests/json_store_test.php`.
- **Auth-paritet:** Appwrites label-modell (admin/member) måste återskapas exakt i SQLite så att
  behörighetsgränserna blir desamma (publik läsning, admin/medlem-skrivning).
- **Intranätets konfidentialitet:** interna dokument-filer måste ligga skyddat (utanför webroot /
  `.htaccess`), och nedladdning gå via autentiserad PHP-endpoint — inte direkt fil-URL.
- **Skrapning:** Skrivunder skyddas av Cloudflare; en direkt PHP-`fetch` från webbhotellet kan 403:a.
  Fallback: behåll senaste kända värde, tydlig felstatus, manuell inmatning som reserv.
- **Rik text/XSS:** om CMS:et tillåter HTML måste det saneras server-side före lagring och renderas säkert.
