<?php
declare(strict_types=1);

// Läser inkommande begäran: metod, sökväg (utan API-prefix), query och JSON-body.
final class Request
{
    public string $method;
    public string $path;
    /** @var array<string,string> */
    public array $query;

    public function __construct(string $apiPrefix)
    {
        $this->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $uri = '/' . trim(rawurldecode($uri), '/');
        // Ta bort API-prefixet så routern matchar mot "/pages/{slug}".
        if ($apiPrefix !== '' && str_starts_with($uri, $apiPrefix)) {
            $uri = substr($uri, strlen($apiPrefix));
        }
        $this->path = '/' . trim($uri, '/');

        /** @var array<string,string> $q */
        $q = [];
        parse_str($_SERVER['QUERY_STRING'] ?? '', $q);
        $this->query = $q;
    }

    /**
     * Avkodad JSON-body, eller [] om tom. En body som INTE är tom men som
     * misslyckas avkodas (trasig JSON, ogiltig UTF-8) avvisas hårt i stället
     * för att tyst bli [] — annars hade en trasig begäran kunnat skapa en
     * nästan tom post utan en enda felsignal.
     * @return array<string,mixed>
     */
    public function json(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || $raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            Response::error('VALIDATION_ERROR', 'Ogiltig JSON i begäran.', 400);
        }
        return $data;
    }

    /**
     * Läser en HTTP-header via $_SERVER (fungerar oavsett SAPI, till skillnad
     * från getallheaders() som saknas i vissa miljöer).
     */
    public function header(string $name): ?string
    {
        $key = 'HTTP_' . str_replace('-', '_', strtoupper($name));
        return $_SERVER[$key] ?? null;
    }
}
