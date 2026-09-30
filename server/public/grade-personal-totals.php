<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/grade-ledger.php';
session_boot();header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');
try{
    $user=current_user();if(!$user){http_response_code(401);echo hr_json(['error'=>'다시 로그인해 주세요.']);exit;}
    if($user['role']!=='employee'){http_response_code(403);echo hr_json(['error'=>'직원 본인 합계만 조회할 수 있습니다.']);exit;}
    if($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);header('Allow: GET');exit;}
    if(!grade_employee_available($user,grade_history($user['department']),hr_today()))throw new HRForbidden('부서 전용 지급 기준을 준비 중입니다.');
    $q=db()->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$user['id']]);$raw=$q->fetchColumn();hr_assert((bool)$raw,'등록된 근무정보가 없습니다.');
    echo hr_json(grade_personal_totals(['userId'=>(int)$user['id'],'profile'=>json_decode($raw,true,512,JSON_THROW_ON_ERROR)],substr(hr_today(),0,7)));
}catch(HRForbidden $e){http_response_code(403);echo hr_json(['error'=>$e->getMessage()]);}catch(InvalidArgumentException $e){http_response_code(422);echo hr_json(['error'=>$e->getMessage()]);}catch(Throwable $e){error_log('personal grade totals: '.get_class($e));http_response_code(503);echo hr_json(['error'=>'그레이드 합계를 불러오지 못했습니다.']);}
