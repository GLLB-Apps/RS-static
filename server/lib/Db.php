<?php
declare(strict_types=1);

// PDO-anslutning till SQLite. En process-global instans (PHP:s
// delad-ingenting-modell gör "singleton" till bara "spara i en statisk
// variabel") så varje request öppnar databasen en gång.
final class Db
{
    private static ?PDO $instance = null;

    public static function get(string $path): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Kunde inte skapa databaskatalog: ' . $dir);
        }

        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        // WAL: bättre samtidighet mellan PHP-processer (webbservern kör flera).
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        self::migrate($pdo);

        self::$instance = $pdo;
        return $pdo;
    }

    /**
     * Lättviktig migrering för databaser som skapades innan en tabell fanns i
     * database/schema.sql (ingen migreringsmotor i det här projektet — bara
     * `scripts/install.php` kör hela schemat, en gång, vid en färsk
     * installation). Allt här måste vara idempotent (CREATE TABLE/INDEX IF
     * NOT EXISTS) och billigt nog att köras på varje anslutning.
     */
    private static function migrate(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS password_resets (
                token_hash  TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at  TEXT NOT NULL,
                expires_at  TEXT NOT NULL,
                used_at     TEXT NULL
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)');
    }
}
