<?php
declare(strict_types=1);

// Importerar riktigt innehåll från produktions-Appwrite (NCC-Draft-RS) in i
// den här installationen: JSON-filer för redaktionellt innehåll, SQLite för
// konton/meddelanden/vittnesmål, och nedladdning av alla filer i
// Storage-bucketen (med URL:er omskrivna till lokala /uploads/-sökvägar,
// oavsett var i strukturen de dyker upp — även nästlade i content-block).
//
// Läser Appwrite-uppkopplingen från en .env-liknande fil (samma format som
// NCC-Draft-RS/.env.local) — antingen sökvägen som pekas ut av --env=, eller
// standardplatsen ../NCC-Stenbrott-Johanna/NCC-Draft-RS/.env.local relativt
// projektroten.
//
// Skriver INTE över befintliga poster (JSON-filer eller SQLite-rader) utan
// --force. Kontons riktiga lösenord går aldrig att exportera från Appwrite —
// nya slumpade lösenord skapas för konton som inte redan finns lokalt och
// sparas i import/generated-passwords.txt (git-ignorerad).
//
// Körning:
//   php scripts/import-appwrite-data.php
//   php scripts/import-appwrite-data.php --env=/path/till/.env.local
//   php scripts/import-appwrite-data.php --force
//   php scripts/import-appwrite-data.php --skip-files
//   php scripts/import-appwrite-data.php --only=topics,posts,pages

require dirname(__DIR__) . '/server/lib/JsonStore.php';
require dirname(__DIR__) . '/server/lib/RowFilter.php';
require dirname(__DIR__) . '/server/lib/JsonCollection.php';
require dirname(__DIR__) . '/server/lib/Db.php';
require dirname(__DIR__) . '/server/lib/SqliteCollection.php';

$root = dirname(__DIR__);
$config = require $root . '/server/config.php';

// ---- argument ---------------------------------------------------------------
$args = [];
foreach (array_slice($argv, 1) as $a) {
    if (str_starts_with($a, '--') && str_contains($a, '=')) {
        [$k, $v] = explode('=', substr($a, 2), 2);
        $args[$k] = $v;
    } elseif (str_starts_with($a, '--')) {
        $args[substr($a, 2)] = true;
    }
}
$force = isset($args['force']);
$skipFiles = isset($args['skip-files']);
$only = isset($args['only']) ? array_map('trim', explode(',', (string) $args['only'])) : null;

function includeTable(?array $only, string $table): bool
{
    return $only === null || in_array($table, $only, true);
}

// ---- Appwrite-uppkoppling ----------------------------------------------------
$envPath = $args['env'] ?? ($root . '/../NCC-Stenbrott-Johanna/NCC-Draft-RS/.env.local');
if (!is_readable($envPath)) {
    fwrite(STDERR, "Hittar inte Appwrite-uppgifter: {$envPath}\n");
    fwrite(STDERR, "Ange --env=/sökväg/till/.env.local (samma format som NCC-Draft-RS/.env.local).\n");
    exit(1);
}
$aw = [];
foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if ($line === '' || $line[0] === '#') {
        continue;
    }
    [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
    $aw[trim($k)] = trim($v);
}
foreach (['VITE_APPWRITE_ENDPOINT', 'VITE_APPWRITE_PROJECT_ID', 'VITE_APPWRITE_DATABASE_ID', 'VITE_APPWRITE_BUCKET_ID', 'APPWRITE_API_KEY'] as $required) {
    if (empty($aw[$required])) {
        fwrite(STDERR, "Saknar {$required} i {$envPath}\n");
        exit(1);
    }
}

// ---- liten Appwrite REST-klient ----------------------------------------------
final class AppwriteClient
{
    public function __construct(
        private readonly string $endpoint,
        private readonly string $project,
        private readonly string $apiKey,
    ) {}

    /** @param list<string> $queries JSON-kodade Appwrite-query-objekt. @return array<string,mixed> */
    private function get(string $path, array $queries = []): array
    {
        $qs = '';
        foreach ($queries as $q) {
            $qs .= '&queries[]=' . rawurlencode($q);
        }
        $url = rtrim($this->endpoint, '/') . $path . ($qs !== '' ? '?' . ltrim($qs, '&') : '');

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => [
                'X-Appwrite-Project: ' . $this->project,
                'X-Appwrite-Key: ' . $this->apiKey,
            ],
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false) {
            throw new RuntimeException("Appwrite-anrop misslyckades: {$path}");
        }
        $data = json_decode($raw, true);
        if ($status >= 400) {
            $msg = is_array($data) ? ($data['message'] ?? $raw) : $raw;
            throw new RuntimeException("Appwrite {$status} @ {$path}: {$msg}");
        }
        return is_array($data) ? $data : [];
    }

    /** @return list<array<string,mixed>> */
    public function listAllDocuments(string $databaseId, string $collectionId): array
    {
        $all = [];
        $cursor = null;
        do {
            $queries = [json_encode(['method' => 'limit', 'values' => [100]])];
            if ($cursor !== null) {
                $queries[] = json_encode(['method' => 'cursorAfter', 'values' => [$cursor]]);
            }
            $data = $this->get("/databases/{$databaseId}/collections/{$collectionId}/documents", $queries);
            $docs = $data['documents'] ?? [];
            foreach ($docs as $d) {
                $all[] = $d;
            }
            $cursor = count($docs) > 0 ? $docs[count($docs) - 1]['$id'] : null;
        } while (count($docs) === 100);
        return $all;
    }

    /** @return list<array<string,mixed>> */
    public function listAllUsers(): array
    {
        $all = [];
        $cursor = null;
        do {
            $queries = [json_encode(['method' => 'limit', 'values' => [100]])];
            if ($cursor !== null) {
                $queries[] = json_encode(['method' => 'cursorAfter', 'values' => [$cursor]]);
            }
            $data = $this->get('/users', $queries);
            $users = $data['users'] ?? [];
            foreach ($users as $u) {
                $all[] = $u;
            }
            $cursor = count($users) > 0 ? $users[count($users) - 1]['$id'] : null;
        } while (count($users) === 100);
        return $all;
    }

    /** @return list<array<string,mixed>> */
    public function listAllBucketFiles(string $bucketId): array
    {
        $all = [];
        $cursor = null;
        do {
            $queries = [json_encode(['method' => 'limit', 'values' => [100]])];
            if ($cursor !== null) {
                $queries[] = json_encode(['method' => 'cursorAfter', 'values' => [$cursor]]);
            }
            $data = $this->get("/storage/buckets/{$bucketId}/files", $queries);
            $files = $data['files'] ?? [];
            foreach ($files as $f) {
                $all[] = $f;
            }
            $cursor = count($files) > 0 ? $files[count($files) - 1]['$id'] : null;
        } while (count($files) === 100);
        return $all;
    }

    public function downloadFile(string $bucketId, string $fileId, string $destPath): bool
    {
        $url = rtrim($this->endpoint, '/') . "/storage/buckets/{$bucketId}/files/{$fileId}/view";
        $fp = fopen($destPath, 'wb');
        if ($fp === false) {
            return false;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => [
                'X-Appwrite-Project: ' . $this->project,
                'X-Appwrite-Key: ' . $this->apiKey,
            ],
            CURLOPT_FILE    => $fp,
            CURLOPT_TIMEOUT => 60,
        ]);
        $ok = curl_exec($ch) !== false;
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        fclose($fp);
        if (!$ok || $status >= 300) {
            @unlink($destPath);
            return false;
        }
        return true;
    }
}

$client = new AppwriteClient($aw['VITE_APPWRITE_ENDPOINT'], $aw['VITE_APPWRITE_PROJECT_ID'], $aw['APPWRITE_API_KEY']);
$dbId = $aw['VITE_APPWRITE_DATABASE_ID'];
$bucketId = $aw['VITE_APPWRITE_BUCKET_ID'];

$stats = [];
$note = function (string $table, string $msg) use (&$stats): void {
    $prev = $stats[$table] ?? '';
    $stats[$table] = $prev . ($prev !== '' ? '; ' : '') . $msg;
};

// ---- steg 1: ladda ner alla filer i bucketen, bygg fileId -> lokal URL --------
$fileMap = [];
if (!$skipFiles) {
    fwrite(STDOUT, "Hämtar fillista från Storage...\n");
    $files = $client->listAllBucketFiles($bucketId);
    fwrite(STDOUT, count($files) . " filer att ladda ner.\n");

    $extFromMime = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif',
        'image/svg+xml' => 'svg', 'image/heic' => 'heic', 'application/pdf' => 'pdf',
        'video/mp4' => 'mp4', 'video/webm' => 'webm',
    ];
    $done = 0;
    foreach ($files as $f) {
        $fileId = $f['$id'];
        $mime = $f['mimeType'] ?? '';
        $subdir = str_starts_with($mime, 'image/') ? 'images' : 'documents';
        $extFromName = pathinfo((string) ($f['name'] ?? ''), PATHINFO_EXTENSION);
        $ext = $extFromMime[$mime] ?? ($extFromName ?: 'bin');
        $localName = $fileId . '.' . strtolower($ext);
        $destDir = $config['uploads_dir'] . '/' . $subdir;
        if (!is_dir($destDir)) {
            mkdir($destDir, 0775, true);
        }
        $destPath = $destDir . '/' . $localName;
        $localUrl = "/uploads/{$subdir}/{$localName}";

        if (is_file($destPath) && !$force) {
            $fileMap[$fileId] = $localUrl;
            continue;
        }
        if ($client->downloadFile($bucketId, $fileId, $destPath)) {
            $fileMap[$fileId] = $localUrl;
            $done++;
        } else {
            fwrite(STDERR, "  kunde inte ladda ner fil {$fileId} ({$f['name']})\n");
        }
    }
    fwrite(STDOUT, "{$done} filer nedladdade (" . (count($files) - $done) . " redan fanns eller misslyckades).\n\n");
} else {
    fwrite(STDOUT, "--skip-files: hoppar över filnedladdning, URL:er skrivs om ändå om filerna redan finns lokalt.\n\n");
}

/**
 * Går igenom hela strukturen och skriver om varje sträng som pekar på en
 * Appwrite Storage-fil (view- eller download-URL) till motsvarande lokala
 * /uploads/-sökväg — oavsett hur djupt nästlad den är (t.ex. bildfält inuti
 * content-block). Strängar som inte matchar mönstret lämnas orörda.
 * @param mixed $value
 * @return mixed
 */
function rewriteFileUrls($value, array $fileMap, string $bucketId)
{
    if (is_array($value)) {
        foreach ($value as $k => $v) {
            $value[$k] = rewriteFileUrls($v, $fileMap, $bucketId);
        }
        return $value;
    }
    if (is_string($value) && str_contains($value, "/buckets/{$bucketId}/files/")) {
        if (preg_match('#/buckets/' . preg_quote($bucketId, '#') . '/files/([^/]+)/(?:view|download)#', $value, $m)) {
            return $fileMap[$m[1]] ?? $value;
        }
    }
    return $value;
}

/** JSON_FIELDS-strängar (se historiska src/lib/supabase.ts) avkodas till riktiga strukturer. */
function decodeJsonFields(array $doc, array $fields): array
{
    foreach ($fields as $f) {
        if (isset($doc[$f]) && is_string($doc[$f])) {
            $decoded = json_decode($doc[$f], true);
            $doc[$f] = $decoded ?? ($doc[$f] === 'null' ? null : $doc[$f]);
        }
    }
    return $doc;
}

/** Appwrites systemfält -> samma fältnamn som JsonCollection redan använder. @return array<string,mixed> */
function fromAppwriteDoc(array $doc, array $jsonFields, array $fileMap, string $bucketId): array
{
    $id = $doc['$id'];
    $createdAt = $doc['$createdAt'];
    $updatedAt = $doc['$updatedAt'];
    foreach ($doc as $k => $_) {
        if (str_starts_with($k, '$')) {
            unset($doc[$k]);
        }
    }
    $doc = decodeJsonFields($doc, $jsonFields);
    $doc = rewriteFileUrls($doc, $fileMap, $bucketId);
    $doc['id'] = $id;
    $doc['created_at'] = $createdAt;
    $doc['updated_at'] = $updatedAt;
    return $doc;
}

$store = new JsonStore($config['data_dir'], $config['data_dir'] . '/revisions');

/** @var array<string,list<string>> */
$JSON_FIELDS = [
    'topics' => ['content'],
    'posts' => ['content', 'tags'],
    'site_settings' => ['social_links', 'background_blocks', 'hero_buttons', 'important_dates'],
    'pages' => ['texts', 'blocks'],
    'custom_pages' => ['blocks'],
    'map_areas' => ['points'],
];

// ---- steg 2: JSON-kollektioner (allt utom site_settings, som är en flat fil) --
$jsonTables = [
    'pages', 'navigation_items', 'topics', 'posts', 'faq_categories', 'faq_items',
    'documents', 'media_items', 'timeline_events', 'contacts', 'custom_icons',
    'changelog_entries', 'custom_pages', 'sponsors', 'map_locations', 'map_areas',
];
foreach ($jsonTables as $table) {
    if (!includeTable($only, $table)) {
        continue;
    }
    fwrite(STDOUT, "Importerar {$table}...\n");
    $docs = $client->listAllDocuments($dbId, $table);
    $col = new JsonCollection($store, $table);
    $imported = 0;
    $skipped = 0;
    foreach ($docs as $doc) {
        $row = fromAppwriteDoc($doc, $JSON_FIELDS[$table] ?? [], $fileMap, $bucketId);
        if (!$force && $col->get($row['id']) !== null) {
            $skipped++;
            continue;
        }
        $col->upsert($row['id'], $row);
        $imported++;
    }
    $note($table, "{$imported} importerade, {$skipped} redan fanns");
}

// ---- steg 3: site_settings (en enda fil) --------------------------------------
if (includeTable($only, 'site_settings')) {
    fwrite(STDOUT, "Importerar site_settings...\n");
    $docs = $client->listAllDocuments($dbId, 'site_settings');
    if (count($docs) > 0 && ($force || $store->read('settings.json') === null)) {
        $row = fromAppwriteDoc($docs[0], $JSON_FIELDS['site_settings'], $fileMap, $bucketId);
        $row['id'] = 'settings';
        $store->write('settings.json', $row);
        $note('site_settings', 'importerad');
    } else {
        $note('site_settings', count($docs) === 0 ? 'inga rader i Appwrite' : 'fanns redan lokalt (kör med --force för att skriva över)');
    }
}

// ---- steg 4: konton (user_roles + profiles + intranet_members + Users) -------
if (includeTable($only, 'users')) {
    fwrite(STDOUT, "Importerar konton (user_roles + profiles + intranet_members + Appwrite Users)...\n");
    $awUsers = $client->listAllUsers();
    $roles = $client->listAllDocuments($dbId, 'user_roles');
    $profiles = $client->listAllDocuments($dbId, 'profiles');
    $members = $client->listAllDocuments($dbId, 'intranet_members');

    /** @var array<string,array<string,mixed>> */
    $merged = [];
    foreach ($awUsers as $u) {
        $merged[$u['$id']] = [
            'id' => $u['$id'],
            'email' => $u['email'],
            'display_name' => $u['name'] ?: '',
            'intro' => '',
            'role' => null,
            'intranet_member' => 0,
            'intranet_read_only' => 0,
            'intranet_added_by' => '',
            'intranet_note' => '',
            'notifications_seen' => '{}',
            'notifications_cleared_at' => null,
            'created_at' => $u['registration'] ?? (new DateTimeImmutable())->format(DATE_ATOM),
        ];
    }
    foreach ($profiles as $p) {
        if (!isset($merged[$p['$id']])) {
            continue;
        }
        $merged[$p['$id']]['display_name'] = $p['display_name'] ?? $merged[$p['$id']]['display_name'];
        $merged[$p['$id']]['intro'] = $p['intro'] ?? '';
        $seen = $p['notifications_seen'] ?? null;
        $merged[$p['$id']]['notifications_seen'] = is_string($seen) ? $seen : (json_encode($seen ?? new stdClass()) ?: '{}');
        $merged[$p['$id']]['notifications_cleared_at'] = $p['notifications_cleared_at'] ?? null;
    }
    foreach ($roles as $r) {
        if (isset($merged[$r['user_id']])) {
            $merged[$r['user_id']]['role'] = $r['role'];
        }
    }
    foreach ($members as $m) {
        if (isset($merged[$m['user_id']])) {
            $merged[$m['user_id']]['intranet_member'] = 1;
            $merged[$m['user_id']]['intranet_read_only'] = !empty($m['read_only']) ? 1 : 0;
            $merged[$m['user_id']]['intranet_added_by'] = $m['added_by'] ?? '';
            $merged[$m['user_id']]['intranet_note'] = $m['note'] ?? '';
        }
    }

    $db = Db::get($config['db_path']);
    $pdo = $db;
    $generated = [];
    $imported = 0;
    $updated = 0;
    foreach ($merged as $u) {
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
        $stmt->execute(['email' => $u['email']]);
        $existing = $stmt->fetch();

        if ($existing !== false) {
            // Kontot finns redan lokalt (t.ex. superadmin från install.php) —
            // uppdatera roll/intranät/profil, men rör aldrig lösenordet.
            $upd = $pdo->prepare(
                'UPDATE users SET display_name = :name, intro = :intro, role = :role,
                 intranet_member = :im, intranet_read_only = :iro, intranet_added_by = :iab, intranet_note = :inote,
                 notifications_seen = :seen, notifications_cleared_at = :cleared, updated_at = :u
                 WHERE id = :id'
            );
            $upd->execute([
                'name' => $u['display_name'], 'intro' => $u['intro'], 'role' => $u['role'],
                'im' => $u['intranet_member'], 'iro' => $u['intranet_read_only'],
                'iab' => $u['intranet_added_by'], 'inote' => $u['intranet_note'],
                'seen' => $u['notifications_seen'], 'cleared' => $u['notifications_cleared_at'],
                'u' => (new DateTimeImmutable())->format(DATE_ATOM), 'id' => $existing['id'],
            ]);
            $updated++;
            continue;
        }

        $password = bin2hex(random_bytes(9)); // 18 tecken, slumpat — riktiga lösenord går inte att exportera från Appwrite.
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $ins = $pdo->prepare(
            'INSERT INTO users (id, email, password_hash, display_name, intro, role, intranet_member, intranet_read_only,
             intranet_added_by, intranet_note, notifications_seen, notifications_cleared_at, created_at, updated_at)
             VALUES (:id, :email, :hash, :name, :intro, :role, :im, :iro, :iab, :inote, :seen, :cleared, :c, :u)'
        );
        $ins->execute([
            'id' => $u['id'], 'email' => $u['email'], 'hash' => password_hash($password, PASSWORD_DEFAULT),
            'name' => $u['display_name'], 'intro' => $u['intro'], 'role' => $u['role'],
            'im' => $u['intranet_member'], 'iro' => $u['intranet_read_only'],
            'iab' => $u['intranet_added_by'], 'inote' => $u['intranet_note'],
            'seen' => $u['notifications_seen'], 'cleared' => $u['notifications_cleared_at'],
            'c' => $u['created_at'], 'u' => $now,
        ]);
        $generated[] = $u['email'] . "\t" . $password;
        $imported++;
    }
    $note('users', "{$imported} nya konton, {$updated} befintliga uppdaterade");

    if ($generated !== []) {
        $importDir = $root . '/import';
        if (!is_dir($importDir)) {
            mkdir($importDir, 0775, true);
        }
        $pwFile = $importDir . '/generated-passwords.txt';
        file_put_contents(
            $pwFile,
            "Slumpade lösenord för nyimporterade konton (Appwrite lämnar aldrig ut riktiga lösenord).\n"
            . "Dela ut manuellt eller be personen byta lösenord vid första inloggning.\n\n"
            . implode("\n", $generated) . "\n"
        );
        fwrite(STDOUT, "Slumpade lösenord för " . count($generated) . " nya konton sparade i: {$pwFile}\n");
    }
}

// ---- steg 5: kontaktmeddelanden, vittnesmål, vittnesmålskontakter (SQLite) ----
$db = Db::get($config['db_path']);

if (includeTable($only, 'contact_messages')) {
    fwrite(STDOUT, "Importerar contact_messages...\n");
    $col = new SqliteCollection($db, 'contact_messages', ['name', 'email', 'subject', 'message', 'status', 'internal_note']);
    $docs = $client->listAllDocuments($dbId, 'contact_messages');
    $imported = 0;
    $skipped = 0;
    foreach ($docs as $doc) {
        $row = fromAppwriteDoc($doc, [], $fileMap, $bucketId);
        if (!$force && $col->get($row['id']) !== null) {
            $skipped++;
            continue;
        }
        $col->upsert($row['id'], $row);
        $imported++;
    }
    $note('contact_messages', "{$imported} importerade, {$skipped} redan fanns");
}

if (includeTable($only, 'testimonies')) {
    fwrite(STDOUT, "Importerar testimonies + testimony_contacts...\n");
    $col = new SqliteCollection($db, 'testimonies', [
        'title', 'story', 'author_name', 'is_anonymous', 'email', 'location', 'area_usage',
        'featured_image', 'map_lat', 'map_lng', 'status', 'consent_publish', 'consent_contact',
        'consent_marketing', 'internal_note', 'published_at',
    ]);
    $contactCol = new SqliteCollection($db, 'testimony_contacts', ['testimony_id', 'email', 'author_name', 'internal_note']);
    $docs = $client->listAllDocuments($dbId, 'testimonies');
    $contactDocs = $client->listAllDocuments($dbId, 'testimony_contacts');
    $imported = 0;
    $skipped = 0;
    foreach ($docs as $doc) {
        $row = fromAppwriteDoc($doc, [], $fileMap, $bucketId);
        if (!$force && $col->get($row['id']) !== null) {
            $skipped++;
            continue;
        }
        $col->upsert($row['id'], $row);
        $imported++;
    }
    $note('testimonies', "{$imported} importerade, {$skipped} redan fanns");

    $cImported = 0;
    $cSkipped = 0;
    foreach ($contactDocs as $doc) {
        $row = fromAppwriteDoc($doc, [], $fileMap, $bucketId);
        $existing = $contactCol->list(eq: ['testimony_id' => $row['testimony_id']]);
        if (!$force && $existing !== []) {
            $cSkipped++;
            continue;
        }
        $contactCol->upsert($row['id'], $row);
        $cImported++;
    }
    $note('testimony_contacts', "{$cImported} importerade, {$cSkipped} redan fanns");
}

// ---- steg 6: intranätets egna JSON-tabeller (notiser/anteckningar/uppgifter/dokument) --
$intranetJson = ['intranet_notices', 'intranet_notes', 'intranet_tasks', 'internal_doc_categories', 'internal_documents'];
foreach ($intranetJson as $table) {
    if (!includeTable($only, $table)) {
        continue;
    }
    fwrite(STDOUT, "Importerar {$table}...\n");
    $docs = $client->listAllDocuments($dbId, $table);
    $col = new JsonCollection($store, $table);
    $imported = 0;
    $skipped = 0;
    foreach ($docs as $doc) {
        $row = fromAppwriteDoc($doc, [], $fileMap, $bucketId);
        if (!$force && $col->get($row['id']) !== null) {
            $skipped++;
            continue;
        }
        $col->upsert($row['id'], $row);
        $imported++;
    }
    $note($table, "{$imported} importerade, {$skipped} redan fanns");
}

// ---- sammanfattning -----------------------------------------------------------
fwrite(STDOUT, "\n== Klart ==\n");
foreach ($stats as $table => $msg) {
    fwrite(STDOUT, sprintf("%-26s %s\n", $table, $msg));
}
fwrite(STDOUT, "\nKör med --force för att skriva över redan importerat innehåll.\n");
