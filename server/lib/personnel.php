<?php
declare(strict_types=1);
/** Native personnel cards use hr_employees as the single source of staff data. */
function personnel_default_profile(): array {
    return ['name'=>'','phone'=>'','team'=>'insurance','role'=>'상담원','startDate'=>hr_today(),'employment'=>'재직','payType'=>'시급제','payAmount'=>15000,'workDays'=>['월','화','수','목','금'],'weeklyHoliday'=>'일','contractStart'=>hr_today(),'contractType'=>'무기계약','contractTerm'=>'','payday'=>'15','workStart'=>'10:00','workEnd'=>'17:00','breakStart'=>'12:00','breakEnd'=>'13:00','workplace'=>'씨앤씨','duties'=>'전화상담'];
}
function personnel_records(array $user): array {
    $admin=$user['role']==='admin';
    $q=db()->prepare('SELECT id,employee_no,user_id,profile,revision,created_at FROM hr_employees'.($admin?'':' WHERE user_id=?').' ORDER BY id DESC');
    $q->execute($admin?[]:[(int)$user['id']]);
    return array_map(function(array $row): array {
        $row['id']=(int)$row['id'];$row['revision']=(int)$row['revision'];
        $row['profile']=json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR);
        $row['loginName']='';if($row['user_id']){$q=db()->prepare('SELECT username FROM app_users WHERE id=?');$q->execute([$row['user_id']]);$row['loginName']=$q->fetchColumn()?:'';}
        return $row;
    },$q->fetchAll());
}
function personnel_natural(mixed $value): int {
    hr_assert(is_string($value)||is_int($value),'직원 선택 값을 확인해 주세요.');
    $number=filter_var($value,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>2147483647]]);
    hr_assert($number!==false,'직원 선택 값을 확인해 주세요.');
    return $number;
}
function personnel_post_profile(array $post,array $existing=[]): array {
    $raw=$post['profile']??[];hr_assert(is_array($raw),'직원 정보를 확인해 주세요.');
    $profile=array_replace(personnel_default_profile(),$existing);
    $fields=['name','phone','email','birthDate','address','addressDetail','postcode','team','role','startDate','endDate','employment','workplace','duties','weeklyHoliday','payType','wageEffective','bank','accountNumber','accountHolder','contractStart','contractEnd','contractType','memo','gender','nationality','career','jobType','renewalDate','retirementReason','deathDate','deathReason','emergencyName','emergencyPhone','workStart','workEnd','breakStart','breakEnd','payday','qualification'];
    foreach($fields as $key){
        hr_assert(!isset($raw[$key])||is_string($raw[$key]),'직원 정보 입력 형식을 확인해 주세요.');
        if(array_key_exists($key,$raw))$profile[$key]=trim($raw[$key]);
    }
    $amount=$raw['payAmount']??'';
    hr_assert(is_string($amount)&&preg_match('/^[0-9]{1,10}$/D',$amount)===1,'급여 금액을 확인해 주세요.');
    $profile['payAmount']=(int)$amount;
    $days=$raw['workDays']??[];
    hr_assert(is_array($days)&&count($days)<=5,'근무요일을 확인해 주세요.');
    foreach($days as $day)hr_assert(is_string($day)&&in_array($day,['월','화','수','목','금'],true),'근무요일을 확인해 주세요.');
    $profile['workDays']=array_values(array_unique($days));
    // This form explicitly edits end dates. Do not let an old quick-term overwrite them.
    $profile['contractTerm']='';
    return $profile;
}
function personnel_field(array $profile,string $key,string $label,string $type='text',int $max=240,bool $required=false,string $class=''): void {
    $value=(string)($profile[$key]??'');
    echo '<label class="nf-field '.h($class).'">'.h($label).($required?' <span aria-label="필수">*</span>':'').'<input type="'.h($type).'" name="profile['.h($key).']" value="'.h($value).'" maxlength="'.$max.'"'.($required?' required':'').($type==='number'?' min="1" max="1000000000" step="1"':'').'></label>';
}
function personnel_select(array $profile,string $key,string $label,array $options): void {
    echo '<label class="nf-field">'.h($label).'<select name="profile['.h($key).']">';
    foreach($options as $value=>$text)echo '<option value="'.h((string)$value).'"'.((string)($profile[$key]??'')===(string)$value?' selected':'').'>'.h($text).'</option>';
    echo '</select></label>';
}
function personnel_textarea(array $profile,string $key,string $label,int $max=1000): void {
    echo '<label class="nf-field personnel-full">'.h($label).'<textarea name="profile['.h($key).']" rows="2" maxlength="'.$max.'">'.h((string)($profile[$key]??'')).'</textarea></label>';
}
function personnel_text(mixed $value): string {
    $value=is_scalar($value)?trim((string)$value):'';
    return $value===''?'—':$value;
}
function personnel_cells(string $label1,mixed $value1,string $label2,mixed $value2): void {
    echo '<tr><th>'.h($label1).'</th><td>'.nl2br(h(personnel_text($value1))).'</td><th>'.h($label2).'</th><td>'.nl2br(h(personnel_text($value2))).'</td></tr>';
}

function personnel_hourly_rate(int|float $amount): string {
    return rtrim(rtrim(number_format($amount,2,'.',','),'0'),'.').'원';
}

function personnel_next_number(): string {
    $day=str_replace('-','',hr_today());$q=db()->prepare('SELECT serial FROM hr_employee_sequences WHERE day=?');$q->execute([$day]);
    return 'cnc'.$day.str_pad((string)((int)$q->fetchColumn()+1),3,'0',STR_PAD_LEFT);
}
