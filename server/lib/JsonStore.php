<?php
declare(strict_types=1);

// Säker läsning och skrivning av JSON-innehåll.
//
// Skrivning sker aldrig direkt på plats. Flödet är:
//   1. validera att datan går att koda till JSON,
//   2. ta exklusivt fillås,
//   3. spara föregående version i revisions-katalogen,
//   4. skriv till en temporär fil i samma katalog,
//   5. kontrollera att den temporära filen innehåller giltig JSON,
//   6. byt ut originalet atomiskt (rename).
//
// Sökvägar valideras mot en tillåten baskatalog för att stoppa path traversal.
final class JsonStore
{
    public function __construct(
        private readonly string $baseDir,
        private readonly string $revisionsDir,
    ) {}

    /** Läser en JSON-fil relativt baskatalogen. Returnerar null om den saknas. */
    public function read(string $relPath): ?array
    {
        $path = $this->resolve($relPath);
        if (!is_file($path)) {
            return null;
        }
        $raw = file_get_contents($path);
        if ($raw === false) {
            return null;
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    /**
     * Läser alla *.json i en underkatalog (t.ex. "pages").
     * @return array<int,array<string,mixed>>
     */
    public function readDir(string $relDir): array
    {
        $dir = $this->resolve($relDir);
        if (!is_dir($dir)) {
            return [];
        }
        $out = [];
        foreach (glob($dir . '/*.json') ?: [] as $file) {
            $raw = file_get_contents($file);
            if ($raw === false) {
                continue;
            }
            $data = json_decode($raw, true);
            if (is_array($data)) {
                $out[] = $data;
            }
        }
        return $out;
    }

    /**
     * Skriver JSON säkert (validering, lås, revision, atomiskt byte).
     * @param array<string,mixed> $data
     * @throws RuntimeException vid fel
     */
    public function write(string $relPath, array $data): void
    {
        $path = $this->resolve($relPath);

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('Datan kunde inte kodas till JSON.');
        }

        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Kunde inte skapa katalog: ' . $dir);
        }

        // Exklusivt lås via en separat låsfil, så samtidiga skrivningar serialiseras.
        $lock = fopen($path . '.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            throw new RuntimeException('Kunde inte ta lås för skrivning.');
        }

        try {
            // 1) Spara föregående version.
            if (is_file($path)) {
                $this->saveRevision($relPath, (string) file_get_contents($path));
            }

            // 2) Skriv temporärt i samma katalog (samma filsystem → atomisk rename).
            $tmp = @tempnam($dir, 'json_');
            if ($tmp === false || file_put_contents($tmp, $json) === false) {
                throw new RuntimeException('Kunde inte skriva temporär fil.');
            }

            // 3) Verifiera att temporärfilen är giltig JSON innan bytet.
            $check = json_decode((string) file_get_contents($tmp), true);
            if (!is_array($check)) {
                @unlink($tmp);
                throw new RuntimeException('Temporärfilen validerade inte som JSON.');
            }

            // 4) Atomiskt byte.
            @chmod($tmp, 0664);
            if (!@rename($tmp, $path)) {
                @unlink($tmp);
                throw new RuntimeException('Kunde inte ersätta målfilen.');
            }
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
            @unlink($path . '.lock');
        }
    }

    /** Tar bort en JSON-fil (sparar en sista revision först). Ofarligt om den redan saknas. */
    public function delete(string $relPath): void
    {
        $path = $this->resolve($relPath);
        if (!is_file($path)) {
            return;
        }
        $this->saveRevision($relPath, (string) file_get_contents($path));
        @unlink($path);
    }

    /** Sparar en tidsstämplad kopia av föregående innehåll i revisions-katalogen. */
    private function saveRevision(string $relPath, string $previous): void
    {
        $safe = str_replace(['/', '\\'], '__', trim($relPath, '/'));
        $stamp = (new DateTimeImmutable())->format('Ymd-His');
        $revDir = $this->revisionsDir;
        if (!is_dir($revDir) && !mkdir($revDir, 0775, true) && !is_dir($revDir)) {
            return; // revision är best-effort; blockera inte skrivningen
        }
        @file_put_contents($revDir . '/' . $safe . '.' . $stamp . '.json', $previous);
    }

    /** Löser en relativ sökväg mot baskatalogen och stoppar path traversal. */
    private function resolve(string $relPath): string
    {
        $rel = str_replace('\\', '/', $relPath);
        if (str_contains($rel, '..') || str_contains($rel, "\0")) {
            throw new RuntimeException('Ogiltig sökväg.');
        }
        $rel = ltrim($rel, '/');
        $base = rtrim($this->baseDir, '/\\');
        $full = $base . '/' . $rel;

        // Säkerställ att den slutliga sökvägen ligger inom baskatalogen.
        // Jämförs med enhetliga snedstreck: om målkatalogen ännu inte finns
        // (t.ex. första skrivningen till en ny kollektion) faller realpath()
        // tillbaka på den orealiserade sökvägen, som annars kan blanda
        // bakåt-/snedstreck beroende på hur $baseDir konfigurerats och göra
        // jämförelsen falskt negativ på Windows.
        $baseReal = str_replace('\\', '/', realpath($base) ?: $base);
        $prefix = str_replace('\\', '/', realpath(dirname($full)) ?: dirname($full));
        if (!str_starts_with($prefix, $baseReal)) {
            throw new RuntimeException('Sökväg utanför tillåten katalog.');
        }
        return $full;
    }
}
