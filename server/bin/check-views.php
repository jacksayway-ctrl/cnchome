<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/views.php';
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function html_view(string $name,array $data=[]):string {ob_start();render_view($name,$data);return ob_get_clean();}
$directory=dirname(__DIR__,2).'/.build';if(!is_dir($directory))mkdir($directory,0700,true);
$navigation=app_navigation();
check(office_page('employee','adminPayroll')==='home','employee cannot select admin page');
check(office_page('employee',['home'])==='home','array query rejected');
check(office_page('admin','../bootstrap.php')==='adminHome','path input rejected');
check(office_page('admin','adminPayroll')==='adminPayroll','admin route supported');
check(!str_contains(view_json(['text'=>'</script><script>alert(1)</script>']),'</script>'),'boot JSON cannot close script');
foreach(['admin','employee'] as $role){
 $routes=$role==='admin'?array_merge(['grade'],...array_map(fn($g)=>array_column($g['items'],0),$navigation['admin'])):array_column($navigation['employee'],0);
 $user=['id'=>1,'role'=>$role,'department'=>'insurance','display_name'=>'테스트 <직원>'];
 foreach($routes as $page){
  $boot=['user'=>$user,'page'=>$page,'entries'=>[],'revision'=>0,'csrf'=>'TEST','hr'=>['today'=>'2026-09-26','accounts'=>[],'employees'=>[],'payroll'=>[]]];
  $html=html_view('office',compact('role','page','user','boot'));
  preg_match('~<aside>(.*?)</aside>~s',$html,$matches);$sidebar=$matches[1];
  check(substr_count($html,'id="tm-main"')===1,'one main per page');
  check(!str_contains($html,'<h1>테스트 <직원>'),'escape user display name');
  check(!str_contains($sidebar,'data-page="admin'),'no legacy admin sidebar links');
  check(substr_count($sidebar,'data-aw-section=')===($role==='admin'?6:0),'role-specific initial sidebar');
  check(str_contains($sidebar,'data-page="home"')===($role==='employee'),'employee home visibility');
  file_put_contents($directory.'/'.$role.'-'.$page.'.html',$html);
 }
}
file_put_contents($directory.'/office-preview.html',html_view('office',['preview'=>true]));
file_put_contents($directory.'/payroll-preview.html',html_view('payroll',['role'=>'admin']));
check(in_array('payroll-requirements.json',document_files(),true),'all operating rules present');
check(!in_array('../bootstrap.php',document_files(),true),'documents traversal rejected');
echo 'PASS: 29 role-checked PHP routes, escaped output, original-menu exclusion, document allowlist and rendered fixtures.'.PHP_EOL;
