<?php
declare(strict_types=1);
function db(): PDO {
    static $db;
    if (!$db) {
        $c = json_decode(file_get_contents('/etc/cnchome/database.json'), true, 512, JSON_THROW_ON_ERROR);
        $db = new PDO('mysql:host=localhost;dbname=cnchome;charset=utf8mb4', $c['username'], $c['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $db->exec("SET time_zone = '+00:00'");
    }
    return $db;
}
function session_boot(): void {
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('cnchome_session');
    session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
    session_start();
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > 3600) $_SESSION=[];
    $_SESSION['last']=time();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $q=db()->prepare('SELECT id, username, display_name, role, department FROM app_users WHERE id=? AND active=1');
    $q->execute([$_SESSION['user_id']]);
    return $q->fetch() ?: null;
}
function csrf_ok(string $value): bool { return hash_equals($_SESSION['csrf'], $value); }
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function entries_for(array $user): array {
    $sql='SELECT id,department,effective_date,saved_at,policy,actor_name FROM grade_versions';
    $q=db()->prepare($sql.($user['role']==='admin'?'':' WHERE department=?').' ORDER BY id');
    $q->execute($user['role']==='admin'?[]:[$user['department']]);
    return array_map(fn($r)=>['id'=>(int)$r['id'],'department'=>$r['department'],'date'=>$r['effective_date'],'savedAt'=>str_replace(' ','T',$r['saved_at']).'Z','savedBy'=>$r['actor_name'],'policy'=>json_decode($r['policy'],true,512,JSON_THROW_ON_ERROR)],$q->fetchAll());
}
function snapshot(array $user): array {
    // One consistent snapshot prevents a new revision paired with older entries.
    $d=db(); $d->beginTransaction();
    try {
        $revision=(int)$d->query('SELECT revision FROM grade_revision WHERE id=1')->fetchColumn();
        $entries=entries_for($user); $d->commit();
        return ['revision'=>$revision,'entries'=>$entries];
    } catch(Throwable $e) { $d->rollBack(); throw $e; }
}
