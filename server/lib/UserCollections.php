<?php
declare(strict_types=1);

// Ger "user_roles", "intranet_members" och "profiles" samma
// list/get/insert/upsert/update/delete-gränssnitt (DataCollection) som
// JSON-kollektionerna, fast bakom en enda `users`-tabell i SQLite.
// Motsvarar tre separata Appwrite-kollektioner som i praktiken alla pekade på
// samma konto (user_id) — se database/schema.sql och auth.tsx.
//
// Skriver aldrig nya `users`-rader: kontot måste redan finnas (skapat via
// scripts/install.php eller självregistrering). insert()/upsert() här
// aktiverar bara en behörighet på ett befintligt konto.
abstract class UsersTableView implements DataCollection
{
    public function __construct(protected readonly PDO $db) {}

    /** SQL WHERE-fragment (utan "WHERE") som avgör vilka users-rader som syns som en rad i denna vy. '' = alla. */
    abstract protected function scopeSql(): string;

    /** @return array<string,mixed> */
    abstract protected function toRow(array $user): array;

    /** users.id för den underliggande kontoraden som en virtuell rad pekar på. */
    abstract protected function underlyingId(array $row): string;

    /** Kolumner att sätta i `users` för att skapa/uppdatera denna vys rad. @return array<string,mixed> */
    abstract protected function toColumns(array $data): array;

    public function list(array $eq = [], array $ilike = [], array $gte = [], array $lte = [], ?array $order = null, ?int $limit = null): array
    {
        $sql = 'SELECT * FROM users';
        if ($this->scopeSql() !== '') {
            $sql .= ' WHERE ' . $this->scopeSql();
        }
        $rows = array_map(fn (array $u) => $this->toRow($u), $this->db->query($sql)->fetchAll());
        return RowFilter::apply($rows, $eq, $ilike, $gte, $lte, $order, $limit);
    }

    public function get(string $id): ?array
    {
        return $this->list(eq: ['id' => $id])[0] ?? null;
    }

    public function insert(array $data): array
    {
        $userId = $this->underlyingId($data);
        $this->applyColumns($userId, $this->toColumns($data));
        return $this->get($this->rowIdFor($userId)) ?? throw new RuntimeException('NOT_FOUND');
    }

    public function upsert(string $id, array $data): array
    {
        return $this->insert(array_merge($data, ['id' => $id, 'user_id' => $data['user_id'] ?? $id]));
    }

    public function update(array $eq, array $patch): array
    {
        $updated = [];
        foreach ($this->list(eq: $eq) as $row) {
            $userId = $this->underlyingId($row);
            $this->applyColumns($userId, $this->toColumns($patch));
            $updated[] = $this->get($this->rowIdFor($userId));
        }
        return $updated;
    }

    public function delete(array $eq): int
    {
        $targets = $this->list(eq: $eq);
        foreach ($targets as $row) {
            $this->applyColumns($this->underlyingId($row), $this->deactivateColumns());
        }
        return count($targets);
    }

    /** Kolumner som "tar bort" den här vyns rad (utan att röra kontot i övrigt). */
    abstract protected function deactivateColumns(): array;

    /** Den virtuella radens eget id, för get() efter en skrivning. Samma som underlyingId() i alla tre vyerna. */
    protected function rowIdFor(string $userId): string
    {
        return $userId;
    }

    /** @param array<string,mixed> $columns */
    private function applyColumns(string $userId, array $columns): void
    {
        if ($columns === []) {
            return;
        }
        $columns['updated_at'] = (new DateTimeImmutable())->format(DATE_ATOM);
        $set = implode(', ', array_map(static fn (string $c): string => "{$c} = :{$c}", array_keys($columns)));
        $stmt = $this->db->prepare("UPDATE users SET {$set} WHERE id = :__id");
        $stmt->execute([...$columns, '__id' => $userId]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('NOT_FOUND');
        }
    }
}

/** Adminroll (superadmin/redaktor/skribent). En rad bara för konton som har en roll. */
final class UserRolesCollection extends UsersTableView
{
    protected function scopeSql(): string
    {
        return 'role IS NOT NULL';
    }

    protected function toRow(array $u): array
    {
        return ['id' => $u['id'], 'user_id' => $u['id'], 'role' => $u['role'], 'created_at' => $u['created_at']];
    }

    protected function underlyingId(array $row): string
    {
        return (string) $row['user_id'];
    }

    protected function toColumns(array $data): array
    {
        return isset($data['role']) ? ['role' => $data['role']] : [];
    }

    protected function deactivateColumns(): array
    {
        return ['role' => null];
    }
}

/** Intranätsåtkomst (medlem/läsbehörig). En rad bara för konton med intranet_member = 1. */
final class IntranetMembersCollection extends UsersTableView
{
    protected function scopeSql(): string
    {
        return 'intranet_member = 1';
    }

    protected function toRow(array $u): array
    {
        return [
            'id' => $u['id'], 'user_id' => $u['id'],
            'display_name' => $u['display_name'], 'read_only' => (bool) $u['intranet_read_only'],
            'added_by' => $u['intranet_added_by'], 'note' => $u['intranet_note'],
            'created_at' => $u['created_at'],
        ];
    }

    protected function underlyingId(array $row): string
    {
        return (string) $row['user_id'];
    }

    protected function toColumns(array $data): array
    {
        $cols = ['intranet_member' => 1];
        if (isset($data['read_only'])) $cols['intranet_read_only'] = $data['read_only'] ? 1 : 0;
        if (isset($data['display_name'])) $cols['display_name'] = $data['display_name'];
        if (isset($data['added_by'])) $cols['intranet_added_by'] = $data['added_by'];
        if (isset($data['note'])) $cols['intranet_note'] = $data['note'];
        return $cols;
    }

    protected function deactivateColumns(): array
    {
        return ['intranet_member' => 0, 'intranet_read_only' => 0];
    }
}

/**
 * Visningsnamn + presentation + notismarkeringar. En rad per konto — till
 * skillnad från de andra vyerna representerar profiles alla registrerade
 * konton (även väntande, utan roll/åtkomst), inte bara de med en viss
 * behörighet. `id` är kontots id direkt (ingen user_id-indirektion).
 */
final class ProfilesCollection extends UsersTableView
{
    protected function scopeSql(): string
    {
        return '';
    }

    protected function toRow(array $u): array
    {
        $seen = json_decode((string) $u['notifications_seen'], true);
        return [
            'id' => $u['id'], 'display_name' => $u['display_name'], 'intro' => $u['intro'],
            'notifications_seen' => is_array($seen) && $seen !== [] ? $seen : new stdClass(),
            'notifications_cleared_at' => $u['notifications_cleared_at'],
            'created_at' => $u['created_at'],
        ];
    }

    protected function underlyingId(array $row): string
    {
        return (string) ($row['id'] ?? $row['user_id']);
    }

    protected function toColumns(array $data): array
    {
        $cols = [];
        if (isset($data['display_name'])) $cols['display_name'] = $data['display_name'];
        if (isset($data['intro'])) $cols['intro'] = $data['intro'];
        if (array_key_exists('notifications_seen', $data)) {
            $cols['notifications_seen'] = json_encode($data['notifications_seen'] ?: new stdClass(), JSON_UNESCAPED_UNICODE);
        }
        if (array_key_exists('notifications_cleared_at', $data)) $cols['notifications_cleared_at'] = $data['notifications_cleared_at'];
        return $cols;
    }

    protected function deactivateColumns(): array
    {
        // En profil raderas aldrig separat — den följer kontot. Borttagning
        // av konton sker via /api/users (superadmin), inte den här vyn.
        throw new RuntimeException('NOT_SUPPORTED');
    }
}
