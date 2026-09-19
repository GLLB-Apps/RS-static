<?php
declare(strict_types=1);

// Autentisering: PHP-sessioner lagrade i SQLite (inte $_SESSION — vi vill
// kunna lista/återkalla sessioner och sätta egna utgångstider), lösenord med
// password_hash()/password_verify(), CSRF-token per session, och enkel
// rate limiting på inloggningsförsök.
//
// Motsvarar Appwrites konto+session-modell (se auth.tsx): en användare har
// en nullbar `role` (adminåtkomst, tre nivåer) och en oberoende
// `intranet_member`/`intranet_read_only`-flagga (intranätsåtkomst).
final class Auth
{
    private const COOKIE_NAME = 'rs_session';
    private const SESSION_TTL_DAYS = 30;
    private const MAX_ATTEMPTS = 5;
    private const ATTEMPT_WINDOW_MIN = 15;

    private ?array $user = null;
    private ?array $session = null;
    private bool $loaded = false;

    public function __construct(private readonly PDO $db) {}

    /** Nuvarande inloggade användare (utan password_hash), eller null. */
    public function currentUser(): ?array
    {
        $this->load();
        return $this->user;
    }

    public function currentSession(): ?array
    {
        $this->load();
        return $this->session;
    }

    private function load(): void
    {
        if ($this->loaded) {
            return;
        }
        $this->loaded = true;

        $sid = $_COOKIE[self::COOKIE_NAME] ?? '';
        if ($sid === '' || !preg_match('/^[a-f0-9]{64}$/', $sid)) {
            return;
        }

        $stmt = $this->db->prepare('SELECT * FROM sessions WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $sid]);
        $session = $stmt->fetch();
        if ($session === false) {
            return;
        }
        if (new DateTimeImmutable($session['expires_at']) < new DateTimeImmutable()) {
            $this->destroySession($sid);
            return;
        }

        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $session['user_id']]);
        $user = $stmt->fetch();
        if ($user === false) {
            $this->destroySession($sid);
            return;
        }

        unset($user['password_hash']);
        $this->session = $session;
        $this->user = $user;
    }

    /**
     * Loggar in. Returnerar användaren (utan password_hash) vid framgång,
     * annars null — anroparen avgör felmeddelande (avslöjar inte om det var
     * e-post eller lösenord som var fel).
     */
    public function attemptLogin(string $email, string $password, string $ip): ?array
    {
        $email = strtolower(trim($email));

        if ($this->isRateLimited($email, $ip)) {
            throw new RuntimeException('RATE_LIMITED');
        }

        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        $ok = $user !== false && password_verify($password, $user['password_hash']);
        $this->recordAttempt($email, $ip, $ok);

        if (!$ok) {
            return null;
        }

        $session = $this->createSession($user['id']);
        unset($user['password_hash']);

        // Cacha direkt: $_COOKIE speglar inte cookien vi just satte (den syns
        // först nästa request), så load() skulle annars inte hitta sessionen
        // och currentSession() returnera null i samma svar som inloggningen.
        $this->loaded = true;
        $this->session = $session;
        $this->user = $user;

        return $user;
    }

    /**
     * Självregistrering (adminloginens "Skapa konto"). Skapar ett konto utan
     * roll/intranätsåtkomst — en superadmin aktiverar det senare. Motsvarar
     * Appwrites account.create(), som inte heller loggar in kontot.
     * @throws RuntimeException 'VALIDATION_ERROR' eller 'EMAIL_TAKEN'
     * @return array{id:string,email:string}
     */
    public function signUp(string $email, string $password, string $displayName): array
    {
        $email = strtolower(trim($email));
        if ($email === '' || !str_contains($email, '@') || strlen($password) < 8) {
            throw new RuntimeException('VALIDATION_ERROR');
        }

        $stmt = $this->db->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        if ($stmt->fetch() !== false) {
            throw new RuntimeException('EMAIL_TAKEN');
        }

        $id = bin2hex(random_bytes(16));
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $stmt = $this->db->prepare(
            'INSERT INTO users (id, email, password_hash, display_name, intro, role, intranet_member, intranet_read_only, created_at, updated_at)
             VALUES (:id, :email, :hash, :name, :intro, NULL, 0, 0, :c, :u)'
        );
        $stmt->execute([
            'id' => $id, 'email' => $email, 'hash' => password_hash($password, PASSWORD_DEFAULT),
            'name' => $displayName, 'intro' => '', 'c' => $now, 'u' => $now,
        ]);

        return ['id' => $id, 'email' => $email];
    }

    /**
     * Sätter presentation/namn på ett ännu inte aktiverat konto (ingen roll,
     * ingen intranätsåtkomst) — motsvarar att Appwrites `profiles`-kollektion
     * tillät gäster att skapa (men inte ändra) sin egen rad direkt efter
     * registreringen, innan de har en session. Returnerar false om kontot
     * redan aktiverats eller inte finns.
     */
    public function updatePendingProfile(string $id, string $displayName, string $intro): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE users SET display_name = :name, intro = :intro, updated_at = :u
             WHERE id = :id AND role IS NULL AND intranet_member = 0'
        );
        $stmt->execute([
            'name' => $displayName, 'intro' => $intro,
            'u' => (new DateTimeImmutable())->format(DATE_ATOM), 'id' => $id,
        ]);
        return $stmt->rowCount() > 0;
    }

    public function logout(): void
    {
        // Sessionen kan ha cachats in-memory (t.ex. direkt efter inloggning,
        // innan $_COOKIE speglar den nya cookien) — rensa båda källorna.
        $sid = $_COOKIE[self::COOKIE_NAME] ?? ($this->session['id'] ?? '');
        if ($sid !== '') {
            $this->destroySession($sid);
        }
        $this->clearCookie();
        $this->loaded = true;
        $this->session = null;
        $this->user = null;
    }

    /** Kastar vid ogiltig/saknad CSRF-token. Anropas för alla skrivande metoder. */
    public function requireCsrf(Request $req): void
    {
        $session = $this->currentSession();
        $token = $req->header('X-CSRF-Token') ?? '';
        if ($session === null || $token === '' || !hash_equals($session['csrf_token'], $token)) {
            Response::error('CSRF_INVALID', 'Ogiltig eller saknad CSRF-token.', 403);
        }
    }

    public function requireUser(): array
    {
        $user = $this->currentUser();
        if ($user === null) {
            Response::error('UNAUTHENTICATED', 'Inloggning krävs.', 401);
        }
        return $user;
    }

    /** role !== null — paritet med isAdmin i auth.tsx. */
    public function requireAdmin(): array
    {
        $user = $this->requireUser();
        if ($user['role'] === null) {
            Response::error('FORBIDDEN', 'Kräver adminbehörighet.', 403);
        }
        return $user;
    }

    public function requireSuperadmin(): array
    {
        $user = $this->requireUser();
        if ($user['role'] !== 'superadmin') {
            Response::error('FORBIDDEN', 'Kräver superadmin.', 403);
        }
        return $user;
    }

    /** isAdmin || intranet_member — paritet med isMember i auth.tsx. */
    public function requireMember(): array
    {
        $user = $this->requireUser();
        if ($user['role'] === null && (int) $user['intranet_member'] !== 1) {
            Response::error('FORBIDDEN', 'Kräver intranätsåtkomst.', 403);
        }
        return $user;
    }

    /** isAdmin || (intranet_member && !intranet_read_only) — canWriteIntranet. */
    public function requireIntranetWrite(): array
    {
        $user = $this->requireUser();
        $canWrite = $user['role'] !== null
            || ((int) $user['intranet_member'] === 1 && (int) $user['intranet_read_only'] !== 1);
        if (!$canWrite) {
            Response::error('FORBIDDEN', 'Skrivskyddad intranätsåtkomst.', 403);
        }
        return $user;
    }

    /** @return array<string,mixed> den nyss skapade sessionsraden */
    private function createSession(string $userId): array
    {
        $sid = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $now = new DateTimeImmutable();
        $expires = $now->modify('+' . self::SESSION_TTL_DAYS . ' days');

        $row = [
            'id'         => $sid,
            'user_id'    => $userId,
            'csrf_token' => $csrf,
            'ip'         => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            'created_at' => $now->format(DATE_ATOM),
            'expires_at' => $expires->format(DATE_ATOM),
        ];

        $stmt = $this->db->prepare(
            'INSERT INTO sessions (id, user_id, csrf_token, ip, user_agent, created_at, expires_at)
             VALUES (:id, :user_id, :csrf_token, :ip, :user_agent, :created_at, :expires_at)'
        );
        $stmt->execute($row);

        $this->setCookie($sid, $expires);
        return $row;
    }

    private function destroySession(string $sid): void
    {
        $stmt = $this->db->prepare('DELETE FROM sessions WHERE id = :id');
        $stmt->execute(['id' => $sid]);
    }

    private function setCookie(string $sid, DateTimeImmutable $expires): void
    {
        if (PHP_SAPI === 'cli') {
            return; // Tester körs i CLI utan riktiga HTTP-headers.
        }
        setcookie(self::COOKIE_NAME, $sid, [
            'expires'  => $expires->getTimestamp(),
            'path'     => '/',
            'secure'   => ($_SERVER['HTTPS'] ?? '') !== '',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private function clearCookie(): void
    {
        if (PHP_SAPI === 'cli') {
            return;
        }
        setcookie(self::COOKIE_NAME, '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'secure'   => ($_SERVER['HTTPS'] ?? '') !== '',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    private function isRateLimited(string $email, string $ip): bool
    {
        $since = (new DateTimeImmutable('-' . self::ATTEMPT_WINDOW_MIN . ' minutes'))->format(DATE_ATOM);
        $stmt = $this->db->prepare(
            'SELECT COUNT(*) AS n FROM login_attempts
             WHERE email = :email AND created_at > :since AND success = 0'
        );
        $stmt->execute(['email' => $email, 'since' => $since]);
        $byEmail = (int) $stmt->fetch()['n'];

        $stmt = $this->db->prepare(
            'SELECT COUNT(*) AS n FROM login_attempts
             WHERE ip = :ip AND created_at > :since AND success = 0'
        );
        $stmt->execute(['ip' => $ip, 'since' => $since]);
        $byIp = (int) $stmt->fetch()['n'];

        return $byEmail >= self::MAX_ATTEMPTS || $byIp >= (self::MAX_ATTEMPTS * 4);
    }

    private function recordAttempt(string $email, string $ip, bool $success): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO login_attempts (email, ip, success, created_at) VALUES (:email, :ip, :success, :created)'
        );
        $stmt->execute([
            'email'   => $email,
            'ip'      => $ip,
            'success' => $success ? 1 : 0,
            'created' => (new DateTimeImmutable())->format(DATE_ATOM),
        ]);
    }
}
