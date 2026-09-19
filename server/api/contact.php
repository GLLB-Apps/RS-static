<?php
declare(strict_types=1);

// Publik endpoint för kontaktformuläret. Ersätter api/contact.js (Vercel).
// Läser leveranssätt från data/settings.json (contact_delivery: system/email/
// both) och skickar valfritt vidare via Mailer (PHP mail() som standard,
// Resend om det är konfigurerat — se server/lib/Mailer.php). Sparar alltid i
// contact_messages utom när e-post är det enda sättet OCH lyckades — annars
// försvinner meddelandet om utskicket misslyckas.
final class ContactController
{
    public function __construct(
        private readonly JsonStore $store,
        private readonly PDO $db,
        private readonly Mailer $mailer,
    ) {}

    public function submit(Request $req, array $args): void
    {
        $body = $req->json();

        // Honeypot: dolt fält för besökare, ofta ifyllt av botar. Låtsas
        // lyckas utan att spara eller skicka något.
        if (trim((string) ($body['website'] ?? '')) !== '') {
            Response::ok(['sent' => true]);
        }

        $name = trim((string) ($body['name'] ?? ''));
        $email = trim((string) ($body['email'] ?? ''));
        $subject = trim((string) ($body['subject'] ?? ''));
        $message = trim((string) ($body['message'] ?? ''));
        if ($name === '' || $email === '' || $message === '' || !str_contains($email, '@')) {
            Response::error('VALIDATION_ERROR', 'Namn, giltig e-post och meddelande krävs.', 400);
        }

        $settings = $this->store->read('settings.json') ?? [];
        $delivery = $settings['contact_delivery'] ?? 'system';

        $emailSent = false;
        if ($delivery === 'email' || $delivery === 'both') {
            $to = $settings['contact_recipient'] ?? $settings['contact_email'] ?? null;
            if (is_string($to) && $to !== '') {
                $from = is_string($settings['contact_from'] ?? null) && $settings['contact_from'] !== ''
                    ? $settings['contact_from']
                    : null; // null = Mailerns egen standardavsändare (se config.php: mail_from_address).
                $emailSent = $this->mailer->send(
                    $to,
                    $subject !== '' ? $subject : 'Meddelande från kontaktformuläret',
                    "Från: {$name} <{$email}>\n\n{$message}",
                    replyTo: $email,
                    fromOverride: $from,
                );
            }
        }

        if ($delivery !== 'email' || !$emailSent) {
            (new SqliteCollection($this->db, 'contact_messages', ['name', 'email', 'subject', 'message', 'status', 'internal_note']))
                ->insert(['name' => $name, 'email' => $email, 'subject' => $subject, 'message' => $message, 'status' => 'unread']);
        }

        Response::ok(['sent' => true]);
    }
}
