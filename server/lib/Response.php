<?php
declare(strict_types=1);

// Gemensamt JSON-svarsformat: { success, data, error }. Alla endpoints svarar
// via dessa hjälpare så att klienten alltid får samma struktur och rätt HTTP-kod.
final class Response
{
    /** @param mixed $data */
    public static function ok($data = null, int $status = 200): never
    {
        self::send(['success' => true, 'data' => $data, 'error' => null], $status);
    }

    public static function error(string $code, string $message, int $status = 400): never
    {
        self::send([
            'success' => false,
            'data'    => null,
            'error'   => ['code' => $code, 'message' => $message],
        ], $status);
    }

    /** @param array<string,mixed> $payload */
    private static function send(array $payload, int $status): never
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
            header('X-Content-Type-Options: nosniff');
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
