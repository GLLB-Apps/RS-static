<?php
declare(strict_types=1);

// AI-skrivhjälpen i blockeditorn (AiBlockAssistant.tsx): redaktören beskriver
// vad hen vill ha, och den här bygger innehållsblock utifrån det. Samma
// curl-mot-Anthropic-mönster som ChangelogController, men egen prompt och
// striktare efterhandsstädning eftersom svaret går rakt in i innehållet
// (inte bara en rubrikrad i en granskningslista).
final class AssistController
{
    /** De blocktyper AI:n får använda — bara sådana utan riktiga URL:er/filer den inte har. */
    private const ALLOWED_TYPES = ['heading', 'paragraph', 'quote', 'list', 'factbox'];

    public function __construct(
        private readonly Auth $auth,
        private readonly string $anthropicApiKey,
    ) {}

    /** POST /api/assist/blocks — {instruction, title?} -> {blocks: ContentBlock[]}. */
    public function blocks(Request $req, array $args): void
    {
        $this->auth->requireAdmin();
        $this->auth->requireCsrf($req);

        $instruction = trim((string) ($req->json()['instruction'] ?? ''));
        if ($instruction === '') {
            Response::error('VALIDATION_ERROR', 'Beskriv vad du vill ha hjälp med.', 400);
        }
        if (mb_strlen($instruction) > 2000) {
            Response::error('VALIDATION_ERROR', 'Beskrivningen är för lång (max 2000 tecken).', 400);
        }
        $title = trim((string) ($req->json()['title'] ?? ''));

        if ($this->anthropicApiKey === '') {
            Response::error('UNAVAILABLE', 'AI-hjälpen är inte inställd på den här servern (ANTHROPIC_API_KEY saknas).', 503);
        }

        $blocks = $this->generate($instruction, $title);
        if ($blocks === null || $blocks === []) {
            Response::error('UPSTREAM_ERROR', 'Kunde inte bygga några block just nu. Försök igen, gärna med en tydligare beskrivning.', 502);
        }
        Response::ok(['blocks' => $blocks]);
    }

    /** @return list<array<string,mixed>>|null */
    private function generate(string $instruction, string $title): ?array
    {
        $context = $title !== '' ? "Sidans/artikelns rubrik: \"{$title}\"\n\n" : '';
        $prompt = $context . "Redaktörens beskrivning av vad hen vill ha hjälp med:\n{$instruction}\n\n"
            . "Bygg innehållsblock utifrån detta. Svara ENDAST med en JSON-array av block, ingen annan text, "
            . "inga kodstaket.\n\n"
            . "Varje block är ett objekt med fältet \"type\" och relevanta fält:\n"
            . "- {\"type\":\"heading\",\"text\":\"...\",\"level\":2}  (level 2-4)\n"
            . "- {\"type\":\"paragraph\",\"text\":\"...\"}\n"
            . "- {\"type\":\"quote\",\"text\":\"...\",\"title\":\"källa (valfritt)\"}\n"
            . "- {\"type\":\"list\",\"items\":[\"...\",\"...\"]}\n"
            . "- {\"type\":\"factbox\",\"title\":\"...\",\"text\":\"...\"}\n\n"
            . "Använd bara dessa fem typer — inga bilder, länkar, tabeller eller knappar (du har inga riktiga "
            . "URL:er eller filer att peka på). Skriv 3–8 block beroende på vad som efterfrågas.";

        $payload = json_encode([
            'model'      => 'claude-sonnet-5',
            'max_tokens' => 2048,
            'system'     => 'Du är en skrivassistent för Rögleskogen, ett medborgarinitiativ som bevakar '
                . 'planerna på en bergtäkt i Rögleskogen mellan Södra Sandby och Dalby. Skriv sakligt, konkret '
                . 'och på svenska. Hitta aldrig på fakta, siffror eller citat som låter som verkliga uttalanden '
                . '— håll dig till vad redaktören själv beskriver, eller skriv allmänt/tydligt hypotetiskt.',
            'messages'   => [['role' => 'user', 'content' => $prompt]],
        ], JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            return null;
        }

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => [
                'content-type: application/json',
                'x-api-key: ' . $this->anthropicApiKey,
                'anthropic-version: 2023-06-01',
            ],
            CURLOPT_RETURNTRANSFER => true,
            // Blockgenerering tar längre tid än en översatt rubrikrad — klienten
            // matchar med en egen längre timeout (se AiBlockAssistant.tsx).
            CURLOPT_TIMEOUT        => 45,
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false || $status !== 200) {
            return null;
        }

        $data = json_decode((string) $raw, true);
        $text = $data['content'][0]['text'] ?? null;
        if (!is_string($text) || !preg_match('/\[.*\]/s', $text, $m)) {
            return null;
        }
        $rawBlocks = json_decode($m[0], true);
        return is_array($rawBlocks) ? $this->sanitize($rawBlocks) : null;
    }

    /**
     * Litar aldrig blint på modellens JSON: filtrerar till kända typer och
     * plockar bara ut de fält respektive typ faktiskt använder i TapEditor.
     * @param list<mixed> $raw
     * @return list<array<string,mixed>>
     */
    private function sanitize(array $raw): array
    {
        $out = [];
        foreach ($raw as $b) {
            if (!is_array($b) || !isset($b['type']) || !in_array($b['type'], self::ALLOWED_TYPES, true)) {
                continue;
            }
            $block = ['type' => $b['type']];
            switch ($b['type']) {
                case 'heading':
                    $block['text'] = trim((string) ($b['text'] ?? ''));
                    $block['level'] = max(2, min(4, (int) ($b['level'] ?? 2)));
                    break;
                case 'paragraph':
                    $block['text'] = trim((string) ($b['text'] ?? ''));
                    break;
                case 'quote':
                    $block['text'] = trim((string) ($b['text'] ?? ''));
                    if (!empty($b['title'])) {
                        $block['title'] = trim((string) $b['title']);
                    }
                    break;
                case 'list':
                    $items = is_array($b['items'] ?? null) ? $b['items'] : [];
                    $block['items'] = array_values(array_filter(array_map(
                        static fn ($v): string => trim((string) $v),
                        $items,
                    ), static fn (string $v): bool => $v !== ''));
                    break;
                case 'factbox':
                    $block['text'] = trim((string) ($b['text'] ?? ''));
                    if (!empty($b['title'])) {
                        $block['title'] = trim((string) $b['title']);
                    }
                    break;
            }
            if (($block['text'] ?? '') === '' && ($block['items'] ?? []) === []) {
                continue;
            }
            $out[] = $block;
        }
        return $out;
    }
}
