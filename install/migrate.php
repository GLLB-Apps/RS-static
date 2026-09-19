<?php
declare(strict_types=1);

// Efterkontroll efter en FTP-uppladdning av ett system som redan är färdigt
// lokalt — riktigt innehåll, riktiga konton. Till skillnad från index.php
// (som är till för ett HELT TOMT webbhotellkonto och skapar ett nytt
// superadmin-konto) skapar den här ingenting och rör aldrig databasen eller
// innehållet. Den kan bara:
//
//   1. Kontrollera att allt faktiskt kom med i uppladdningen (räkna rader/
//      filer) och att PHP-miljön duger, samt försöka rätta skrivrättigheter.
//   2. Säkerställa att .env är redo för skarp drift — framför allt att
//      APP_ENV verkligen är "production" (annars läcker felmeddelanden med
//      sökvägar och stack traces till besökare).
//   3. Radera install/-mappen när ni är klara, samma knapp som index.php.
//
// Går att köra flera gånger (t.ex. för att kontrollera igen efter att ha
// rättat något) — ingen spärr mot omkörning, eftersom den aldrig skapar
// eller ändrar konton.

session_start();

$root = dirname(__DIR__);
require $root . '/server/lib/Db.php';
require __DIR__ . '/_shared.php';

$eyebrow = 'Rögleskogen — efter FTP-uppladdning (befintlig sajt)';

if (empty($_SESSION['install_token'])) {
    $_SESSION['install_token'] = bin2hex(random_bytes(16));
}
$token = $_SESSION['install_token'];
$tokenOk = ($_POST['token'] ?? '') === $token || $_SERVER['REQUEST_METHOD'] !== 'POST';

if (isset($_POST['self_destruct']) && $tokenOk) {
    selfDestructInstallDir();
}

/** @return array<int,array{label:string,count:int,warn:bool}> */
function contentCounts(string $root): array
{
    $countFiles = function (string $dir): int {
        if (!is_dir($dir)) {
            return 0;
        }
        $n = 0;
        foreach (scandir($dir) ?: [] as $f) {
            if ($f !== '.' && $f !== '..' && is_file($dir . '/' . $f)) {
                $n++;
            }
        }
        return $n;
    };

    $usersCount = 0;
    $adminCount = 0;
    $dbPath = $root . '/database/app.sqlite';
    if (is_file($dbPath)) {
        try {
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            if ($pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetch()) {
                $usersCount = (int) $pdo->query('SELECT COUNT(*) AS n FROM users')->fetch()['n'];
                $adminCount = (int) $pdo->query("SELECT COUNT(*) AS n FROM users WHERE role IS NOT NULL")->fetch()['n'];
            }
        } catch (Throwable) {
            // Räknas som 0 nedan — visas som en varning, inte ett hårt fel.
        }
    }

    $dataDirs = 0;
    $dataFiles = 0;
    if (is_dir($root . '/data')) {
        foreach (scandir($root . '/data') ?: [] as $f) {
            $path = $root . '/data/' . $f;
            if ($f === '.' || $f === '..' || $f === 'revisions' || !is_dir($path)) {
                continue;
            }
            $dataDirs++;
            $dataFiles += $countFiles($path);
        }
    }

    return [
        ['label' => 'Konton i databasen', 'count' => $usersCount, 'warn' => $usersCount === 0],
        ['label' => 'Med adminroll', 'count' => $adminCount, 'warn' => false],
        ['label' => 'Innehållstyper i data/ (t.ex. sidor, nyheter, vittnesmål)', 'count' => $dataDirs, 'warn' => $dataDirs === 0],
        ['label' => 'Filer totalt i data/', 'count' => $dataFiles, 'warn' => false],
        ['label' => 'Bilder i uploads/images', 'count' => $countFiles($root . '/uploads/images'), 'warn' => false],
        ['label' => 'Dokument i uploads/documents', 'count' => $countFiles($root . '/uploads/documents'), 'warn' => false],
    ];
}

$step = (int) ($_POST['step'] ?? 1);
$errors = [];

if ($step === 1 && $_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk) {
    $step = 2;
}

$env = readEnvFile($root . '/.env');
if ($step === 2 && $_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk && isset($_POST['mail_from_address'])) {
    $values = [
        'APP_ENV'           => isset($_POST['keep_dev']) ? 'development' : 'production',
        'MAIL_FROM_ADDRESS' => trim((string) $_POST['mail_from_address']),
        'MAIL_FROM_NAME'    => trim((string) $_POST['mail_from_name']),
        'PETITION_URL'      => trim((string) $_POST['petition_url']),
    ];
    $ok = writeEnvFile($root . '/.env', $root . '/.env.example', $values);
    if (!$ok) {
        $errors[] = 'Kunde inte skriva .env — kontrollera att webbservern har skrivrättighet i projektroten.';
    } else {
        $step = 3;
    }
    $env = readEnvFile($root . '/.env');
}

// ------------------------------------------------------------------ views --

if ($step <= 1) {
    $checks = requirements($root);
    $counts = contentCounts($root);

    $reqItems = '';
    foreach ($checks as $c) {
        $reqItems .= '<li><span class="dot ' . ($c['ok'] ? 'ok' : 'bad') . '"></span>'
            . '<span>' . h($c['label']) . '</span><span class="detail">' . h($c['detail']) . '</span></li>';
    }
    $countItems = '';
    $anyWarn = false;
    foreach ($counts as $c) {
        if ($c['warn']) {
            $anyWarn = true;
        }
        $dot = $c['warn'] ? 'warn' : 'ok';
        $countItems .= '<li><span class="dot ' . $dot . '"></span>'
            . '<span>' . h($c['label']) . '</span><span class="detail">' . $c['count'] . '</span></li>';
    }

    render($eyebrow, 'Kontrollerar det som laddades upp', stepper(1, 3) . '<div class="card">'
        . '<h1>Miljön</h1>'
        . '<ul class="checks">' . $reqItems . '</ul>'
        . '<h1 style="margin-top:1.5rem">Innehåll som hittades</h1>'
        . '<p class="hint" style="margin-bottom:1rem">Räknat i de filer som faktiskt ligger på servern just nu — inget skrivs eller ändras här.</p>'
        . '<ul class="checks">' . $countItems . '</ul>'
        . ($anyWarn
            ? '<div class="warn-box">Något ser tomt ut. Om det inte stämmer (ni väntade er riktigt innehåll/konton) — kontrollera att FTP-uppladdningen av <code>data/</code>, <code>database/app.sqlite</code> och <code>uploads/</code> faktiskt blev klar, ladda om sidan när den är det.</div>'
            : '')
        . '<form method="post"><input type="hidden" name="step" value="1"><input type="hidden" name="token" value="' . h($token) . '">'
        . '<div class="actions"><button type="submit">Fortsätt →</button></div></form>'
        . '</div>');
}

if ($step === 2) {
    $currentEnv = $env['APP_ENV'] ?? '';
    render($eyebrow, 'Klargör för skarp drift', stepper(2, 3) . '<div class="card">'
        . '<h1>Klargör för skarp drift</h1>'
        . ($errors ? '<div class="error">' . implode('<br>', array_map('h', $errors)) . '</div>' : '')
        . ($currentEnv === 'development'
            ? '<div class="warn-box"><strong>APP_ENV står på "development"</strong> i den .env ni laddade upp — det visar felmeddelanden med sökvägar och stack traces för besökare. Sätts till "production" nedan om inte rutan kryssas i.</div>'
            : '')
        . '<form method="post">'
        . '<input type="hidden" name="step" value="2"><input type="hidden" name="token" value="' . h($token) . '">'
        . '<label for="mail_from_address">Avsändaradress för mejl</label>'
        . '<input type="email" id="mail_from_address" name="mail_from_address" placeholder="no-reply@er-domän.se" value="' . h($env['MAIL_FROM_ADDRESS'] ?? '') . '">'
        . '<p class="hint">Kontaktformulär och "skicka nytt lösenord".</p>'
        . '<label for="mail_from_name">Avsändarnamn</label>'
        . '<input type="text" id="mail_from_name" name="mail_from_name" value="' . h($env['MAIL_FROM_NAME'] ?? '') . '">'
        . '<label for="petition_url">Namninsamlingens URL (Skrivunder.com)</label>'
        . '<input type="text" id="petition_url" name="petition_url" value="' . h($env['PETITION_URL'] ?? '') . '">'
        . '<label style="display:flex;align-items:center;gap:.5rem;font-weight:400;margin-top:1.25rem">'
        . '<input type="checkbox" name="keep_dev" value="1" style="width:auto"> Behåll development-läge (visar felmeddelanden — bara för felsökning, inte för en sajt besökare når)'
        . '</label>'
        . '<div class="actions"><button type="submit">Spara &amp; fortsätt →</button></div>'
        . '</form></div>');
}

render($eyebrow, 'Klart', stepper(3, 3) . '<div class="card">'
    . '<h1>Klart! 🎉</h1>'
    . '<p>Er befintliga sajt — innehåll och konton oförändrade — är redo. Logga in med samma konto ni redan '
    . 'använder lokalt. Sista steget är att ta bort den här guiden, av samma skäl som för en färsk installation: '
    . 'den ska inte ligga kvar nåbar.</p>'
    . '<form method="post" onsubmit="return confirm(\'Radera install/-mappen nu?\');">'
    . '<input type="hidden" name="self_destruct" value="1"><input type="hidden" name="token" value="' . h($token) . '">'
    . '<div class="actions"><button type="submit">Radera guiden nu</button>'
    . '<a class="btn ghost" href="/admin/login">Till inloggningen →</a></div>'
    . '</form>'
    . '<p class="hint" style="margin-top:1rem">Går raderingen inte (skrivskyddad mapp) — ta bort <code>install/</code> manuellt via FTP eller webbhotellets filhanterare.</p>'
    . '</div>');
