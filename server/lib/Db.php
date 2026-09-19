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

        self::$instance = $pdo;
        return $pdo;
    }
}
