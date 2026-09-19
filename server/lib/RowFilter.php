<?php
declare(strict_types=1);

// Delad filter-/sorterings-/gränslogik för "listor av associativa arrayer",
// oavsett om raderna kom från JSON-filer (JsonCollection) eller SQLite
// (se UserCollections.php). Samma semantik som klientens tidigare
// Appwrite-baserade QueryBuilder (eq/ilike/gte/lte/order/limit).
final class RowFilter
{
    /**
     * @param array<int,array<string,mixed>> $rows
     * @param array<string,mixed> $eq
     * @param array<string,string> $ilike
     * @param array<string,string> $gte
     * @param array<string,string> $lte
     * @param array{0:string,1:string}|null $order
     * @return array<int,array<string,mixed>>
     */
    public static function apply(
        array $rows,
        array $eq = [],
        array $ilike = [],
        array $gte = [],
        array $lte = [],
        ?array $order = null,
        ?int $limit = null,
    ): array {
        foreach ($eq as $field => $value) {
            $allowed = is_array($value) ? $value : [$value];
            $rows = array_values(array_filter($rows, static fn (array $r): bool => in_array($r[$field] ?? null, $allowed, true)));
        }
        foreach ($ilike as $field => $needle) {
            $needle = mb_strtolower(str_replace('%', '', $needle));
            $rows = array_values(array_filter(
                $rows,
                static fn (array $r): bool => str_contains(mb_strtolower((string) ($r[$field] ?? '')), $needle)
            ));
        }
        foreach ($gte as $field => $min) {
            $rows = array_values(array_filter($rows, static fn (array $r): bool => ($r[$field] ?? null) !== null && (string) $r[$field] >= $min));
        }
        foreach ($lte as $field => $max) {
            $rows = array_values(array_filter($rows, static fn (array $r): bool => ($r[$field] ?? null) !== null && (string) $r[$field] <= $max));
        }

        if ($order !== null) {
            [$field, $dir] = $order;
            usort($rows, static function (array $a, array $b) use ($field, $dir): int {
                $cmp = ($a[$field] ?? null) <=> ($b[$field] ?? null);
                return $dir === 'desc' ? -$cmp : $cmp;
            });
        }

        if ($limit !== null) {
            $rows = array_slice($rows, 0, $limit);
        }

        return $rows;
    }
}
