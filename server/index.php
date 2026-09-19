<?php
declare(strict_types=1);

// Front controller för /api/*. Webbhotellet routar hit via .htaccess.
// React-appen (dist/) serveras separat och faller tillbaka på index.html för
// icke-API-rutter (SPA), utan att fånga /api.

/** @var array<string,mixed> $config */
$config = require __DIR__ . '/bootstrap.php';

require __DIR__ . '/api/auth.php';
require __DIR__ . '/api/data.php';
require __DIR__ . '/api/users.php';
require __DIR__ . '/api/changelog.php';
require __DIR__ . '/api/uploads.php';
require __DIR__ . '/api/contact.php';
require __DIR__ . '/api/signatures.php';

$req = new Request($config['api_prefix']);

$store = new JsonStore($config['data_dir'], $config['data_dir'] . '/revisions');

$db = Db::get($config['db_path']);
$auth = new Auth($db);
$mailer = new Mailer($config['resend_api_key'], $config['mail_from_address'], $config['mail_from_name']);
$authApi = new AuthController($auth);
$data = new DataController($store, $auth, $db);
$usersApi = new UsersController($db, $auth, $mailer);
$changelogApi = new ChangelogController($auth, $config['anthropic_api_key']);
$uploadsApi = new UploadsController($auth, $config['uploads_dir']);
$contactApi = new ContactController($store, $db, $mailer);
$signaturesApi = new SignaturesController($auth, $store, $config['petition_url']);

$router = new Router();

// --- Autentisering -------------------------------------------------------------
$router->add('GET', '/auth/session', [$authApi, 'session']);
$router->add('POST', '/auth/login', [$authApi, 'login']);
$router->add('POST', '/auth/logout', [$authApi, 'logout']);
$router->add('POST', '/auth/signup', [$authApi, 'signup']);
$router->add('POST', '/auth/profile', [$authApi, 'updateProfile']);

// --- Generiska JSON-kollektioner (sidor, nyheter, ämnen, FAQ, m.fl.) ----------
// Se DataController::TABLES för vilka tabellnamn som hanteras här.
$router->add('GET', '/data/{table}', [$data, 'list']);
$router->add('GET', '/data/{table}/{id}', [$data, 'get']);
$router->add('POST', '/data/{table}', [$data, 'create']);
$router->add('PUT', '/data/{table}/{id}', [$data, 'replace']);
$router->add('PATCH', '/data/{table}', [$data, 'update']);
$router->add('DELETE', '/data/{table}', [$data, 'remove']);

// --- Konton (superadmin) och changelog-import --------------------------------
$router->add('GET', '/users/emails', [$usersApi, 'emails']);
$router->add('POST', '/users/delete', [$usersApi, 'delete']);
$router->add('POST', '/users/password', [$usersApi, 'setPassword']);
$router->add('POST', '/users/send-password', [$usersApi, 'sendPassword']);
$router->add('POST', '/changelog/translate', [$changelogApi, 'translate']);
$router->add('POST', '/uploads', [$uploadsApi, 'upload']);
$router->add('POST', '/contact', [$contactApi, 'submit']);
$router->add('GET', '/sync-signatures', [$signaturesApi, 'sync']);

$router->dispatch($req);
