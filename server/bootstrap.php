<?php
declare(strict_types=1);

// Gemensam uppstart för alla API-anrop: laddar konfiguration och bibliotek,
// sätter felhantering (inga stack traces i produktion) och exponerar $config.

$config = require __DIR__ . '/config.php';

// Bibliotek (ingen composer — enkla require:s håller det portabelt).
require __DIR__ . '/lib/Response.php';
require __DIR__ . '/lib/Request.php';
require __DIR__ . '/lib/Router.php';
require __DIR__ . '/lib/JsonStore.php';
require __DIR__ . '/lib/JsonCollection.php';
require __DIR__ . '/lib/RowFilter.php';
require __DIR__ . '/lib/Db.php';
require __DIR__ . '/lib/SqliteCollection.php';
require __DIR__ . '/lib/UserCollections.php';
require __DIR__ . '/lib/Auth.php';
require __DIR__ . '/lib/Audit.php';
require __DIR__ . '/lib/Mailer.php';

// Fel ska aldrig läcka ut som HTML/stack trace till klienten i produktion.
error_reporting(E_ALL);
ini_set('display_errors', $config['is_dev'] ? '1' : '0');

set_exception_handler(static function (\Throwable $e) use ($config): void {
    error_log('[api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error(
        'INTERNAL_ERROR',
        $config['is_dev'] ? $e->getMessage() : 'Ett internt fel inträffade.',
        500,
    );
});

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new \ErrorException($message, 0, $severity, $file, $line);
});

// Enkel, restriktiv CORS. Standard: samma origin (inga headers). Om origins
// konfigurerats och matchar begäran, tillåt just den.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['cors_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Front controllern hämtar konfigurationen härifrån.
return $config;
