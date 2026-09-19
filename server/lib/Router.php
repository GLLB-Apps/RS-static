<?php
declare(strict_types=1);

// Minimal router. Mönster som "/pages/{slug}" matchas mot sökvägen och
// parametrar skickas till handlern. Okänd rutt → 404 i JSON-format.
final class Router
{
    /** @var array<int,array{method:string,regex:string,params:string[],handler:callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_]+)\}#', static function (array $m) use (&$params): string {
            $params[] = $m[1];
            return '([^/]+)';
        }, $pattern);

        $this->routes[] = [
            'method'  => strtoupper($method),
            'regex'   => '#^' . $regex . '$#',
            'params'  => $params,
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $req): never
    {
        $pathMatched = false;
        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $req->path, $m)) {
                continue;
            }
            $pathMatched = true;
            if ($route['method'] !== $req->method) {
                continue;
            }
            $args = [];
            foreach ($route['params'] as $i => $name) {
                $args[$name] = $m[$i + 1];
            }
            ($route['handler'])($req, $args);
            Response::error('NO_RESPONSE', 'Endpoint returnerade inget svar.', 500);
        }

        // Rätt sökväg men fel metod → 405; annars 404.
        $pathMatched
            ? Response::error('METHOD_NOT_ALLOWED', 'Metoden stöds inte för denna resurs.', 405)
            : Response::error('NOT_FOUND', 'Resursen finns inte.', 404);
    }
}
