<?php
declare(strict_types=1);

// Kontohantering som inte täcks av user_roles/intranet_members/profiles-vyerna
// (se UserCollections.php): e-postuppslagning, lösenordsbyte och radering av
// obehöriga konton. Motsvarar Appwrites Users-tjänst, som krävde en
// server-nyckel — här är det PHP-serverns session+CSRF-gate i stället.
// Allt superadmin-only, precis som de gamla Vercel-funktionerna
// (api/list-users.js, api/set-user-password.js, api/delete-user.js).
final class UsersController
{
    public function __construct(
        private readonly PDO $db,
        private readonly Auth $auth,
        private readonly Mailer $mailer,
    ) {}

    /** GET /api/users/emails — {id: email} för alla konton. */
    public function emails(Request $req, array $args): void
    {
        $this->auth->requireSuperadmin();
        $map = [];
        foreach ($this->db->query('SELECT id, email FROM users')->fetchAll() as $row) {
            $map[$row['id']] = $row['email'];
        }
        Response::ok(['emails' => $map]);
    }

    /**
     * POST /api/users/delete — {userId}. Vägrar om kontot redan har en roll
     * eller intranätsåtkomst, så knappen (avsedd för väntande registreringar)
     * inte kan användas för att radera en kollega.
     */
    public function delete(Request $req, array $args): void
    {
        $this->auth->requireSuperadmin();
        $this->auth->requireCsrf($req);
        $userId = (string) ($req->json()['userId'] ?? '');

        $stmt = $this->db->prepare('SELECT role, intranet_member FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error('NOT_FOUND', 'Kontot finns inte.', 404);
        }
        if ($row['role'] !== null || (int) $row['intranet_member'] === 1) {
            Response::error('FORBIDDEN', 'Kontot har åtkomst och kan inte raderas här.', 403);
        }

        $this->db->prepare('DELETE FROM users WHERE id = :id')->execute(['id' => $userId]);
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'delete', 'users', $userId);
        Response::ok(['deleted' => true]);
    }

    /** POST /api/users/password — {userId, password}. Superadmin sätter ett annat kontos lösenord. */
    public function setPassword(Request $req, array $args): void
    {
        $this->auth->requireSuperadmin();
        $this->auth->requireCsrf($req);
        $body = $req->json();
        $userId = (string) ($body['userId'] ?? '');
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 8) {
            Response::error('VALIDATION_ERROR', 'Lösenordet måste vara minst 8 tecken.', 400);
        }

        $stmt = $this->db->prepare('UPDATE users SET password_hash = :hash, updated_at = :u WHERE id = :id');
        $stmt->execute([
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'u'    => (new DateTimeImmutable())->format(DATE_ATOM),
            'id'   => $userId,
        ]);
        if ($stmt->rowCount() === 0) {
            Response::error('NOT_FOUND', 'Kontot finns inte.', 404);
        }
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'password_reset', 'users', $userId);
        Response::ok(['updated' => true]);
    }

    /**
     * POST /api/users/send-password — {userId, password}. Sätter det
     * inskrivna lösenordet (samma fält som "Byt lösenord") och mejlar SAMMA
     * lösenord till kontots adress, i stället för att en superadmin behöver
     * kommunicera det manuellt.
     */
    public function sendPassword(Request $req, array $args): void
    {
        $admin = $this->auth->requireSuperadmin();
        $this->auth->requireCsrf($req);
        $body = $req->json();
        $userId = (string) ($body['userId'] ?? '');
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 8) {
            Response::error('VALIDATION_ERROR', 'Lösenordet måste vara minst 8 tecken.', 400);
        }

        $stmt = $this->db->prepare('SELECT email, display_name FROM users WHERE id = :id');
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch();
        if ($user === false) {
            Response::error('NOT_FOUND', 'Kontot finns inte.', 404);
        }
        if ($userId === $admin['id']) {
            Response::error('VALIDATION_ERROR', 'Använd "Byt lösenord" för ditt eget konto.', 400);
        }

        $stmt = $this->db->prepare('UPDATE users SET password_hash = :hash, updated_at = :u WHERE id = :id');
        $stmt->execute([
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'u'    => (new DateTimeImmutable())->format(DATE_ATOM),
            'id'   => $userId,
        ]);

        $name = trim((string) ($user['display_name'] ?? '')) ?: 'du';
        $text = "Hej {$name},\n\n"
            . "Ett nytt lösenord har skapats åt ditt konto: {$password}\n\n"
            . "Logga in och byt det till ett eget så snart du kan.\n";
        $sent = $this->mailer->send((string) $user['email'], 'Nytt lösenord', $text);
        if (!$sent) {
            Response::error('SEND_FAILED', 'Lösenordet sattes, men mejlet kunde inte skickas. Använd "Byt lösenord" i stället.', 502);
        }

        Audit::log($this->db, $admin['id'], 'password_reset_emailed', 'users', $userId);
        Response::ok(['sent' => true]);
    }
}
