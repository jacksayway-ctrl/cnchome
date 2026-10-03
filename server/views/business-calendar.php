<?php $date=new DateTimeImmutable($month.'-01');$previous=$date->modify('-1 month')->format('Y-m');$next=$date->modify('+1 month')->format('Y-m'); ?>
<?php if($error): ?><p class="nf-alert" role="alert"><?=view_h($error)?></p><?php endif; ?>
<?php if($saved): ?><p class="bc-saved" role="status">영업일 달력을 저장했습니다. 영업일 수와 그레이드 계산에 반영됩니다.</p><?php endif; ?>
<section class="nf-card bc-panel">
 <div class="bc-toolbar"><form method="get"><input type="hidden" name="role" value="admin"><label>조회 월 <input type="month" name="month" value="<?=view_h($month)?>" min="2000-01" max="2099-12" required></label><button type="submit">이동</button></form><a href="?role=admin&amp;month=<?=view_h($previous)?>">이전 달</a><a href="?role=admin&amp;month=<?=view_h($next)?>">다음 달</a></div>
 <p>날짜를 누르면 <strong>영업일 ↔ 휴일</strong>로 바뀝니다. 선택을 마친 뒤 저장해 주세요.</p>
 <form method="post" action="?role=admin&amp;month=<?=view_h($month)?>">
  <?=native_csrf()?><input type="hidden" name="month" value="<?=view_h($month)?>"><input type="hidden" name="revision" value="<?=$data['revision']?>">
  <div class="bc-scroll"><div class="bc-grid" role="group" aria-label="<?=view_h($month)?> 영업일 선택">
   <?php foreach(['월','화','수','목','금','토','일'] as $name): ?><strong class="bc-weekday"><?=$name?></strong><?php endforeach; ?>
   <?php foreach(business_calendar_grid_dates($month) as $day): ?><?php if(substr($day,0,7)!==$month): ?><span class="bc-day bc-outside-month" aria-label="<?=$day?>"><span class="bc-day-box"><strong><?=(int)substr($day,5,2)?>월 <?=(int)substr($day,8)?></strong></span></span><?php else: ?><label class="bc-day"><input type="checkbox" name="days[]" value="<?=$day?>" <?=in_array($day,$data['days'],true)?'checked':''?> aria-label="<?=$day?> 영업일"><span class="bc-day-box"><strong><?=(int)substr($day,8)?></strong><span class="bc-business">영업일</span><span class="bc-holiday">휴일</span></span></label><?php endif; ?><?php endforeach; ?>
  </div></div>
  <div class="bc-footer"><span>불러온 기준: 영업일 <?=$savedCount?>일 · 휴일 <?=count($dates)-$savedCount?>일</span><button class="primary" type="submit">영업일 저장</button></div>
 </form>
 <p class="bc-help">기본값은 월~금 영업일, 토·일 휴일입니다. 주그레이드는 월~금 중 영업일과 직원 근무요일을 반영하며, 기준 지급일수는 5일입니다. 실제 근무기록과 이미 확정된 명세서는 그대로 유지됩니다.</p>
 <?php if($data['savedAt']): ?><small>최근 저장: <?=view_h((new DateTimeImmutable($data['savedAt'],new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i'))?> · <?=view_h($data['savedBy'])?></small><?php endif; ?>
</section>

<?php $companyHolidays=$companyHolidays??[];$holidayDraft=$holidayDraft??['date'=>'','name'=>'']; ?>
<section class="nf-card bc-panel" id="company-holidays">
 <h2>공휴일·회사 휴일 지정</h2>
 <?php if($holidaySaved??false): ?><p class="bc-saved" role="status">지정 휴일을 저장했습니다.</p><?php endif; ?>
 <p class="bc-help">법정공휴일은 자동으로 표시됩니다. 추가 지정한 휴일명도 모든 달력에 함께 표시됩니다. 근무일 설정은 위 달력에서 따로 저장해 주세요.</p>
 <form method="post" action="?role=admin&amp;month=<?=view_h($month)?>#company-holidays" class="bc-toolbar">
  <?=native_csrf()?><input type="hidden" name="month" value="<?=view_h($month)?>"><input type="hidden" name="action" value="holiday_add">
  <label class="nf-field">휴일 날짜<input type="date" name="date" value="<?=view_h($holidayDraft['date'])?>" min="<?=view_h($month.'-01')?>" max="<?=view_h($date->format('Y-m-t'))?>" required></label>
  <label class="nf-field">휴일명<input name="name" value="<?=view_h($holidayDraft['name'])?>" maxlength="80" placeholder="예: 회사 창립기념일" required></label>
  <button class="primary" type="submit">휴일 지정 저장</button>
 </form>
 <details open>
  <summary>지정된 휴일 · <?=count($companyHolidays)?>건</summary>
  <div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>날짜</th><th>휴일명·관리</th><th>최근 변경</th></tr></thead><tbody>
   <?php foreach($companyHolidays as $holiday): ?>
   <tr><td><?=view_h($holiday['date'])?></td><td>
    <form method="post" action="?role=admin&amp;month=<?=view_h($month)?>#company-holidays" class="bc-toolbar">
     <?=native_csrf()?><input type="hidden" name="month" value="<?=view_h($month)?>"><input type="hidden" name="date" value="<?=view_h($holiday['date'])?>"><input type="hidden" name="revision" value="<?=$holiday['revision']?>">
     <input name="name" aria-label="<?=view_h($holiday['date'])?> 휴일명" value="<?=view_h($holiday['name'])?>" maxlength="80" required>
     <button type="submit" name="action" value="holiday_update">휴일명 저장</button><button type="submit" name="action" value="holiday_remove" formnovalidate>휴일 지정 해제</button>
    </form>
   </td><td><?=view_h((new DateTimeImmutable($holiday['savedAt']))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i'))?> · <?=view_h($holiday['savedBy'])?></td></tr>
   <?php endforeach; ?>
   <?php if(!$companyHolidays): ?><tr><td colspan="3">이 달에 추가 지정한 휴일이 없습니다.</td></tr><?php endif; ?>
  </tbody></table></div>
 </details>
</section>
