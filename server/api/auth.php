<?php
declare(strict_types=1);

// Endpoints för inloggning/utloggning/sessionsstatus. Ersätter
// `supabase.auth.*` (Appwrite Account-sessioner) i src/lib/supabase.ts.
final class AuthController
{
    public function __construct(private readonly Auth $auth) {}

    /** GET /api/auth/session — nuvarande användare + csrf-token, eller null. */
    public function session(Request $req, array $args): void
    {
        $user = $this->auth->currentUser();
        $session = $this->auth->currentSession();
        Response::ok([
            'user'      => $user,
            'csrfToken' => $session['csrf_token'] ?? null,
        ]);
    }

    /** POST /api/auth/login — {email, password}. */
    public function login(Request $req, array $args): void
    {
        $body = $req->json();
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') {
            Response::error('VALIDATION_ERROR', 'E-post och lösenord krävs.', 400);
        }

        try {
            $user = $this->auth->attemptLogin($email, $password, $_SERVER['REMOTE_ADDR'] ?? '');
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'RATE_LIMITED') {
                Response::error('RATE_LIMITED', 'För många inloggningsförsök. Försök igen senare.', 429);
            }
            throw $e;
        }

        if ($user === null) {
            Response::error('INVALID_CREDENTIALS', 'Fel e-post eller lösenord.', 401);
        }

        $session = $this->auth->currentSession();
        Response::ok([
            'user'      => $user,
            'csrfToken' => $session['csrf_token'] ?? null,
        ]);
    }

    /** POST /api/auth/logout */
    public function logout(Request $req, array $args): void
    {
        $this->auth->logout();
        Response::ok(['loggedOut' => true]);
    }

    /** POST /api/auth/signup — självregistrering, inaktiverat konto (paritet med Appwrites account.create). */
    public function signup(Request $req, array $args): void
    {
        $body = $req->json();
        $displayName = trim((string) ($body['display_name'] ?? $body['displayName'] ?? ''));
        try {
            $user = $this->auth->signUp(
                (string) ($body['email'] ?? ''),
                (string) ($body['password'] ?? ''),
                $displayName,
            );
        } catch (RuntimeException $e) {
            if ($e->getMessage() === 'EMAIL_TAKEN') {
                Response::error('EMAIL_TAKEN', 'E-postadressen används redan.', 409);
            }
            Response::error('VALIDATION_ERROR', 'Ogiltig e-post eller för kort lösenord (minst 8 tecken).', 400);
        }
        Response::ok(['user' => $user]);
    }

    /**
     * POST /api/auth/profile — sätter namn/presentation på ett nyss skapat,
     * ännu inte aktiverat konto. Ingen session krävs (kontot har ingen än),
     * men kräver att kontot fortfarande saknar roll/intranätsåtkomst.
     */
    public function updateProfile(Request $req, array $args): void
    {
        $body = $req->json();
        $id = (string) ($body['id'] ?? '');
        if ($id === '') {
            Response::error('VALIDATION_ERROR', 'id krävs.', 400);
        }
        $ok = $this->auth->updatePendingProfile(
            $id,
            trim((string) ($body['display_name'] ?? $body['displayName'] ?? '')),
            trim((string) ($body['intro'] ?? '')),
        );
        if (!$ok) {
            Response::error('FORBIDDEN', 'Kontot kan inte längre redigeras utan inloggning.', 403);
        }
        Response::ok(['updated' => true]);
    }
}
