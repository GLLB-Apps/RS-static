-- SQLite-schema för konton, sessioner, meddelanden, vittnesmål och audit log.
-- Allt som kräver transaktion, unikhet eller autentisering ligger här i
-- stället för i JSON-filer (se MIGRATION_PLAN.md, avsnitt 2).
--
-- Körs av scripts/install.php. Inga standardkonton skapas här — det görs
-- interaktivt av installationsskriptet.

PRAGMA foreign_keys = ON;

-- Konton. Slår ihop Appwrites user_roles + profiles + intranet_members till
-- en tabell: `role` styr adminåtkomst (superadmin/redaktor/skribent, NULL =
-- ingen admin), `intranet_member`/`intranet_read_only` styr intranätet
-- oberoende av admin-rollen (paritet med auth.tsx: isMember = isAdmin ||
-- intranet_member; canWriteIntranet = isAdmin || (intranet_member && !read_only)).
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    display_name        TEXT NOT NULL DEFAULT '',
    -- Presentationen från självregistreringen (adminloginens "Skapa konto").
    -- Den som godkänner en väntande ansökan läser den här.
    intro               TEXT NOT NULL DEFAULT '',
    role                TEXT NULL CHECK (role IN ('superadmin', 'redaktor', 'skribent') OR role IS NULL),
    intranet_member     INTEGER NOT NULL DEFAULT 0 CHECK (intranet_member IN (0, 1)),
    intranet_read_only  INTEGER NOT NULL DEFAULT 0 CHECK (intranet_read_only IN (0, 1)),
    -- Vem som gav intranätsåtkomst (e-post) och en fri notering om personen.
    intranet_added_by   TEXT NOT NULL DEFAULT '',
    intranet_note       TEXT NOT NULL DEFAULT '',
    notifications_seen  TEXT NOT NULL DEFAULT '{}',
    notifications_cleared_at TEXT NULL,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

-- Sessioner. Sessions-id:t (slumpmässigt, i en httpOnly-cookie) är INTE
-- samma som CSRF-token: sessions-id autentiserar, CSRF-token skyddar mot
-- cross-site-anrop som skickar med cookien automatiskt.
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token  TEXT NOT NULL,
    ip          TEXT NOT NULL DEFAULT '',
    user_agent  TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Självbetjänad lösenordsåterställning ("glömt lösenord"). token_hash är
-- SHA-256 av den slumpade token som skickas i mejlets länk — bara hashen
-- lagras, så en läckt databas (t.ex. en gammal backup) inte ensam räcker för
-- att återställa någons lösenord. used_at spärrar återanvändning av samma
-- länk. Se server/lib/Auth.php (requestPasswordReset/resetPassword).
CREATE TABLE IF NOT EXISTS password_resets (
    token_hash  TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used_at     TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- Inloggningsförsök, för enkel rate limiting (per e-post + IP).
CREATE TABLE IF NOT EXISTS login_attempts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT NOT NULL,
    ip          TEXT NOT NULL DEFAULT '',
    success     INTEGER NOT NULL CHECK (success IN (0, 1)),
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(email, created_at);

-- Kontaktformulär. Fält matchar src/lib/types.ts ContactMessage exakt, så
-- SqliteCollection kan exponera tabellen rakt av via /api/data/contact_messages.
CREATE TABLE IF NOT EXISTS contact_messages (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL DEFAULT '',
    subject       TEXT NOT NULL DEFAULT '',
    message       TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'handled', 'archived')),
    internal_note TEXT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

-- Vittnesmål (inskick + granskning) och deras kontaktuppgifter, separerade
-- precis som testimonies/testimony_contacts i Appwrite-versionen (kontaktdata
-- är känsligare och har egna läsrättigheter i adminvyn). Fält matchar
-- src/lib/types.ts Testimony / TestimonyContact.
CREATE TABLE IF NOT EXISTS testimonies (
    id                TEXT PRIMARY KEY,
    title             TEXT NULL,
    story             TEXT NOT NULL DEFAULT '',
    author_name       TEXT NULL,
    is_anonymous      INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
    email             TEXT NULL,
    location          TEXT NULL,
    area_usage        TEXT NULL,
    featured_image    TEXT NULL,
    map_lat           REAL NULL,
    map_lng           REAL NULL,
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    consent_publish   INTEGER NOT NULL DEFAULT 0 CHECK (consent_publish IN (0, 1)),
    consent_contact   INTEGER NOT NULL DEFAULT 0 CHECK (consent_contact IN (0, 1)),
    consent_marketing INTEGER NOT NULL DEFAULT 0 CHECK (consent_marketing IN (0, 1)),
    internal_note     TEXT NULL,
    published_at      TEXT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS testimony_contacts (
    id            TEXT PRIMARY KEY,
    testimony_id  TEXT NOT NULL UNIQUE REFERENCES testimonies(id) ON DELETE CASCADE,
    email         TEXT NULL,
    author_name   TEXT NULL,
    internal_note TEXT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

-- Ändringslogg. Skrivs best-effort från adminskrivvägarna (se server/lib/Audit.php).
-- Kolumnnamn matchar AuditLogEntry i src/lib/types.ts (entity_type/entity_id,
-- inte table_name/record_id) — ingen adminvy läser tabellen ännu, men om en
-- läggs till senare ska den kunna göra det rakt av via /api/data/audit_log.
CREATE TABLE IF NOT EXISTS audit_log (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,
    entity_type  TEXT NOT NULL DEFAULT '',
    entity_id    TEXT NOT NULL DEFAULT '',
    details      TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
