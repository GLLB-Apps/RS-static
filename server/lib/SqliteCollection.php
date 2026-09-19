<?php
declare(strict_types=1);

// Generisk DataCollection ovanpå en riktig SQLite-tabell (contact_messages,
// testimonies, testimony_contacts) — samma list/get/insert/upsert/update/
// delete-gränssnitt som JsonCollection, så DataController kan hantera dem
// utbytbart. Till skillnad från JSON-filerna har SQL-tabeller riktiga
// kolumner: skrivningar filtreras mot en per-tabell vitlista (`columns`)
// innan de byggs till SQL, så ett fältnamn från klienten aldrig kan bli en
// SQL-identifierare (kolumnnamn byggs annars in direkt i frågesträngen).
final class SqliteCollection implements DataCollection
{
    /**
     * @param list<string> $columns Tillåtna kolumner (utöver id/created_at/updated_at).
     */
    public function __construct(
        private readonly PDO $db,
        private readonly string $table,
        private readonly array $columns,
        private readonly bool $hasUpdatedAt = true,
    ) {}

    public function list(array $eq = [], array $ilike = [], array $gte = [], array $lte = [], ?array $order = null, ?int $limit = null): array
    {
        $rows = $this->db->query("SELECT * FROM {$this->table}")->fetchAll();
        return RowFilter::apply(array_map([$this, 'cast'], $rows), $eq, $ilike, $gte, $lte, $order, $limit);
    }

    public function get(string $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $this->cast($row);
    }

    public function insert(array $data): array
    {
        $id = (string) ($data['id'] ?? bin2hex(random_bytes(10)));
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $cols = $this->whitelist($data);
        $cols['id'] = $id;
        $cols['created_at'] = $data['created_at'] ?? $now;
        if ($this->hasUpdatedAt) {
            // Respekterar en given updated_at (t.ex. import-återställning) —
            // annars nu, som för en vanlig ny rad.
            $cols['updated_at'] = $data['updated_at'] ?? $now;
        }

        $names = array_keys($cols);
        $placeholders = implode(', ', array_map(static fn (string $c): string => ":{$c}", $names));
        $stmt = $this->db->prepare("INSERT INTO {$this->table} (" . implode(', ', $names) . ") VALUES ({$placeholders})");
        $stmt->execute($cols);

        return $this->get($id) ?? throw new RuntimeException('NOT_FOUND');
    }

    public function upsert(string $id, array $data): array
    {
        return $this->get($id) !== null
            ? ($this->update(['id' => $id], $data)[0] ?? throw new RuntimeException('NOT_FOUND'))
            : $this->insert(array_merge($data, ['id' => $id]));
    }

    public function update(array $eq, array $patch): array
    {
        $cols = $this->whitelist($patch);
        if ($this->hasUpdatedAt) {
            $cols['updated_at'] = (new DateTimeImmutable())->format(DATE_ATOM);
        }
        $updated = [];
        foreach ($this->list(eq: $eq) as $row) {
            if ($cols !== []) {
                $set = implode(', ', array_map(static fn (string $c): string => "{$c} = :{$c}", array_keys($cols)));
                $stmt = $this->db->prepare("UPDATE {$this->table} SET {$set} WHERE id = :__id");
                $stmt->execute([...$cols, '__id' => $row['id']]);
            }
            $updated[] = $this->get((string) $row['id']);
        }
        return $updated;
    }

    public function delete(array $eq): int
    {
        $targets = $this->list(eq: $eq);
        foreach ($targets as $row) {
            $this->db->prepare("DELETE FROM {$this->table} WHERE id = :id")->execute(['id' => $row['id']]);
        }
        return count($targets);
    }

    /**
     * Släpper igenom bara kända kolumner — se klasskommentaren. Bool-kolumner
     * (NOT NULL DEFAULT 0 i schemat) är alltid 0/1, aldrig NULL — ett `null`
     * här (t.ex. ett Appwrite-attribut som var ounset vid import) blir 0 i
     * stället för att krascha mot NOT NULL-villkoret. Övriga fält skickas som
     * de är, inklusive `null` — en admin ska kunna nolla ett textfält.
     * @return array<string,mixed>
     */
    private function whitelist(array $data): array
    {
        $out = [];
        foreach ($this->columns as $c) {
            if (!array_key_exists($c, $data)) {
                continue;
            }
            $v = $data[$c];
            $isBoolColumn = str_starts_with($c, 'is_') || str_starts_with($c, 'consent_');
            if ($isBoolColumn) {
                $out[$c] = (int) (bool) $v;
            } else {
                $out[$c] = is_bool($v) ? (int) $v : $v;
            }
        }
        return $out;
    }

    /** SQLite lagrar bool som 0/1 — gör om till riktiga booleaner åt klienten. */
    private function cast(array $row): array
    {
        foreach ($row as $k => $v) {
            if (str_starts_with($k, 'is_') || str_starts_with($k, 'consent_')) {
                $row[$k] = (bool) $v;
            }
        }
        return $row;
    }
}
