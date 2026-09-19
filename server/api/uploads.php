<?php
declare(strict_types=1);

// Filuppladdning till uploads/images eller uploads/documents, beroende på
// MIME-typ. Ersätter Appwrite Storage (en bucket, publik läsning,
// admin/medlem skriver — se README:s behörighetstabell).
final class UploadsController
{
    private const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

    /** Tillåtna MIME-typer -> filändelse. Allt annat avvisas. */
    private const ALLOWED = [
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'image/webp'      => 'webp',
        'image/gif'       => 'gif',
        'image/svg+xml'   => 'svg',
        'application/pdf' => 'pdf',
        'video/mp4'       => 'mp4',
        'video/webm'      => 'webm',
    ];

    public function __construct(
        private readonly Auth $auth,
        private readonly string $uploadsDir,
    ) {}

    /** POST /api/uploads — multipart/form-data, fältet "file". */
    public function upload(Request $req, array $args): void
    {
        $this->auth->requireMember();
        $this->auth->requireCsrf($req);

        $file = $_FILES['file'] ?? null;
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('VALIDATION_ERROR', 'Ingen fil togs emot.', 400);
        }
        if ($file['size'] > self::MAX_BYTES) {
            Response::error('VALIDATION_ERROR', 'Filen är för stor (max 20 MB).', 400);
        }

        $mime = (string) (mime_content_type($file['tmp_name']) ?: '');
        $ext = self::ALLOWED[$mime] ?? null;
        if ($ext === null) {
            Response::error('VALIDATION_ERROR', "Filtypen stöds inte ({$mime}).", 400);
        }

        $subdir = str_starts_with($mime, 'image/') ? 'images' : 'documents';
        $dir = rtrim($this->uploadsDir, '/\\') . '/' . $subdir;
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            Response::error('INTERNAL_ERROR', 'Kunde inte skapa uppladdningskatalog.', 500);
        }

        // Slumpat filnamn: inget beroende av det ursprungliga (path traversal,
        // krockar, konstiga tecken) — originalnamnet behövs inte efteråt.
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $name)) {
            Response::error('INTERNAL_ERROR', 'Kunde inte spara filen.', 500);
        }

        Response::ok(['url' => "/uploads/{$subdir}/{$name}"], 201);
    }
}
