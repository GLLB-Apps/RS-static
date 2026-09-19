<?php
declare(strict_types=1);

// Central konfiguration. Läser miljövariabler (satta av webbhotellet eller en
// lokal, git-ignorerad .env) och faller tillbaka på säkra standardvärden.
// Inga hemligheter i koden — de kommer från miljön.

// --- ladda .env om den finns (endast enkla KEY=VALUE-rader) --------------------
$envFile = dirname(__DIR__) . '/.env';
if (is_readable($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        $k = trim($k);
        $v = trim($v);
        // En tom rad (t.ex. "DATA_DIR=") ska falla tillbaka på standardvärdet
        // (se .env.example: "Lämnas de tomma används projektets egna mappar")
        // — sätts den ändå till en tom sträng här vinner den framför defaulten
        // i env_str(), eftersom getenv() då returnerar '' i stället för false.
        if ($k !== '' && $v !== '' && getenv($k) === false) {
            putenv("$k=$v");
            $_ENV[$k] = $v;
        }
    }
}

function env_str(string $key, string $default = ''): string
{
    $v = getenv($key);
    return $v === false ? $default : $v;
}

$root = dirname(__DIR__);
$appEnv = env_str('APP_ENV', 'production');

return [
    'env'         => $appEnv,
    'is_dev'      => $appEnv !== 'production',
    // Rot för applikationen (en nivå upp från server/).
    'root_dir'    => $root,
    // Känsliga kataloger. Kan pekas om utanför webroot via miljövariabler.
    'data_dir'    => env_str('DATA_DIR', $root . '/data'),
    'uploads_dir' => env_str('UPLOADS_DIR', $root . '/uploads'),
    'db_path'     => env_str('DB_PATH', $root . '/database/app.sqlite'),
    // API-prefix i URL:en.
    'api_prefix'  => '/api',
    // Tillåtna origins för CORS (tom = samma origin, vilket är normalfallet på webbhotell).
    'cors_origins' => array_values(array_filter(array_map('trim', explode(',', env_str('CORS_ORIGINS', ''))))),
    // Skrivunder-namninsamlingens publika URL (kan även ligga i data/settings.json).
    'petition_url' => env_str('PETITION_URL', ''),
    // Valfri: AI-översättning av commit-rubriker i ändringsloggens GitHub-import.
    // Tomt = rubrikerna importeras oöversatta, inget fel.
    'anthropic_api_key' => env_str('ANTHROPIC_API_KEY', ''),
    // E-postutskick (kontaktformulär, "skicka nytt lösenord"). Standard är
    // PHP:s inbyggda mail() — fungerar direkt på ett vanligt webbhotell (t.ex.
    // Inleed) utan någon extern tjänst. Sätts RESEND_API_KEY används Resend
    // i stället (se server/lib/Mailer.php).
    'resend_api_key'   => env_str('RESEND_API_KEY', ''),
    // Avsändaradress för systemutskick. Sätt till en riktig adress på er egen
    // domän (t.ex. no-reply@raddarogleskogen.se) — annars faller den tillbaka
    // på webbhotellets domännamn, vilket sällan är rätt permanent lösning.
    'mail_from_address' => env_str('MAIL_FROM_ADDRESS', 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost')),
    'mail_from_name'    => env_str('MAIL_FROM_NAME', ''),
];
