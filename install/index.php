<?php
declare(strict_types=1);

// Webbaserad installationsguide — ett alternativ till att köra
// scripts/install.php via SSH, för webbhotell utan terminalåtkomst (eller
// för den som helt enkelt hellre fyller i ett formulär). Till för ett HELT
// TOMT webbhotellkonto. Har ni redan ett färdigt lokalt system (riktigt
// innehåll, riktiga konton) och bara ska flytta det till en server — kör
// install/migrate.php i stället, den här vägrar då köra (se guard nedan).
//
// Körs EN gång, direkt efter att dist/, server/, .htaccess och den här
// install/-mappen laddats upp. Radera install/-mappen efteråt (sista steget
// har en knapp som gör det åt dig) — den ska inte ligga kvar nåbar.
//
// Säkerhet: guiden vägrar köra om databasen redan har ett konto (samma spärr
// som scripts/install.php).

session_start();

$root = dirname(__DIR__);
require $root . '/server/lib/Db.php';
require __DIR__ . '/_shared.php';

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

$eyebrow = 'Rögleskogen — installationsguide (tom sajt)';

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

if (isset($_POST['self_destruct']) && $tokenOk) {
    selfDestructInstallDir();
}

// ------------------------------------------------------------------ guard --

$dbPath = $root . '/database/app.sqlite';
if (alreadyInstalled($dbPath)) {
    render($eyebrow, 'Redan installerad', '<div class="card"><h1>Redan installerad</h1>'
        . '<p>Den här installationen har redan ett konto. Guiden går inte att köra igen härifrån '
        . '— det skulle kunna låta vem som helst skapa ett nytt superadmin-konto.</p>'
        . '<p>Har ni bara flyttat ett redan färdigt system hit via FTP (riktigt innehåll, riktiga '
        . 'konton) är det här förväntat — ni behöver inte köra den här guiden alls. Se i stället '
        . '<a href="migrate.php">install/migrate.php</a> för en efterkontroll av det som redan finns.</p>'
        . '<p>Behöver du en riktig ominstallation (t.ex. i en testmiljö), använd '
        . '<code>php scripts/install.php --reset</code> på servern i stället — det kräver att man '
        . 'skriver "RESET" för att bekräfta.</p>'
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
    render($eyebrow, 'Kontrollerar miljön', stepper(1, 4) . '<div class="card">'
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
    render($eyebrow, 'E-post & namninsamling', stepper(2, 4) . '<div class="card">'
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
    render($eyebrow, 'Första administratören', stepper(3, 4) . '<div class="card">'
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

render($eyebrow, 'Klart', stepper(4, 4) . '<div class="card">'
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
