<?php
declare(strict_types=1);
function view_h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function view_json(mixed $value): string {
    return json_encode($value, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
function view_root(): string {
    return is_dir(__DIR__.'/views') ? __DIR__.'/views' : dirname(__DIR__).'/views';
}
function app_navigation(): array {
    static $navigation;
    if ($navigation === null) {
        $config=is_dir(__DIR__.'/config') ? __DIR__.'/config' : dirname(__DIR__).'/config';
        $navigation=json_decode(file_get_contents($config.'/navigation.json'),true,512,JSON_THROW_ON_ERROR);
    }
    return $navigation;
}
function office_page(string $role, mixed $requested): string {
    $navigation=app_navigation();
    $allowed=$role==='admin' ? array_merge(['grade'],...array_map(fn($group)=>array_column($group['items'],0),$navigation['admin'])) : array_column($navigation['employee'],0);
    return is_string($requested) && in_array($requested,$allowed,true) ? $requested : ($role==='admin'?'adminHome':'home');
}
function asset_url(string $file): string {
    $root=defined('CNC_ASSET_ROOT') ? CNC_ASSET_ROOT : dirname(__DIR__,2);
    $path=$root.'/'.$file;
    return './'.$file.(is_file($path)?'?v='.substr(hash_file('sha256',$path),0,12):'');
}
function department_label(string $department): string {
    return ['insurance'=>'보험팀','cosmetics'=>'화장품팀','health'=>'건강보조식품팀'][$department]??'소속 확인 필요';
}
function render_view(string $name, array $data=[]): void {
    if (!in_array($name,['office','payroll','login','documents','error'],true)) throw new InvalidArgumentException('Unknown view');
    $navigation=app_navigation();$preview=false;$boot=null;$user=null;$role='employee';$page='home';
    extract($data,EXTR_OVERWRITE);
    require view_root().'/'.$name.'.php';
}
function document_root(): string {
    return is_dir(__DIR__.'/docs') ? __DIR__.'/docs' : dirname(__DIR__,2).'/docs';
}
function document_files(): array {
    $files=[];
    foreach (glob(document_root().'/*')?:[] as $path) {
        if (is_file($path)&&in_array(pathinfo($path,PATHINFO_EXTENSION),['md','json'],true)) $files[]=basename($path);
    }
    sort($files,SORT_NATURAL|SORT_FLAG_CASE);return $files;
}
