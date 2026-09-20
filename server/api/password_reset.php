<?php
declare(strict_types=1);

// Självbetjänad lösenordsåterställning ("glömt lösenord") — helt publik,
// ingen inloggning krävs (det är hela poängen: ingen annan admin behöver
// vara tillgänglig för att återställa åt en). Avslöjar aldrig om en e-post
// finns i systemet, annars kan endpointen användas för att lista ut vilka
// adresser som har konton — se Auth::requestPasswordReset.
final class PasswordResetController
{
    public function __construct(
        private readonly Auth $auth,
        private readonly Mailer $mailer,
        private readonly string $siteUrl,
    ) {}

    /** POST /api/auth/forgot-password — {email}. Svarar alltid likadant. */
    public function request(Request $req, array $args): void
    {
        $email = trim((string) ($req->json()['email'] ?? ''));
        if ($email === '' || !str_contains($email, '@')) {
            Response::error('VALIDATION_ERROR', 'Ange en giltig e-postadress.', 400);
        }

        $result = $this->auth->requestPasswordReset($email);
        if ($result !== null) {
            $link = rtrim($this->siteUrl, '/') . '/admin/aterstall-losenord?token=' . urlencode($result['token']);
            $name = trim($result['displayName']) ?: 'du';
            $text = "Hej {$name},\n\n"
                . "Någon (förhoppningsvis du) begärde att återställa lösenordet för det här kontot.\n\n"
                . "Sätt ett nytt lösenord här — länken gäller i 30 minuter:\n{$link}\n\n"
                . "Begärde du inte det här kan du ignorera mejlet, inget ändras förrän länken används.\n";
            $this->mailer->send($email, 'Återställ ditt lösenord', $text);
        }

        Response::ok(['sent' => true]);
    }

    /** POST /api/auth/reset-password — {token, password}. */
    public function reset(Request $req, array $args): void
    {
        $body = $req->json();
        $token = (string) ($body['token'] ?? '');
        $password = (string) ($body['password'] ?? '');
        if ($token === '' || strlen($password) < 8) {
            Response::error('VALIDATION_ERROR', 'Ogiltig länk eller för kort lösenord (minst 8 tecken).', 400);
        }

        if (!$this->auth->resetPassword($token, $password)) {
            Response::error('INVALID_TOKEN', 'Länken är ogiltig eller har gått ut. Begär en ny.', 400);
        }
        Response::ok(['reset' => true]);
    }
}
