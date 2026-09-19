<?php
declare(strict_types=1);

// Test av Auth: inloggning, session/CSRF, utloggning, rate limiting och
// behörighetsnivåer (admin/superadmin/medlem). Kör mot en egen temporär
// SQLite-databas — rör aldrig database/app.sqlite.
//
// Kör:  php tests/auth_test.php

require dirname(__DIR__) . '/server/lib/Db.php';
require dirname(__DIR__) . '/server/lib/Auth.php';

// Response::error() anropar exit(); den behöver simuleras i testet i stället
// för att laddas på riktigt, så requireX()-metoderna kan testas utan att
// avsluta processen.
final class Response
{
    public static ?array $lastError = null;

    public static function error(string $code, string $message, int $status = 400): never
    {
        self::$lastError = ['code' => $code, 'message' => $message, 'status' => $status];
        throw new class extends RuntimeException {};
    }
}

$dbPath = sys_get_temp_dir() . '/rs_auth_test_' . bin2hex(random_bytes(4)) . '.sqlite';
$pdo = Db::get($dbPath);
$pdo->exec((string) file_get_contents(dirname(__DIR__) . '/database/schema.sql'));

$failures = 0;
$check = function (string $label, bool $ok) use (&$failures): void {
    if (!$ok) {
        $failures++;
    }
    printf("%-40s %s%s", $label, $ok ? 'PASS' : 'FAIL', PHP_EOL);
};

function makeUser(PDO $pdo, string $email, string $password, ?string $role, bool $member = false, bool $readOnly = false): string
{
    $id = bin2hex(random_bytes(8));
    $now = (new DateTimeImmutable())->format(DATE_ATOM);
    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, password_hash, display_name, role, intranet_member, intranet_read_only, created_at, updated_at)
         VALUES (:id, :email, :hash, :name, :role, :member, :ro, :c, :u)'
    );
    $stmt->execute([
        'id' => $id, 'email' => $email, 'hash' => password_hash($password, PASSWORD_DEFAULT),
        'name' => 'Test', 'role' => $role, 'member' => $member ? 1 : 0, 'ro' => $readOnly ? 1 : 0,
        'c' => $now, 'u' => $now,
    ]);
    return $id;
}

// --- inloggning: fel lösenord --------------------------------------------------
makeUser($pdo, 'admin@test.local', 'CorrectHorse123', 'superadmin');
$auth = new Auth($pdo);
$check('Fel lösenord ger null', $auth->attemptLogin('admin@test.local', 'wrong', '127.0.0.1') === null);

// --- inloggning: rätt lösenord ger session + csrf ------------------------------
$auth2 = new Auth($pdo);
$user = $auth2->attemptLogin('admin@test.local', 'CorrectHorse123', '127.0.0.1');
$check('Rätt lösenord ger användare', $user !== null && $user['email'] === 'admin@test.local');
$check('password_hash exponeras aldrig', $user !== null && !array_key_exists('password_hash', $user));
$session = $auth2->currentSession();
$check('Session cachas direkt efter inloggning', $session !== null && $session['csrf_token'] !== '');

// --- rate limiting ---------------------------------------------------------------
$auth3 = new Auth($pdo);
for ($i = 0; $i < 4; $i++) {
    $auth3->attemptLogin('admin@test.local', 'wrong', '10.0.0.1');
}
$limited = false;
try {
    $auth3->attemptLogin('admin@test.local', 'wrong', '10.0.0.1');
} catch (RuntimeException $e) {
    $limited = $e->getMessage() === 'RATE_LIMITED';
}
$check('Rate limiting slår till efter upprepade fel', $limited);

// --- behörighetsnivåer: superadmin --------------------------------------------
Response::$lastError = null;
$superadminOk = true;
try { $auth2->requireSuperadmin(); } catch (Throwable) { $superadminOk = false; }
$check('Superadmin klarar requireSuperadmin', $superadminOk);

// --- behörighetsnivåer: skribent (admin men ej superadmin) --------------------
makeUser($pdo, 'skribent@test.local', 'AnotherPass123', 'skribent');
$authSkribent = new Auth($pdo);
$authSkribent->attemptLogin('skribent@test.local', 'AnotherPass123', '127.0.0.1');
$adminOk = true;
try { $authSkribent->requireAdmin(); } catch (Throwable) { $adminOk = false; }
$check('Skribent klarar requireAdmin', $adminOk);

$notSuperadmin = false;
try { $authSkribent->requireSuperadmin(); } catch (Throwable) { $notSuperadmin = Response::$lastError['code'] === 'FORBIDDEN'; }
$check('Skribent nekas requireSuperadmin (403)', $notSuperadmin);

// --- behörighetsnivåer: intranätmedlem utan adminroll --------------------------
makeUser($pdo, 'medlem@test.local', 'MemberPass123', null, member: true, readOnly: true);
$authMedlem = new Auth($pdo);
$authMedlem->attemptLogin('medlem@test.local', 'MemberPass123', '127.0.0.1');
$memberOk = true;
try { $authMedlem->requireMember(); } catch (Throwable) { $memberOk = false; }
$check('Läsbehörig medlem klarar requireMember', $memberOk);

$readOnlyBlocked = false;
try { $authMedlem->requireIntranetWrite(); } catch (Throwable) { $readOnlyBlocked = Response::$lastError['code'] === 'FORBIDDEN'; }
$check('Läsbehörig medlem nekas requireIntranetWrite', $readOnlyBlocked);

// --- utloggning tar bort sessionen ---------------------------------------------
$auth2->logout();
$check('Session borta efter logout', $auth2->currentSession() === null);
$freshAuth = new Auth($pdo);
$check('Ny Auth-instans ser ingen inloggad (ingen cookie satt i CLI)', $freshAuth->currentUser() === null);

fwrite(STDOUT, PHP_EOL);
if ($failures > 0) {
    fwrite(STDERR, "{$failures} test(er) misslyckades.\n");
    exit(1);
}
fwrite(STDOUT, "Alla tester gick igenom.\n");

@unlink($dbPath);
@unlink($dbPath . '-wal');
@unlink($dbPath . '-shm');
