<?php
declare(strict_types=1);

// Delade hjälpfunktioner för install/index.php (färsk installation, tom
// databas) och install/migrate.php (efter en FTP-uppladdning av en sajt som
// redan har riktigt innehåll och konton). Samma install/-mapp, samma
// självradering när man är klar med endera.

/** @return array<int,array{label:string,ok:bool,detail:string}> */
function requirements(string $root): array
{
    $checks = [];
    $checks[] = [
        'label'  => 'PHP-version (8.1 eller senare)',
        'ok'     => version_compare(PHP_VERSION, '8.1.0', '>='),
        'detail' => PHP_VERSION,
    ];
    foreach (['pdo_sqlite', 'mbstring', 'fileinfo', 'dom', 'json', 'openssl', 'curl'] as $ext) {
        $ok = extension_loaded($ext);
        $checks[] = ['label' => "PHP-tillägget \"{$ext}\"", 'ok' => $ok, 'detail' => $ok ? 'Installerat' : 'Saknas'];
    }
    foreach (['data' => $root . '/data', 'uploads' => $root . '/uploads', 'database' => $root . '/database'] as $label => $dir) {
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        // Ett skrivskyddat katalogläge efter FTP är det vanligaste felet här
        // — försök rätta det själv innan vi rapporterar det som trasigt.
        if (is_dir($dir) && !is_writable($dir)) {
            @chmod($dir, 0775);
        }
        $ok = is_dir($dir) && is_writable($dir);
        $checks[] = [
            'label'  => "Skrivbar katalog: {$label}/",
            'ok'     => $ok,
            'detail' => $ok ? 'OK' : 'Saknar skrivrättighet — kör chmod -R 775 ' . $label . ' på servern',
        ];
    }
    return $checks;
}

/** true om varje krav (utom de rent informativa) är uppfyllt. */
function requirementsOk(array $checks): bool
{
    foreach ($checks as $c) {
        if (!$c['ok']) {
            return false;
        }
    }
    return true;
}

/** @return array<string,string> */
function readEnvFile(string $path): array
{
    $out = [];
    if (!is_readable($path)) {
        return $out;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        $out[trim($k)] = trim($v);
    }
    return $out;
}

/**
 * Skriver/uppdaterar .env: utgår från befintlig .env om den finns, annars
 * .env.example som mall (så kommentarerna följer med första gången), och
 * ersätter bara raderna för de nycklar som faktiskt sätts här.
 * @param array<string,string> $values
 */
function writeEnvFile(string $envPath, string $examplePath, array $values): bool
{
    $templatePath = is_file($envPath) ? $envPath : $examplePath;
    $lines = is_readable($templatePath) ? (file($templatePath, FILE_IGNORE_NEW_LINES) ?: []) : [];
    $seen = [];
    foreach ($lines as $i => $line) {
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$k] = explode('=', $line, 2);
        $k = trim($k);
        if (array_key_exists($k, $values)) {
            $lines[$i] = $k . '=' . $values[$k];
            $seen[$k] = true;
        }
    }
    foreach ($values as $k => $v) {
        if (empty($seen[$k])) {
            $lines[] = $k . '=' . $v;
        }
    }
    return file_put_contents($envPath, implode("\n", $lines) . "\n") !== false;
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function render(string $eyebrow, string $title, string $body): never
{
    echo '<!doctype html><html lang="sv"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow">'
        . '<title>' . h($title) . '</title><style>'
        . ':root{--primary:#2d5a3d;--primary-dark:#1e3f2a;--bg:#fafaf8;--card:#fff;--border:#d8ddd6;--text:#1a1a1a;--muted:#6b6f68;--ok:#2d7a3d;--bad:#b8402d;--warn:#b8860b}'
        . '*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--text);padding:2rem 1rem}'
        . '.wrap{max-width:640px;margin:0 auto}'
        . 'h1{font-size:1.4rem;margin:0 0 .25rem}.eyebrow{color:var(--muted);font-size:.85rem;margin:0 0 1.5rem}'
        . '.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.75rem}'
        . 'ul.checks{list-style:none;padding:0;margin:0 0 1.5rem}'
        . 'ul.checks li{display:flex;gap:.6rem;align-items:baseline;padding:.4rem 0;border-bottom:1px solid #eee;font-size:.92rem}'
        . 'ul.checks li:last-child{border-bottom:none}'
        . '.dot{flex-shrink:0;width:.6rem;height:.6rem;border-radius:50%;margin-top:.3rem}'
        . '.dot.ok{background:var(--ok)}.dot.bad{background:var(--bad)}.dot.warn{background:var(--warn)}'
        . '.detail{color:var(--muted);margin-left:auto;font-size:.85rem;text-align:right}'
        . 'label{display:block;font-weight:600;font-size:.85rem;margin:1rem 0 .3rem}'
        . 'label:first-of-type{margin-top:0}'
        . 'input[type=text],input[type=email],input[type=password]{width:100%;padding:.6rem .7rem;border:1px solid var(--border);border-radius:8px;font-size:1rem}'
        . '.hint{color:var(--muted);font-size:.8rem;margin:.3rem 0 0}'
        . '.error{background:#fdecea;border:1px solid #f3b8ae;color:var(--bad);padding:.7rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}'
        . '.warn-box{background:#fdf6e3;border:1px solid #e8d38a;color:#7a5c00;padding:.7rem 1rem;border-radius:8px;margin-bottom:1rem;font-size:.9rem}'
        . '.actions{display:flex;gap:.75rem;margin-top:1.5rem;flex-wrap:wrap}'
        . 'button,.btn{background:var(--primary);color:#fff;border:none;padding:.7rem 1.3rem;border-radius:8px;font-size:.95rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}'
        . 'button:hover,.btn:hover{background:var(--primary-dark)}'
        . '.btn.ghost{background:none;color:var(--text);border:1px solid var(--border)}'
        . '.steps{display:flex;gap:.4rem;margin-bottom:1.25rem}'
        . '.steps span{flex:1;height:4px;border-radius:2px;background:var(--border)}.steps span.on{background:var(--primary)}'
        . '.kv{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.85rem}'
        . '.kv th,.kv td{text-align:left;padding:.5rem .6rem;border-bottom:1px solid #eee;vertical-align:top}'
        . '.kv code{background:#f0f0ec;padding:.15rem .4rem;border-radius:4px;font-size:.85rem}'
        . '.copy-btn{background:none;border:1px solid var(--border);border-radius:6px;padding:.2rem .5rem;font-size:.75rem;cursor:pointer;margin-left:.4rem;color:var(--text)}'
        . '.copy-btn:hover{background:#f0f0ec}'
        . '</style></head><body><div class="wrap">'
        . '<p class="eyebrow">' . h($eyebrow) . '</p>'
        . $body
        . '</div></body></html>';
    exit;
}

/**
 * Valfri ruta som visas på "Klart"-sidan i båda guiderna: direktlänkar till
 * GitHubs egna sidor för att lägga in FTP-hemligheterna för den automatiska
 * driftsättningen (.github/workflows/deploy.yml, se DEPLOY.md). Hemligheterna
 * skrivs ALDRIG här eller skickas genom den här servern — GitHub stödjer inte
 * att förifylla namnet via URL, så det här är bara en genväg förbi menyerna
 * plus kopieringsknappar för namnen, inte ett formulär.
 */
function deploySetupBox(): string
{
    $secretsUrl = 'https://github.com/GLLB-Apps/RS-static/settings/secrets/actions/new';
    $varsUrl = 'https://github.com/GLLB-Apps/RS-static/settings/variables/actions/new';
    $rows = [
        ['FTP_SERVER', 'Värdnamnet till FTP-servern, t.ex. ftp.er-domän.se'],
        ['FTP_USERNAME', 'FTP-användarnamnet'],
        ['FTP_PASSWORD', 'FTP-lösenordet'],
        ['FTP_SERVER_DIR', 'Målmappen på servern, måste sluta med / — t.ex. public_html/'],
    ];
    $rowsHtml = '';
    foreach ($rows as [$name, $hint]) {
        $rowsHtml .= '<tr><td><code>' . h($name) . '</code>'
            . '<button type="button" class="copy-btn" data-copy="' . h($name) . '">Kopiera namn</button></td>'
            . '<td>' . h($hint) . '</td></tr>';
    }

    return '<div class="card" style="margin-top:1.5rem">'
        . '<h1>Valfritt: automatiska driftsättningar</h1>'
        . '<p class="hint" style="margin-bottom:1rem">Vill ni att kodändringar laddas upp automatiskt vid varje '
        . 'push till GitHub, i stället för att FTP:a för hand varje gång? Fyra hemligheter läggs in en gång — '
        . 'direkt på GitHub, aldrig här i guiden eller i koden. Fullständig genomgång i <code>DEPLOY.md</code> '
        . 'i projektet.</p>'
        . '<a class="btn ghost" href="' . h($secretsUrl) . '" target="_blank" rel="noopener">Öppna "Ny secret" på GitHub →</a>'
        . '<table class="kv"><tr><th>Namn (klistras i "Name")</th><th>Värde (klistras i "Secret")</th></tr>' . $rowsHtml . '</table>'
        . '<p class="hint">Stödjer webbhotellet bara vanlig FTP (inte FTPS)? Lägg dessutom till en <strong>variable</strong> '
        . '(inte secret), namn <code>FTP_PROTOCOL</code>, värde <code>ftp</code>, på <a href="' . h($varsUrl)
        . '" target="_blank" rel="noopener">variabelsidan</a>. Annars används FTPS automatiskt.</p>'
        . '<script>document.addEventListener("click",function(e){var b=e.target.closest(".copy-btn");if(!b)return;'
        . 'navigator.clipboard.writeText(b.dataset.copy).then(function(){var old=b.textContent;b.textContent="Kopierat!";'
        . 'setTimeout(function(){b.textContent=old;},1200);});});</script>'
        . '</div>';
}

function stepper(int $current, int $total): string
{
    $out = '<div class="steps">';
    for ($i = 1; $i <= $total; $i++) {
        $out .= '<span' . ($i <= $current ? ' class="on"' : '') . '></span>';
    }
    return $out . '</div>';
}

/** Raderar hela install/-mappen (båda skripten) och avslutar med ett svar. Aldrig false vid lyckad radering — antingen renderar den och exit:ar, eller kastar inget alls. */
function selfDestructInstallDir(): never
{
    $dir = __DIR__;
    try {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it as $file) {
            $file->isDir() ? @rmdir($file->getPathname()) : @unlink($file->getPathname());
        }
        @rmdir($dir);
        if (session_status() === PHP_SESSION_ACTIVE) {
            unset($_SESSION['install_token']);
        }
        render('Rögleskogen', 'Borttaget', '<div class="card"><h1>Installationsguiden är borttagen</h1>'
            . '<p>Allt klart. Kontrollera gärna via FTP/filhanteraren att <code>install/</code>-mappen '
            . 'verkligen är borta — på en del webbhotell hinner inte den här sidans egen fil raderas '
            . 'förrän efter att sidan visats.</p>'
            . '<p><a class="btn" href="/admin/login">Till inloggningen →</a></p></div>');
    } catch (Throwable) {
        render('Rögleskogen', 'Kunde inte radera', '<div class="card"><h1>Kunde inte radera automatiskt</h1>'
            . '<p>Radera <code>install/</code>-mappen manuellt via FTP eller webbhotellets filhanterare — '
            . 'den ska inte ligga kvar nåbar.</p>'
            . '<p><a class="btn" href="/admin/login">Till inloggningen →</a></p></div>');
    }
}
