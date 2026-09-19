<?php
declare(strict_types=1);

// Manuell hämtning av namninsamlingens underskriftsantal från Skrivunder.com.
// Ersätter api/sync-signatures.js (Vercel-cron + lokal .bat) — ingen cron här,
// admin klickar "Hämta från Skrivunder" i inställningarna (AdminSettings.tsx)
// och sparar sedan som vanligt. Skrivunder skyddas ibland av Cloudflare, så
// anropet kan misslyckas — det är inget fel i sig, bara ett känt villkor
// (se MIGRATION_PLAN.md, avsnitt 6).
final class SignaturesController
{
    public function __construct(
        private readonly Auth $auth,
        private readonly JsonStore $store,
        private readonly string $petitionUrlConfig,
    ) {}

    /** GET /api/sync-signatures -> {count:number} */
    public function sync(Request $req, array $args): void
    {
        $this->auth->requireAdmin();

        $settings = $this->store->read('settings.json') ?? [];
        $url = (string) ($settings['petition_url'] ?? $this->petitionUrlConfig);
        if ($url === '') {
            Response::error('VALIDATION_ERROR', 'Ingen Skrivunder-URL är konfigurerad (Inställningar eller PETITION_URL).', 400);
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        ]);
        $html = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($html === false || $status >= 400) {
            Response::error('FETCH_FAILED', "Kunde inte hämta sidan (HTTP {$status}). Skrivunder kan blockera automatiska anrop.", 502);
        }
        if (!preg_match('/signatureAmount[^>]*>\s*([\d\s\x{00A0}]+)</u', (string) $html, $m)) {
            Response::error('PARSE_FAILED', 'Kunde inte hitta antalet underskrifter på sidan — sidans struktur kan ha ändrats.', 502);
        }

        $count = (int) preg_replace('/\D/u', '', $m[1]);
        Response::ok(['count' => $count]);
    }
}
