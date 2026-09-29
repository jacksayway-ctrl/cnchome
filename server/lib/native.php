<?php
declare(strict_types=1);
require_once __DIR__.'/views.php';

function native_routes(): array {
    return ['adminContracts'=>'contracts.php','contracts'=>'contracts.php','adminStaff'=>'personnel.php','adminStaffRegister'=>'personnel.php','myInfo'=>'personnel.php','adminPayroll'=>'pay-statements.php','payslips'=>'pay-statements.php'];
}
function native_url(string $page,string $role): string {
    $route=native_routes()[$page]??null;
    return '/'.($route??'office.php').'?role='.($role==='admin'?'admin':'employee').($route?($page==='adminStaffRegister'?'&new=1':''):'&page='.rawurlencode($page));
}
function native_csrf(): string {return '<input type="hidden" name="csrf" value="'.view_h((string)($_SESSION['csrf']??'')).'">';}
function native_money(int|float $amount): string {return number_format($amount).'원';}
function native_start(string $title,array $user,string $active): void {
    $role=$user['role']==='admin'?'admin':'employee';$nav=app_navigation();
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>'.view_h($title).' · 씨앤씨</title><link rel="icon" href="/cnc-mark.svg"><link rel="stylesheet" href="'.view_h(asset_url('native.css')).'"></head><body class="nf-body">';
    echo '<header class="nf-topbar"><a href="'.view_h(native_url($role==='admin'?'adminHome':'home',$role)).'" class="nf-brand">씨앤씨</a><span>'.view_h($user['display_name']).' · '.($role==='admin'?'관리자':'직원').'</span><form method="post" action="/logout.php?role='.$role.'">'.native_csrf().'<button type="submit">로그아웃</button></form></header><div class="nf-shell"><aside class="nf-nav"><nav aria-label="업무 메뉴">';
    $groups=$role==='admin'?$nav['admin']:[['label'=>'직원 메뉴','items'=>$nav['employee']]];
    foreach($groups as $group){echo '<section><h2>'.view_h($group['label']).'</h2>';foreach($group['items'] as $item){[$page,$label]=$item;echo '<a href="'.view_h(native_url($page,$role)).'"'.($page===$active?' class="active" aria-current="page"':'').'>'.view_h($label).'</a>';}echo '</section>';}
    echo '</nav></aside><main class="nf-main"><div class="nf-page-heading"><h1>'.view_h($title).'</h1><span>'.(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y.m.d').'</span></div>';
}
function native_end(): void {echo '</main></div><script src="'.view_h(asset_url('native-ui.js')).'" defer></script></body></html>';}
