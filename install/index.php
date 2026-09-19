<?php
declare(strict_types=1);

// Webbaserad installationsguide — ett alternativ till att köra
// scripts/install.php via SSH, för webbhotell utan terminalåtkomst (eller
// för den som helt enkelt hellre fyller i ett formulär).
//
// Körs EN gång, direkt efter att dist/, server/, .htaccess och den här
// install/-mappen laddats upp. Radera install/-mappen efteråt (sista steget
// har en knapp som gör det åt dig) — den ska inte ligga kvar nåbar.
//
// Säkerhet: guiden vägrar köra om databasen redan har ett konto (samma spärr
// som scripts/install.php) — se guard() nedan, som körs allra först,
// oavsett vilket steg som begärs.

session_start();

$root = dirname(__DIR__);
require $root . '/server/lib/Db.php';

// ---------------------------------------------------------------- helpers --

/** @return array<int,array{label:string,ok:bool,detail:string}> */
function requirements(string $root): array
{
    $checks = [];
    $checks[] = [
        'label'  => 'PHP-version (8.1 eller senare)',
        'ok'     => version_compare(PHP_VERSION, '8.1.0', '>='),
        'detail' => PHP_VERSION,
    ];
    foreach (['pdo_sqlite', 'mbstring', 'fileinfo', 'dom', 'json', 'openssl', 'curl'] as $ext) {
        $ok = extension_loaded($ext);
        $checks[] = ['label' => "PHP-tillägget \"{$ext}\"", 'ok' => $ok, 'detail' => $ok ? 'Installerat' : 'Saknas'];
    }
    foreach (['data' => $root . '/data', 'uploads' => $root . '/uploads', 'database' => $root . '/database'] as $label => $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $ok = is_dir($dir) && is_writable($dir);
        $checks[] = [
            'label'  => "Skrivbar katalog: {$label}/",
            'ok'     => $ok,
            'detail' => $ok ? 'OK' : 'Saknar skrivrättighet — kör chmod -R 775 ' . $label . ' på servern',
        ];
    }
    return $checks;
}

/** true om varje krav (utom de rent informativa) är uppfyllt. */
function requirementsOk(array $checks): bool
{
    foreach ($checks as $c) {
        if (!$c['ok']) {
            return false;
        }
    }
    return true;
}

/** @return array<string,string> */
function readEnvFile(string $path): array
{
    $out = [];
    if (!is_readable($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        $out[trim($k)] = trim($v);
    }
    return $out;
}

/**
 * Skriver/uppdaterar .env: utgår från befintlig .env om den finns, annars
 * .env.example som mall (så kommentarerna följer med första gången), och
 * ersätter bara raderna för de nycklar som faktiskt sätts här.
 * @param array<string,string> $values
 */
function writeEnvFile(string $envPath, string $examplePath, array $values): bool
{
    $templatePath = is_file($envPath) ? $envPath : $examplePath;
    $lines = is_readable($templatePath) ? (file($templatePath, FILE_IGNORE_NEW_LINES) ?: []) : [];
    $seen = [];
    foreach ($lines as $i => $line) {
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k] = explode('=', $line, 2);
        $k = trim($k);
        if (array_key_exists($k, $values)) {
            $lines[$i] = $k . '=' . $values[$k];
            $seen[$k] = true;
        }
    }
    foreach ($values as $k => $v) {
        if (empty($seen[$k])) {
            $lines[] = $k . '=' . $v;
        }
    }
    return file_put_contents($envPath, implode("\n", $lines) . "\n") !== false;
}

/** Är databasen redan installerad (finns users-tabellen och har den en rad)? */
function alreadyInstalled(string $dbPath): bool
{
    if (!is_file($dbPath)) {
        return false;
    }
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $hasUsers = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")->fetch();
        if (!$hasUsers) {
            return false;
        }
        return ((int) $pdo->query('SELECT COUNT(*) AS n FROM users')->fetch()['n']) > 0;
    } catch (Throwable) {
        // En databasfil som inte går att läsa som SQLite räknas inte som
        // "installerad" här — guiden får gärna försöka skapa den på nytt.
        return false;
    }
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function render(string $title, string $body): never
{
    echo '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow">'
        . '<title>' . h($title) . ' — Installation</title><style>'
        . ':root{--primary:#2d5a3d;--primary-dark:#1e3f2a;--bg:#fafaf8;--card:#fff;--border:#d8ddd6;--text:#1a1a1a;--muted:#6b6f68;--ok:#2d7a3d;--bad:#b8402d}'
        . '*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);padding:var(--space,2rem) 1rem}'
        . '.wrap{max-width:640px;margin:0 auto}'
        . 'h1{font-size:1.4rem;margin:0 0 .25rem}.eyebrow{color:var(--muted);font-size:.85rem;margin:0 0 1.5rem}'
        . '.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.75rem}'
        . 'ul.checks{list-style:none;padding:0;margin:0 0 1.5rem}'
        . 'ul.checks li{display:flex;gap:.6rem;align-items:baseline;padding:.4rem 0;border-bottom:1px solid #eee;font-size:.92rem}'
        . 'ul.checks li:last-child{border-bottom:none}'
        . '.dot{flex-shrink:0;width:.6rem;height:.6rem;border-radius:50%;margin-top:.3rem}'
        . '.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}'
        . '.detail{color:var(--muted);margin-left:auto;font-size:.85rem;text-align:right}'
        . 'label{display:block;font-weight:600;font-size:.85rem;margin:1rem 0 .3rem}'
        . 'label:first-of-type{margin-top:0}'
        . 'input[type=text],input[type=email],input[type=password]{width:100%;padding:.6rem .7rem;border:1px solid var(--border);border-radius:8px;font-size:1rem}'
        . '.hint{color:var(--muted);font-size:.8rem;margin:.3rem 0 0}'
        . '.error{background:#fdecea;border:1px solid #f3b8ae;color:var(--bad);padding:.7rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}'
        . '.actions{display:flex;gap:.75rem;margin-top:1.5rem}'
        . 'button,.btn{background:var(--primary);color:#fff;border:none;padding:.7rem 1.3rem;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}'
        . 'button:hover,.btn:hover{background:var(--primary-dark)}'
        . '.btn.ghost{background:none;color:var(--text);border:1px solid var(--border)}'
        . '.steps{display:flex;gap:.4rem;margin-bottom:1.25rem}'
        . '.steps span{flex:1;height:4px;border-radius:2px;background:var(--border)}.steps span.on{background:var(--primary)}'
        . '</style></head><body><div class="wrap">'
        . '<p class="eyebrow">Rögleskogen — installationsguide</p>'
        . $body
        . '</div></body></html>';
    exit;
}

function stepper(int $current): string
{
    $out = '<div class="steps">';
    for ($i = 1; $i <= 4; $i++) {
        $out .= '<span' . ($i <= $current ? ' class="on"' : '') . '></span>';
    }
    return $out . '</div>';
}

// --------------------------------------------------------- token + radera --
// (i den ordningen, och FÖRE "redan installerad"-spärren: annars är
// "radera guiden nu"-knappen på sista steget dödkod — kontot finns redan
// då, så spärren skulle blockera själva raderingen.)

// CSRF-liknande skydd mellan formulären: ett engångstoken i sessionen.
// Löser inte "någon annan hinner före" (samma begränsning WordPress egen
// installationsguide har) — det förhindras genom att köra guiden direkt
// efter uppladdning och radera mappen efteråt.
if (empty($_SESSION['install_token'])) {
    $_SESSION['install_token'] = bin2hex(random_bytes(16));
}
$token = $_SESSION['install_token'];
$tokenOk = ($_POST['token'] ?? '') === $token || $_SERVER['REQUEST_METHOD'] !== 'POST';

// Radera install/-mappen (knapp på sista steget). Måste kunna köras oavsett
// installationsstatus — det är precis det den städar upp EFTER.
if (isset($_POST['self_destruct']) && $tokenOk) {
    $dir = __DIR__;
    try {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $file) {
            $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($dir);
        unset($_SESSION['install_token']);
        render('Klart', '<div class="card"><h1>Installationsguiden är borttagen</h1>'
            . '<p>Allt klart. Kontrollera gärna via FTP/filhanteraren att <code>install/</code>-mappen '
            . 'verkligen är borta — på en del webbhotell hinner inte den här sidans egen fil raderas '
            . 'förrän efter att sidan visats.</p>'
            . '<p><a class="btn" href="/admin/login">Till inloggningen →</a></p></div>');
    } catch (Throwable) {
        render('Kunde inte radera automatiskt', '<div class="card"><h1>Kunde inte radera automatiskt</h1>'
            . '<p>Radera <code>install/</code>-mappen manuellt via FTP eller webbhotellets filhanterare — '
            . 'den ska inte ligga kvar nåbar.</p>'
            . '<p><a class="btn" href="/admin/login">Till inloggningen →</a></p></div>');
    }
}

// ------------------------------------------------------------------ guard --

$dbPath = $root . '/database/app.sqlite';
if (alreadyInstalled($dbPath)) {
    render('Redan installerad', '<div class="card"><h1>Redan installerad</h1>'
        . '<p>Den här installationen har redan ett konto. Guiden går inte att köra igen härifrån '
        . '— det skulle kunna låta vem som helst skapa ett nytt superadmin-konto.</p>'
        . '<p>Behöver du en ominstallation (t.ex. i en testmiljö), använd <code>php scripts/install.php --reset</code> '
        . 'på servern i stället — det kräver att man skriver "RESET" för att bekräfta.</p>'
        . '<p><strong>Radera install/-mappen nu</strong> om den inte redan är borta — den ska inte ligga kvar.</p>'
        . '<p><a class="btn" href="/admin/login">Till inloggningen →</a></p></div>');
}

$step = (int) ($_POST['step'] ?? 1);
$errors = [];

// ------------------------------------------------------------- steg 1 → 2 --

if ($step === 1 && $_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk) {
    $step = 2;
}

// ------------------------------------------------------------- steg 2 → 3 --
// (formuläret på steg 2 postar hit med step=2: e-postinställningar)

$env = readEnvFile($root . '/.env');
if ($step === 2 && $_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk && isset($_POST['mail_from_address'])) {
    $values = [
        'MAIL_FROM_ADDRESS' => trim((string) $_POST['mail_from_address']),
        'MAIL_FROM_NAME'    => trim((string) $_POST['mail_from_name']),
        'PETITION_URL'      => trim((string) $_POST['petition_url']),
    ];
    $ok = writeEnvFile($root . '/.env', $root . '/.env.example', $values);
    if (!$ok) {
        $errors[] = 'Kunde inte skriva .env — kontrollera att webbservern har skrivrättighet i projektroten. Du kan hoppa över det här steget och fylla i .env manuellt senare.';
    }
    $env = readEnvFile($root . '/.env');
    $step = 3;
}

// ------------------------------------------------------------- steg 3 → 4 --
// (formuläret på steg 3 postar hit med step=3: första administratören)

if ($step === 3 && $_SERVER['REQUEST_METHOD'] === 'POST' && $tokenOk && isset($_POST['email'])) {
    $email = strtolower(trim((string) $_POST['email']));
    $password = (string) $_POST['password'];
    $passwordConfirm = (string) $_POST['password_confirm'];
    $name = trim((string) $_POST['name']);

    if ($email === '' || !str_contains($email, '@')) {
        $errors[] = 'Ange en giltig e-postadress.';
    }
    if (strlen($password) < 10) {
        $errors[] = 'Lösenordet måste vara minst 10 tecken.';
    }
    if ($password !== $passwordConfirm) {
        $errors[] = 'Lösenorden matchar inte.';
    }
    if ($name === '') {
        $errors[] = 'Ange ett namn.';
    }

    if ($errors === []) {
        try {
            $pdo = Db::get($dbPath);
            $schema = file_get_contents($root . '/database/schema.sql');
            if ($schema === false) {
                throw new RuntimeException('Kunde inte läsa database/schema.sql.');
            }
            $pdo->exec($schema);

            $now = (new DateTimeImmutable())->format(DATE_ATOM);
            $stmt = $pdo->prepare(
                'INSERT INTO users (id, email, password_hash, display_name, role, intranet_member, intranet_read_only, created_at, updated_at)
                 VALUES (:id, :email, :hash, :name, :role, 1, 0, :created, :updated)'
            );
            $stmt->execute([
                'id'      => bin2hex(random_bytes(16)),
                'email'   => $email,
                'hash'    => password_hash($password, PASSWORD_DEFAULT),
                'name'    => $name,
                'role'    => 'superadmin',
                'created' => $now,
                'updated' => $now,
            ]);
            $step = 4;
        } catch (Throwable $e) {
            $errors[] = 'Kunde inte skapa kontot: ' . $e->getMessage();
        }
    }
}

// ------------------------------------------------------------------ views --

if ($step <= 1) {
    $checks = requirements($root);
    $ok = requirementsOk($checks);
    $items = '';
    foreach ($checks as $c) {
        $items .= '<li><span class="dot ' . ($c['ok'] ? 'ok' : 'bad') . '"></span>'
            . '<span>' . h($c['label']) . '</span><span class="detail">' . h($c['detail']) . '</span></li>';
    }
    render('Kontrollerar miljön', stepper(1) . '<div class="card">'
        . '<h1>Kontrollerar miljön</h1>'
        . '<p class="hint" style="margin-bottom:1.25rem">Det här körs en gång, direkt efter att filerna laddats upp.</p>'
        . '<ul class="checks">' . $items . '</ul>'
        . ($ok
            ? '<form method="post"><input type="hidden" name="step" value="1"><input type="hidden" name="token" value="' . h($token) . '">'
                . '<div class="actions"><button type="submit">Fortsätt →</button></div></form>'
            : '<div class="error">Ett eller flera krav är inte uppfyllda. Åtgärda dem (se INSTALL.md) och ladda om sidan.</div>')
        . '</div>');
}

if ($step === 2) {
    render('E-post & namninsamling', stepper(2) . '<div class="card">'
        . '<h1>E-post &amp; namninsamling</h1>'
        . '<p class="hint" style="margin-bottom:1.25rem">Valfritt — går att lämna tomt och fylla i senare, direkt i <code>.env</code> eller under Inställningar i adminpanelen.</p>'
        . ($errors ? '<div class="error">' . implode('<br>', array_map('h', $errors)) . '</div>' : '')
        . '<form method="post">'
        . '<input type="hidden" name="step" value="2"><input type="hidden" name="token" value="' . h($token) . '">'
        . '<label for="mail_from_address">Avsändaradress för mejl</label>'
        . '<input type="email" id="mail_from_address" name="mail_from_address" placeholder="no-reply@er-domän.se" value="' . h($env['MAIL_FROM_ADDRESS'] ?? '') . '">'
        . '<p class="hint">Kontaktformulär och "skicka nytt lösenord". En adress på er egen domän — annars webbhotellets domännamn.</p>'
        . '<label for="mail_from_name">Avsändarnamn</label>'
        . '<input type="text" id="mail_from_name" name="mail_from_name" placeholder="Rädda Rögleskogen" value="' . h($env['MAIL_FROM_NAME'] ?? '') . '">'
        . '<label for="petition_url">Namninsamlingens URL (Skrivunder.com)</label>'
        . '<input type="text" id="petition_url" name="petition_url" placeholder="https://www.skrivunder.com/ERT_NAMN" value="' . h($env['PETITION_URL'] ?? '') . '">'
        . '<div class="actions"><button type="submit">Fortsätt →</button></div>'
        . '</form></div>');
}

if ($step === 3) {
    render('Första administratören', stepper(3) . '<div class="card">'
        . '<h1>Första administratören</h1>'
        . '<p class="hint" style="margin-bottom:1.25rem">Skapar databasen och ett superadmin-konto.</p>'
        . ($errors ? '<div class="error">' . implode('<br>', array_map('h', $errors)) . '</div>' : '')
        . '<form method="post">'
        . '<input type="hidden" name="step" value="3"><input type="hidden" name="token" value="' . h($token) . '">'
        . '<label for="email">E-post</label>'
        . '<input type="email" id="email" name="email" required value="' . h((string) ($_POST['email'] ?? '')) . '">'
        . '<label for="name">Namn</label>'
        . '<input type="text" id="name" name="name" required value="' . h((string) ($_POST['name'] ?? '')) . '">'
        . '<label for="password">Lösenord (minst 10 tecken)</label>'
        . '<input type="password" id="password" name="password" required minlength="10">'
        . '<label for="password_confirm">Upprepa lösenordet</label>'
        . '<input type="password" id="password_confirm" name="password_confirm" required minlength="10">'
        . '<div class="actions"><button type="submit">Skapa konto →</button></div>'
        . '</form></div>');
}

render('Klart', stepper(4) . '<div class="card">'
    . '<h1>Klart! 🎉</h1>'
    . '<p>Databasen är skapad och ditt administratörskonto är klart. Sista steget — och viktigt av säkerhetsskäl — '
    . 'är att ta bort den här installationsguiden. Ligger den kvar kan i teorin vem som helst öppna den (om databasen '
    . 'skulle bli tom igen) eller bara läsa vilka PHP-tillägg servern har.</p>'
    . '<form method="post" onsubmit="return confirm(\'Radera install/-mappen nu?\');">'
    . '<input type="hidden" name="self_destruct" value="1"><input type="hidden" name="token" value="' . h($token) . '">'
    . '<div class="actions"><button type="submit">Radera installationsguiden nu</button>'
    . '<a class="btn ghost" href="/admin/login">Till inloggningen →</a></div>'
    . '</form>'
    . '<p class="hint" style="margin-top:1rem">Går raderingen inte (skrivskyddad mapp) — ta bort <code>install/</code> manuellt via FTP eller webbhotellets filhanterare.</p>'
    . '</div>');
