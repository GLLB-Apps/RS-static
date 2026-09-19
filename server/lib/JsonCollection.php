<?php
declare(strict_types=1);

// Generisk motor för "kollektioner" lagrade som en katalog av {id}.json-filer
// (data/{table}/{id}.json), byggd ovanpå JsonStore. Täcker samma
// filter-/sorterings-/gränssemantik som klientens tidigare Appwrite-baserade
// QueryBuilder (eq, order, limit, single, ilike, gte, lte, insert, update,
// upsert, delete) — så att en handfull olika innehållstyper (sidor, nyheter,
// ämnen, FAQ, dokument, m.fl.) kan dela en enda implementation i stället för
// en controller per typ.
//
// Varje dokument har `id`, `created_at`, `updated_at` — samma fältnamn som
// React-komponenterna (kopierade oförändrade från NCC-Draft-RS) redan
// förväntar sig av `src/lib/types.ts`, så ingen översättning behövs i
// klientlagret.
// Gemensamt gränssnitt för JsonCollection (katalog av dokument) och
// SingleDocumentCollection (en enda flat fil, t.ex. site_settings) — så att
// DataController kan hantera dem utbytbart.
interface DataCollection
{
    /** @return array<int,array<string,mixed>> */
    public function list(array $eq = [], array $ilike = [], array $gte = [], array $lte = [], ?array $order = null, ?int $limit = null): array;

    /** @return array<string,mixed>|null */
    public function get(string $id): ?array;

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public function insert(array $data): array;

    /** @param array<string,mixed> $data @return array<string,mixed> */
    public function upsert(string $id, array $data): array;

    /** @return array<int,array<string,mixed>> */
    public function update(array $eq, array $patch): array;

    public function delete(array $eq): int;
}

final class JsonCollection implements DataCollection
{
    public function __construct(
        private readonly JsonStore $store,
        private readonly string $table,
    ) {}

    /**
     * @param array<string,mixed> $eq Likhetsfilter (fält => värde eller [värden]).
     * @param array<string,string> $ilike Fält => sökterm (case-insensitive delsträng).
     * @param array<string,string> $gte Fält => lägsta värde (strängjämförelse, funkar för ISO-datum).
     * @param array<string,string> $lte Fält => högsta värde.
     * @param array{0:string,1:string}|null $order [fält, 'asc'|'desc']
     * @return array<int,array<string,mixed>>
     */
    public function list(
        array $eq = [],
        array $ilike = [],
        array $gte = [],
        array $lte = [],
        ?array $order = null,
        ?int $limit = null,
    ): array {
        return RowFilter::apply($this->store->readDir($this->table), $eq, $ilike, $gte, $lte, $order, $limit);
    }

    public function get(string $id): ?array
    {
        return $this->store->read($this->path($id));
    }

    /**
     * @param array<string,mixed> $data @return array<string,mixed>
     * `created_at`/`updated_at` i $data respekteras om de redan finns (t.ex.
     * scripts/import-appwrite-data.php som återställer riktiga tidsstämplar) —
     * annars sätts båda till nu, som för en vanlig ny post.
     */
    public function insert(array $data): array
    {
        $id = (string) ($data['id'] ?? bin2hex(random_bytes(10)));
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $row = array_merge($data, [
            'id'         => $id,
            'created_at' => $data['created_at'] ?? $now,
            'updated_at' => $data['updated_at'] ?? $now,
        ]);
        $this->store->write($this->path($id), $row);
        return $row;
    }

    /**
     * Skapar dokumentet om det saknas, ersätter det annars helt.
     * `updated_at` i $data respekteras om den redan finns (se insert()).
     */
    public function upsert(string $id, array $data): array
    {
        $existing = $this->get($id);
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $row = array_merge($data, [
            'id'         => $id,
            'created_at' => $existing['created_at'] ?? ($data['created_at'] ?? $now),
            'updated_at' => $data['updated_at'] ?? $now,
        ]);
        $this->store->write($this->path($id), $row);
        return $row;
    }

    /**
     * Sammanfogar $patch in i alla dokument som matchar $eq (samma
     * urvalslogik som list()'s eq-filter). Returnerar de uppdaterade raderna.
     * @return array<int,array<string,mixed>>
     */
    public function update(array $eq, array $patch): array
    {
        $targets = $this->list(eq: $eq);
        $now = (new DateTimeImmutable())->format(DATE_ATOM);
        $updated = [];
        foreach ($targets as $row) {
            $merged = array_merge($row, $patch, ['id' => $row['id'], 'updated_at' => $now]);
            $this->store->write($this->path((string) $row['id']), $merged);
            $updated[] = $merged;
        }
        return $updated;
    }

    /** Tar bort alla dokument som matchar $eq. Returnerar antal borttagna. */
    public function delete(array $eq): int
    {
        $targets = $this->list(eq: $eq);
        foreach ($targets as $row) {
            $this->store->delete($this->path((string) $row['id']));
        }
        return count($targets);
    }

    private function path(string $id): string
    {
        return $this->table . '/' . $id . '.json';
    }
}
