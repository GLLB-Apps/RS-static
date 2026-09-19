<?php
declare(strict_types=1);

// Best-effort ändringslogg. Skrivs direkt från servern (aldrig via den
// generiska /api/data/{table}-endpointen — audit_log är medvetet INTE
// registrerad i DataController::TABLES, så klienten kan varken läsa eller
// skriva den och därmed inte manipulera loggen).
//
// En trasig audit-skrivning ska aldrig stoppa den riktiga skrivningen den
// beskriver, så fel sväljs tyst här.
final class Audit
{
    /** @param array<string,mixed> $details */
    public static function log(PDO $db, ?string $userId, string $action, string $entityType, string $entityId, array $details = []): void
    {
        try {
            $stmt = $db->prepare(
                'INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details, created_at)
                 VALUES (:id, :user_id, :action, :entity_type, :entity_id, :details, :created_at)'
            );
            $stmt->execute([
                'id'          => bin2hex(random_bytes(10)),
                'user_id'     => $userId,
                'action'      => $action,
                'entity_type' => $entityType,
                'entity_id'   => $entityId,
                'details'     => json_encode($details, JSON_UNESCAPED_UNICODE) ?: '{}',
                'created_at'  => (new DateTimeImmutable())->format(DATE_ATOM),
            ]);
        } catch (\Throwable) {
            // Best-effort — se klasskommentaren.
        }
    }
}
