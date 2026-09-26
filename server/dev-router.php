<?php
// Development only. Production serves server/public endpoints and approved assets.
declare(strict_types=1);
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(!is_string($path)){http_response_code(400);exit;}
if($path==='/')$path='/index.php';
if(preg_match('~^/[a-z][a-z-]*\.php$~D',$path)&&is_file(__DIR__.'/public'.$path)){
 require __DIR__.'/public'.$path;return true;
}
if(preg_match('~^/[a-z][a-z0-9-]*\.(?:css|js|svg|html)$~D',$path)&&is_file(dirname(__DIR__).$path)){
 $type=['css'=>'text/css','js'=>'text/javascript','svg'=>'image/svg+xml','html'=>'text/html'][pathinfo($path,PATHINFO_EXTENSION)];
 header('Content-Type: '.$type.'; charset=utf-8');readfile(dirname(__DIR__).$path);return true;
}
http_response_code(404);echo 'Not found';return true;
