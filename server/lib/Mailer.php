<?php
declare(strict_types=1);

// Central e-postutskickning. Två vägar:
//   - PHP:s inbyggda mail() (standard) — kräver ingen extern tjänst eller
//     API-nyckel, och fungerar direkt på ett vanligt webbhotell (t.ex.
//     Inleed), där PHP redan är konfigurerat att skicka från kontots domän.
//   - Resend (om RESEND_API_KEY är satt) — för den som redan har det, eller
//     vill ha leveransstatistik/spårning.
//
// Används av både kontaktformuläret (server/api/contact.php) och
// "skicka nytt lösenord"-knappen (server/api/users.php).
final class Mailer
{
    public function __construct(
        private readonly string $resendApiKey,
        private readonly string $fromAddress,
        private readonly string $fromName,
    ) {}

    /** @return bool true om utskicket (troligen) lyckades. */
    public function send(string $to, string $subject, string $text, ?string $replyTo = null, ?string $fromOverride = null): bool
    {
        return $this->resendApiKey !== ''
            ? $this->sendViaResend($to, $subject, $text, $replyTo, $fromOverride)
            : $this->sendViaPhpMail($to, $subject, $text, $replyTo, $fromOverride);
    }

    private function sendViaPhpMail(string $to, string $subject, string $text, ?string $replyTo, ?string $fromOverride): bool
    {
        $from = $fromOverride ?: ($this->fromName !== '' ? "{$this->fromName} <{$this->fromAddress}>" : $this->fromAddress);
        $headers = [
            'From: ' . $from,
            'Content-Type: text/plain; charset=UTF-8',
            'MIME-Version: 1.0',
        ];
        if ($replyTo !== null && $replyTo !== '') {
            $headers[] = 'Reply-To: ' . $replyTo;
        }
        // Ämnesraden måste RFC 2047-kodas för att icke-ASCII-tecken (å ä ö) ska
        // visas rätt hos mottagaren — mail() kodar den inte åt en.
        $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        return @mail($to, $encodedSubject, $text, implode("\r\n", $headers));
    }

    private function sendViaResend(string $to, string $subject, string $text, ?string $replyTo, ?string $fromOverride): bool
    {
        $from = $fromOverride ?: ($this->fromName !== '' ? "{$this->fromName} <{$this->fromAddress}>" : $this->fromAddress);
        $payload = ['from' => $from, 'to' => [$to], 'subject' => $subject, 'text' => $text];
        if ($replyTo !== null && $replyTo !== '') {
            $payload['reply_to'] = $replyTo;
        }
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return false;
        }

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            CURLOPT_HTTPHEADER     => ['content-type: application/json', 'authorization: Bearer ' . $this->resendApiKey],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $raw !== false && $status < 300;
    }
}
