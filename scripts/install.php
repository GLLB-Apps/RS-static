<?php
declare(strict_types=1);

// Initierar database/app.sqlite från database/schema.sql och skapar den
// första administratören (superadmin). Körs en gång vid installation.
//
// Vägrar köra igen om det redan finns användare, om inte --reset anges
// (droppar och återskapar alla tabeller — bekräftas interaktivt).
//
// Körning:
//   php scripts/install.php
//   php scripts/install.php --reset
//
// E-post/lösenord/namn för första admin frågas interaktivt, eller läses från
// miljövariabler (INSTALL_ADMIN_EMAIL / INSTALL_ADMIN_PASSWORD /
// INSTALL_ADMIN_NAME) för icke-interaktiv körning — t.ex. .env eller CI.

require dirname(__DIR__) . '/server/lib/Db.php';

$config = require dirname(__DIR__) . '/server/config.php';
$reset = in_array('--reset', $argv, true);

function prompt(string $label, bool $secret = false): string
{
    fwrite(STDOUT, $label);
    if ($secret && stripos(PHP_OS, 'WIN') === false) {
        system('stty -echo');
    }
    $value = trim((string) fgets(STDIN));
    if ($secret && stripos(PHP_OS, 'WIN') === false) {
        system('stty echo');
        fwrite(STDOUT, PHP_EOL);
    }
    return $value;
}

function envOrPrompt(string $envKey, string $label, bool $secret = false): string
{
    $v = getenv($envKey);
    if ($v !== false && $v !== '') {
        return $v;
    }
    return prompt($label, $secret);
}

$pdo = Db::get($config['db_path']);

$hasUsersTable = (bool) $pdo->query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
)->fetch();

if ($hasUsersTable) {
    $userCount = (int) $pdo->query('SELECT COUNT(*) AS n FROM users')->fetch()['n'];
    if ($userCount > 0 && !$reset) {
        fwrite(STDERR, "Databasen är redan installerad ({$userCount} konto(n)). Använd --reset för att återställa (raderar allt).\n");
        exit(1);
    }
    if ($reset) {
        fwrite(STDOUT, "VARNING: --reset raderar ALL data i databasen (konton, meddelanden, vittnesmål, audit log).\n");
        $confirm = prompt('Skriv "RESET" för att bekräfta: ');
        if ($confirm !== 'RESET') {
            fwrite(STDERR, "Avbrutet.\n");
            exit(1);
        }
        foreach (['audit_log', 'testimony_contacts', 'testimonies', 'contact_messages', 'login_attempts', 'sessions', 'users'] as $table) {
            $pdo->exec("DROP TABLE IF EXISTS {$table}");
        }
    }
}

$schema = file_get_contents(dirname(__DIR__) . '/database/schema.sql');
if ($schema === false) {
    fwrite(STDERR, "Kunde inte läsa database/schema.sql\n");
    exit(1);
}
$pdo->exec($schema);
fwrite(STDOUT, "Schema installerat.\n");

fwrite(STDOUT, "\n-- Första administratören (superadmin) --\n");
$email = strtolower(trim(envOrPrompt('INSTALL_ADMIN_EMAIL', 'E-post: ')));
$password = envOrPrompt('INSTALL_ADMIN_PASSWORD', 'Lösenord (minst 10 tecken): ', true);
$name = envOrPrompt('INSTALL_ADMIN_NAME', 'Namn: ');

if ($email === '' || !str_contains($email, '@')) {
    fwrite(STDERR, "Ogiltig e-post.\n");
    exit(1);
}
if (strlen($password) < 10) {
    fwrite(STDERR, "Lösenordet måste vara minst 10 tecken.\n");
    exit(1);
}

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

fwrite(STDOUT, "Superadmin skapad: {$email}\n");
fwrite(STDOUT, "Klart.\n");
