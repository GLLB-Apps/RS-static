<?php
declare(strict_types=1);

// Best-effort AI-översättning av commit-rubriker för ändringsloggens
// GitHub-import (ChangelogImport.tsx). Ersätter api/translate-commits.js
// (Vercel + Anthropic SDK) med ett rakt curl-anrop från PHP-servern.
//
// Ingen hård AI-beroende: saknas ANTHROPIC_API_KEY, eller går anropet inte
// att nå, returneras rubrikerna oöversatta i stället för ett fel — klienten
// visar dem på engelska och redaktören kan skriva om för hand.
final class ChangelogController
{
    public function __construct(
        private readonly Auth $auth,
        private readonly string $anthropicApiKey,
    ) {}

    /** POST /api/changelog/translate — {subjects: string[]} -> {titles: string[]}. */
    public function translate(Request $req, array $args): void
    {
        $this->auth->requireAdmin();
        $this->auth->requireCsrf($req);

        $subjects = $req->json()['subjects'] ?? null;
        if (!is_array($subjects) || $subjects === []) {
            Response::error('VALIDATION_ERROR', 'subjects krävs.', 400);
        }
        $subjects = array_values(array_map('strval', $subjects));

        if ($this->anthropicApiKey === '') {
            Response::ok(['titles' => $subjects]);
        }

        Response::ok(['titles' => $this->callAnthropic($subjects) ?? $subjects]);
    }

    /** @param list<string> $subjects @return list<string>|null */
    private function callAnthropic(array $subjects): ?array
    {
        $numbered = [];
        foreach ($subjects as $i => $s) {
            $numbered[] = ($i + 1) . '. ' . $s;
        }
        $prompt = "Översätt varje commit-rubrik till naturlig, kort svenska för en ändringslogg riktad till redaktionen. "
            . "Svara ENDAST med en JSON-array av strängar, exakt " . count($subjects) . " element i samma ordning som indata — ingen annan text.\n\n"
            . implode("\n", $numbered);

        $payload = json_encode([
            'model'      => 'claude-haiku-4-5-20251001',
            'max_tokens' => 1024,
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
            CURLOPT_TIMEOUT        => 20,
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
        $titles = json_decode($m[0], true);
        return is_array($titles) && count($titles) === count($subjects) ? array_values(array_map('strval', $titles)) : null;
    }
}
