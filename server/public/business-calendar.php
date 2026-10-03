<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/native.php';require_once CNC_RUNTIME_DIR.'/business-calendar.php';require_once CNC_RUNTIME_DIR.'/calendar-holidays.php';
try{
    session_boot();$user=current_user();if(!$user){header('Location: /login.php?role=admin');exit;}
    if($user['role']!=='admin')throw new HRForbidden('관리자 전용 영업일 달력입니다.');
    $month=$_GET['month']??substr(hr_today(),0,7);hr_assert(is_string($month),'조회 월을 확인해 주세요.');$dates=business_calendar_dates($month);
    $data=business_calendar_month($month);$savedCount=count($data['days']);$error='';$saved=($_SESSION['business_calendar_saved']??null)===$month;unset($_SESSION['business_calendar_saved']);
    $holidaySaved=($_SESSION['calendar_holiday_saved']??null)===$month;unset($_SESSION['calendar_holiday_saved']);
    $holidayDraft=['date'=>'','name'=>''];
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!is_string($_POST['csrf']??null)||!csrf_ok($_POST['csrf']))throw new HRForbidden('세션이 변경되었습니다. 새로고침 후 다시 저장해 주세요.');
        try{
            $action=$_POST['action']??'business_save';
            if(in_array($action,['holiday_add','holiday_update','holiday_remove'],true)){
                hr_assert(($_POST['month']??null)===$month,'저장할 휴일의 월을 확인해 주세요.');
                $holidayDate=calendar_holiday_date($_POST['date']??null);
                hr_assert(substr($holidayDate,0,7)===$month,'선택한 조회 월의 휴일만 저장할 수 있습니다.');
                $holidayInput=['action'=>substr($action,8),'date'=>$holidayDate,'name'=>$_POST['name']??''];
                if($action!=='holiday_add'){
                    hr_assert(is_string($_POST['revision']??null)&&ctype_digit($_POST['revision'])&&strlen($_POST['revision'])<=10,'휴일 변경 버전을 확인해 주세요.');
                    $holidayInput['revision']=(int)$_POST['revision'];
                }else{$holidayDraft=['date'=>$holidayDate,'name'=>is_string($_POST['name']??null)?$_POST['name']:''];}
                calendar_holiday_save($user,$holidayInput);$_SESSION['calendar_holiday_saved']=$month;
                header('Location: /business-calendar.php?role=admin&month='.$month.'#company-holidays',true,303);exit;
            }
            hr_assert($action==='business_save','저장 방법을 확인해 주세요.');
            hr_assert(($_POST['month']??null)===$month&&is_string($_POST['revision']??null)&&ctype_digit($_POST['revision']),'저장할 월과 변경 버전을 확인해 주세요.');
            $data['days']=business_calendar_validate($month,$_POST['days']??[]);$data['revision']=(int)$_POST['revision'];
            business_calendar_save($user,$month,$data['days'],$data['revision']);$_SESSION['business_calendar_saved']=$month;
            header('Location: /business-calendar.php?role=admin&month='.$month,true,303);exit;
        }catch(InvalidArgumentException|BusinessCalendarConflict|CalendarHolidayConflict $e){$error=$e->getMessage();http_response_code($e instanceof BusinessCalendarConflict||$e instanceof CalendarHolidayConflict?409:422);}
    }elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);header('Allow: GET, POST');exit;}
    $companyHolidays=calendar_holidays_read($user,$month.'-01',(new DateTimeImmutable($month.'-01'))->format('Y-m-t'))['entries'];
    native_start('영업일 달력',$user,'adminBusinessCalendar',['business-calendar.css']);require view_root().'/business-calendar.php';native_end();
}catch(HRForbidden $e){http_response_code(403);render_view('error',['title'=>'영업일 달력 접근 권한','message'=>$e->getMessage(),'role'=>'admin']);}
catch(InvalidArgumentException $e){http_response_code(422);render_view('error',['title'=>'조회 월 확인','message'=>$e->getMessage(),'role'=>'admin']);}
catch(Throwable $e){error_log('business calendar: '.get_class($e));http_response_code(503);render_view('error',['title'=>'달력을 불러오지 못했습니다.','message'=>'잠시 후 다시 확인해 주세요.','role'=>'admin']);}
