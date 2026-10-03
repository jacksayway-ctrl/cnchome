<section class="nf-card intake-live" data-intake-live>
 <div class="nf-actions intake-live-heading"><h2>전체 접수 관리</h2><span class="intake-live-indicator">● 실시간</span><span data-live-status role="status">접수 목록을 불러오는 중입니다.</span><button type="button" data-live-refresh>지금 새로고침</button><button type="button" data-live-pause aria-pressed="false">자동 갱신 일시정지</button></div>
 <p class="nf-muted">보험 · 화장품 · 건강보조식품의 실제 접수를 최신 등록순으로 확인합니다. 5초마다 자동 갱신됩니다.</p>
 <section class="intake-live-calendar" aria-labelledby="intake-live-calendar-title" data-live-calendar>
  <div class="intake-live-calendar-heading"><h3 id="intake-live-calendar-title">실적 달력</h3><div class="intake-live-calendar-month"><label>조회월 <input type="month" min="2000-01" max="2100-12" data-live-calendar-month aria-label="실적 달력 조회월"></label><button type="button" data-live-calendar-prev aria-label="실적 달력 이전 달">이전 달</button><button type="button" data-live-calendar-next aria-label="실적 달력 다음 달">다음 달</button><button type="button" data-live-calendar-today>이번 달</button></div></div>
  <div class="intake-live-calendar-totals" data-live-calendar-totals aria-label="부서별 월 합계"></div>
  <div class="intake-live-calendar-caption"><p>가접수는 최초 콜 날짜, 정상접수·A/S는 상태 변경 날짜 기준입니다. 달력은 목록의 검색 조건과 관계없이 전체 부서를 보여줍니다.</p><span class="intake-live-calendar-legend"><span class="pending">가: 가접수</span><span class="normal">정: 정상접수</span><span class="as">AS: A/S</span></span></div>
  <p class="nf-muted intake-live-calendar-message" data-live-calendar-message role="status">실적 달력을 불러오는 중입니다.</p>
  <div class="intake-live-calendar-scroll" tabindex="0" role="region" aria-label="부서별 월 실적 달력"><table class="intake-live-calendar-grid"><colgroup><col span="7"></colgroup><thead><tr><?php foreach(['일','월','화','수','목','금','토'] as $day): ?><th scope="col"><?= $day ?></th><?php endforeach ?></tr></thead><tbody data-live-calendar-days aria-busy="true"></tbody></table></div>
 </section>
 <form class="intake-live-filters" data-live-filters><label>부서 <select name="team"><option value="">전체 부서</option><?php foreach(management_departments() as $key=>$label): ?><option value="<?= view_h($key) ?>"><?= view_h($label) ?></option><?php endforeach ?></select></label><label>이름 또는 전화번호 <input type="search" name="q" maxlength="80" placeholder="이름 · 전화번호"></label><button type="submit">검색</button><button type="reset">초기화</button></form>
 <div class="intake-live-counts" role="group" aria-label="접수 상태별 조회"><?php foreach([''=>'전체 접수','pending'=>'가접수','normal'=>'정상접수','as'=>'A/S'] as $key=>$label): ?><button type="button" data-live-filter="<?= $key ?>" aria-pressed="<?= $key===''?'true':'false' ?>"><?= $label ?> <strong data-live-count="<?= $key ?>">—</strong>건</button><?php endforeach ?></div>
 <div class="intake-live-arrivals" data-live-arrivals role="status" hidden></div>
 <div class="nf-table-wrap"><table class="nf-table intake-live-table"><thead><tr><th>등록일시</th><th>최초 콜 날짜</th><th>부서</th><th>상담원</th><th>고객명</th><th>전화번호</th><th>지역</th><th>접수 상태</th><th>상세</th></tr></thead><tbody data-live-rows><tr><td colspan="9">접수 목록을 불러오는 중입니다.</td></tr></tbody></table></div>
 <div class="intake-pagination"><button type="button" data-live-page="prev" disabled>이전</button><span data-live-pagination>1 / 1 페이지</span><button type="button" data-live-page="next" disabled>다음</button></div>
</section>
<script src="<?= view_h(asset_url('intake-live.js')) ?>" defer></script>
