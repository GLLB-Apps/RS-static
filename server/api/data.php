<?php
declare(strict_types=1);

// Generisk endpoint för redaktionella "platta" kollektioner:
// GET    /api/data/{table}          — lista (eq/ilike/gte/lte/order/limit via querysträng)
// GET    /api/data/{table}/{id}     — en post
// POST   /api/data/{table}          — skapa
// PUT    /api/data/{table}/{id}     — skapa eller ersätt helt
// PATCH  /api/data/{table}          — uppdatera poster som matchar eq[...]-filtren (body = ändrade fält)
// DELETE /api/data/{table}          — ta bort poster som matchar eq[...]-filtren
//
// Ersätter `supabase.from(table)...` (Appwrite Databases) för alla
// innehållstyper som inte kräver transaktion/autentisering i sig själva —
// se DataController::TABLES. Karta (GeoJSON), uppladdningar, konton,
// meddelanden, vittnesmål, audit log och signaturer har egna endpoints.
final class DataController
{
    /**
     * Vilka tabeller den här endpointen hanterar, och vilka statusvärden som
     * är publikt läsbara (motsvarar PUBLIC_WHEN + documentSecurity i den
     * gamla src/lib/supabase.ts). En tabell som saknas här är antingen
     * hanterad av en annan controller (t.ex. karta, konton) eller inte
     * publikt läsbar alls utan session.
     *
     * `null` = ingen statusgrind, hela kollektionen är publikt läsbar
     * (motsvarar en Appwrite-kollektion utan documentSecurity, dvs. ingen
     * skillnad mellan utkast och publicerat vid läsning — adminvyn för
     * t.ex. sidor och navigation har alltid kunnat läsa allt).
     *
     * @var array<string,list<string>|null>
     */
    private const TABLES = [
        'site_settings'     => null,
        'pages'             => null,
        'navigation_items'  => null,
        'faq_categories'    => null,
        'contacts'          => null,
        'custom_icons'      => null,
        'changelog_entries' => null,
        'sponsors'          => null,
        'topics'            => ['published'],
        'posts'             => ['published'],
        'documents'         => ['published'],
        'media_items'       => ['published'],
        'timeline_events'   => ['published'],
        'faq_items'         => ['published'],
        'custom_pages'      => ['published'],
        'user_roles'        => null,
        'intranet_members'  => null,
        'profiles'          => null,
        'testimonies'       => ['approved'],
        'testimony_contacts' => null,
        'contact_messages'  => null,
        'map_locations'     => ['published'],
        'map_areas'         => ['published'],
        'intranet_notices'  => null,
        'intranet_notes'    => null,
        'intranet_tasks'    => null,
        'internal_doc_categories' => null,
        'internal_documents'      => null,
    ];

    /**
     * Tabeller som aldrig är publikt läsbara, oavsett status-grind — kräver
     * adminsession även för GET. Innehåller kontodata (namn, e-postbaserad
     * roll/åtkomst) eller känsliga inskick, inte redaktionellt innehåll.
     */
    private const ADMIN_ONLY_READ = ['user_roles', 'intranet_members', 'profiles', 'testimony_contacts', 'contact_messages'];

    /**
     * Intranätets eget innehåll: kräver intranätsåtkomst (requireMember/
     * requireIntranetWrite), inte adminroll — en läsbehörig eller full
     * intranätmedlem utan adminroll ska också komma åt dessa.
     */
    private const MEMBER_TABLES = [
        'intranet_notices', 'intranet_notes', 'intranet_tasks',
        'internal_doc_categories', 'internal_documents',
    ];

    /**
     * Tabeller där VEM SOM HELST (utloggad) får skapa en rad — motsvarar att
     * Appwrite-kollektionerna tillät `create` för gäster men inte läsning.
     * Kontaktformuläret, vittnesmålsformuläret och frågeformuläret på
     * FAQ-sidan. Skrivning i övrigt (update/delete/replace) är fortfarande
     * adminskyddad.
     */
    private const PUBLIC_CREATE = ['testimonies', 'testimony_contacts', 'contact_messages', 'faq_items'];

    /**
     * Fält som är nyckel/värde-objekt (`Record<string, string>` i
     * src/lib/types.ts) snarare än listor. PHP:s json_decode(..., true) kan
     * inte skilja en tom `{}` från en tom `[]`, så en tom sådan fil blir en
     * PHP-array vid läsning och skulle annars kodas tillbaka som `[]` i
     * API-svaret — vilket bryter klientens typ (`Record<string,string>`).
     * Se MIGRATION_PLAN.md, avsnitt 6.
     *
     * @var array<string,list<string>>
     */
    private const OBJECT_FIELDS = [
        'pages'         => ['texts'],
        'site_settings' => ['social_links'],
    ];

    public function __construct(
        private readonly JsonStore $store,
        private readonly Auth $auth,
        private readonly PDO $db,
    ) {}

    public function list(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        $this->requireReadAccess($table);
        [$eq, $ilike, $gte, $lte, $order, $limit] = $this->parseFilters($req);
        // profiles: en icke-admin får bara någonsin se sin egen rad, oavsett
        // vilket filter klienten bad om — se undantaget i requireReadAccess().
        if ($table === 'profiles' && $this->auth->currentUser()['role'] === null) {
            $eq = ['id' => $this->auth->currentUser()['id']];
        }
        $rows = $this->collectionFor($table)->list($eq, $ilike, $gte, $lte, $order, $limit);
        Response::ok(array_map(fn (array $r) => $this->normalize($table, $r), $this->filterPublic($table, $rows)));
    }

    public function get(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        $this->requireReadAccess($table);
        $id = (string) ($args['id'] ?? '');
        if ($table === 'profiles' && $id !== $this->auth->currentUser()['id'] && $this->auth->currentUser()['role'] === null) {
            Response::error('FORBIDDEN', 'Du kan bara läsa din egen profil.', 403);
        }
        $row = $this->collectionFor($table)->get($id);
        if ($row === null || $this->filterPublic($table, [$row]) === []) {
            Response::error('NOT_FOUND', 'Posten finns inte.', 404);
        }
        Response::ok($this->normalize($table, $row));
    }

    /**
     * Kräver adminsession (kontodata) eller intranätsåtkomst (intranätets
     * eget innehåll). profiles är ett eget undantag: admin-skyddat i stort,
     * men vem som helst inloggad får läsa sin EGEN rad (t.ex. för att visa
     * sitt eget visningsnamn i topbaren) — matchar skrivundantaget i
     * replace(). list()/get() begränsar en icke-admin till den posten.
     */
    private function requireReadAccess(string $table): void
    {
        if ($table === 'profiles') {
            $this->auth->requireUser();
            return;
        }
        if (in_array($table, self::ADMIN_ONLY_READ, true)) {
            $this->auth->requireAdmin();
        } elseif (in_array($table, self::MEMBER_TABLES, true)) {
            $this->auth->requireMember();
        }
    }

    /** Admin, utom intranätets egna tabeller (kräver bara skrivbehörig intranätmedlem) och PUBLIC_CREATE. */
    private function requireWriteAccess(string $table, Request $req): void
    {
        if (in_array($table, self::MEMBER_TABLES, true)) {
            $this->auth->requireIntranetWrite();
        } else {
            $this->auth->requireAdmin();
        }
        $this->auth->requireCsrf($req);
    }

    public function create(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        // Kontakt-/vittnesmålsformulären skickas av utloggade besökare — se
        // PUBLIC_CREATE. CSRF skyddar sessionscookies, vilket en anonym
        // besökare inte har någon av, så det är inget att kontrollera här.
        if (!in_array($table, self::PUBLIC_CREATE, true)) {
            $this->requireWriteAccess($table, $req);
        }
        $body = $this->sanitizeId($req->json());
        // En anonym avsändare får aldrig publicera sig själv direkt — frågan
        // ska alltid genom redaktionens granskning/svar, oavsett vad klienten
        // skickade in i de här fälten.
        if ($table === 'faq_items') {
            $body['status'] = 'draft';
            $body['answer'] = '';
            $body['published_at'] = null;
        }
        $row = $this->collectionFor($table)->insert($body);
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'create', $table, (string) ($row['id'] ?? ''));
        Response::ok($this->normalize($table, $row), 201);
    }

    public function replace(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        $id = $this->normalizeId((string) ($args['id'] ?? ''));

        // profiles: vem som helst inloggad får skriva sin EGEN rad (namn,
        // presentation, notismarkeringar) — inte bara admin. Matchar att
        // Appwrites profiles-kollektion tillät en användare att uppdatera sitt
        // eget dokument. En admin får ändra vem som helst.
        if ($table === 'profiles') {
            $user = $this->auth->requireUser();
            if ($id !== $user['id'] && $user['role'] === null) {
                Response::error('FORBIDDEN', 'Du kan bara ändra din egen profil.', 403);
            }
            $this->auth->requireCsrf($req);
        } else {
            $this->requireWriteAccess($table, $req);
        }

        $row = $this->collectionFor($table)->upsert($id, $req->json());
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'update', $table, $id);
        Response::ok($this->normalize($table, $row));
    }

    public function update(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        $this->requireWriteAccess($table, $req);
        [$eq] = $this->parseFilters($req);
        $patch = $this->sanitizeId($req->json());
        $updated = $this->collectionFor($table)->update($eq, $patch);
        $ids = implode(',', array_map(static fn (array $r): string => (string) ($r['id'] ?? ''), $updated));
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'update', $table, $ids, ['eq' => $eq]);
        Response::ok(array_map(fn (array $r) => $this->normalize($table, $r), $updated));
    }

    public function remove(Request $req, array $args): void
    {
        $table = $this->resolveTable($args['table'] ?? '');
        $this->requireWriteAccess($table, $req);
        [$eq] = $this->parseFilters($req);
        $deleted = $this->collectionFor($table)->delete($eq);
        Audit::log($this->db, $this->auth->currentUser()['id'] ?? null, 'delete', $table, '', ['eq' => $eq, 'deleted' => $deleted]);
        Response::ok(['deleted' => $deleted]);
    }

    private function resolveTable(string $table): string
    {
        if (!array_key_exists($table, self::TABLES)) {
            Response::error('NOT_FOUND', 'Okänd resurs.', 404);
        }
        return $table;
    }

    private function collectionFor(string $table): DataCollection
    {
        // site_settings är ett enda objekt (data/settings.json), inte en
        // katalog av dokument — men exponeras via samma generiska
        // endpoint/QueryBuilder-gränssnitt som övriga tabeller.
        if ($table === 'site_settings') {
            return new SingleDocumentCollection($this->store, 'settings.json');
        }
        return match ($table) {
            'user_roles'        => new UserRolesCollection($this->db),
            'intranet_members'  => new IntranetMembersCollection($this->db),
            'profiles'          => new ProfilesCollection($this->db),
            'contact_messages'  => new SqliteCollection($this->db, 'contact_messages', [
                'name', 'email', 'subject', 'message', 'status', 'internal_note',
            ]),
            'testimonies'       => new SqliteCollection($this->db, 'testimonies', [
                'title', 'story', 'author_name', 'is_anonymous', 'email', 'location', 'area_usage',
                'featured_image', 'map_lat', 'map_lng', 'status', 'consent_publish', 'consent_contact',
                'consent_marketing', 'internal_note', 'published_at',
            ]),
            'testimony_contacts' => new SqliteCollection($this->db, 'testimony_contacts', [
                'testimony_id', 'email', 'author_name', 'internal_note',
            ]),
            default             => new JsonCollection($this->store, $table),
        };
    }

    /** Tvingar tomma OBJECT_FIELDS-fält till JSON-objekt ({}) i stället för []. */
    private function normalize(string $table, array $row): array
    {
        foreach (self::OBJECT_FIELDS[$table] ?? [] as $field) {
            if (isset($row[$field]) && is_array($row[$field]) && $row[$field] === []) {
                $row[$field] = new stdClass();
            }
        }
        return $row;
    }

    /** Döljer icke-publicerat innehåll för anropare utan adminsession. */
    private function filterPublic(string $table, array $rows): array
    {
        $publicStates = self::TABLES[$table];
        if ($publicStates === null || $this->auth->currentUser() !== null) {
            return $rows;
        }
        return array_values(array_filter(
            $rows,
            static fn (array $r): bool => in_array($r['status'] ?? null, $publicStates, true)
        ));
    }

    /** @return array{0:array<string,mixed>,1:array<string,string>,2:array<string,string>,3:array<string,string>,4:array{0:string,1:string}|null,5:?int} */
    private function parseFilters(Request $req): array
    {
        $q = $req->query;
        $eq = is_array($q['eq'] ?? null) ? $q['eq'] : [];
        // Querysträngen bär bara text — men klientens .eq('is_active', true)
        // skickar bokstavligen "true"/"false", och raderna har riktiga PHP-bool
        // (från JSON respektive SqliteCollections cast()). RowFilter jämför
        // strikt (in_array(..., true)), så utan den här omvandlingen matchar
        // en bool-kolumn aldrig något alls — upptäckt via en tom hemsidemeny.
        foreach ($eq as $field => $value) {
            if ($value === 'true') {
                $eq[$field] = true;
            } elseif ($value === 'false') {
                $eq[$field] = false;
            }
        }
        $ilike = is_array($q['ilike'] ?? null) ? $q['ilike'] : [];
        $gte = is_array($q['gte'] ?? null) ? $q['gte'] : [];
        $lte = is_array($q['lte'] ?? null) ? $q['lte'] : [];

        $order = null;
        if (isset($q['order']) && is_string($q['order']) && str_contains($q['order'], ':')) {
            [$field, $dir] = explode(':', $q['order'], 2);
            $order = [$field, $dir === 'desc' ? 'desc' : 'asc'];
        }

        $limit = isset($q['limit']) && is_numeric($q['limit']) ? (int) $q['limit'] : null;

        return [$eq, $ilike, $gte, $lte, $order, $limit];
    }

    /** Endast a–z, 0–9, bindestreck och understreck i id — stoppar path traversal via filnamnet. */
    private function normalizeId(string $id): string
    {
        $id = trim($id);
        if ($id === '' || preg_match('/^[a-zA-Z0-9_-]+$/', $id) !== 1) {
            Response::error('VALIDATION_ERROR', 'Ogiltigt id.', 400);
        }
        return $id;
    }

    /** @param array<string,mixed> $body @return array<string,mixed> */
    private function sanitizeId(array $body): array
    {
        if (isset($body['id'])) {
            $body['id'] = $this->normalizeId((string) $body['id']);
        }
        return $body;
    }
}

// site_settings har ingen id/lista — samma list/get/update-gränssnitt som
// JsonCollection, men läser och skriver en enda flat fil.
final class SingleDocumentCollection implements DataCollection
{
    public function __construct(
        private readonly JsonStore $store,
        private readonly string $relPath,
    ) {}

    public function list(array $eq = [], array $ilike = [], array $gte = [], array $lte = [], ?array $order = null, ?int $limit = null): array
    {
        $row = $this->store->read($this->relPath);
        return $row === null ? [] : [$row];
    }

    public function get(string $id): ?array
    {
        return $this->store->read($this->relPath);
    }

    public function insert(array $data): array
    {
        return $this->upsert('settings', $data);
    }

    public function upsert(string $id, array $data): array
    {
        $this->store->write($this->relPath, $data);
        return $data;
    }

    public function update(array $eq, array $patch): array
    {
        $current = $this->store->read($this->relPath) ?? [];
        $merged = array_merge($current, $patch);
        $this->store->write($this->relPath, $merged);
        return [$merged];
    }

    public function delete(array $eq): int
    {
        return 0; // Inställningar tas aldrig bort, bara ersätts.
    }
}
