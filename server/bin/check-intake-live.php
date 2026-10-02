<?php
// The sales fixture uses an isolated in-memory DB, never production records.
declare(strict_types=1);
require __DIR__.'/check-sales.php';require __DIR__.'/../lib/intake-live.php';
$before=$d->query('SELECT * FROM sales_records ORDER BY id')->fetchAll();
$all=intake_live_snapshot($admin,[]);
check($all['total']===(int)$d->query('SELECT COUNT(*) FROM sales_records WHERE is_test=0')->fetchColumn(),'all departments include actual receipts only');
check(count($all['records'])<=30&&$all['total']===array_sum($all['counts']),'bounded page and status counts agree');
$ids=array_map('intval',array_column($all['records'],'id'));$sorted=$ids;rsort($sorted);check($ids===$sorted,'newly registered rows appear first regardless of first call date');
$team=intake_live_snapshot($admin,['team'=>'cosmetics']);foreach($team['records'] as $row)check($row['department']==='cosmetics','department filter stays isolated');
$status=intake_live_snapshot($admin,['status'=>'pending']);foreach($status['records'] as $row)check($row['status']==='pending','status filter applies to rows');
check($status['total']===$all['counts']['pending'],'filtered total matches selected state');
$empty=intake_live_snapshot($admin,['q'=>'%']);check($empty['total']===0,'search wildcards are literal');
$latest=$all['records'][0];$search=intake_live_snapshot($admin,['q'=>str_replace('-','',$latest['phone'])]);check(in_array($latest['id'],array_column($search['records'],'id'),true),'phone search supports unformatted digits');
$after=max(1,$all['latestId']-1);$poll=intake_live_snapshot($admin,['after'=>(string)$after]);$q=$d->prepare('SELECT COUNT(*) FROM sales_records WHERE is_test=0 AND id>?');$q->execute([$after]);check($poll['newCount']===(int)$q->fetchColumn(),'new arrivals counted from last observed ID');
$d->exec("UPDATE app_users SET display_name='변경 상담원' WHERE id=".(int)$latest['employeeId']);$changed=intake_live_snapshot($admin,[]);check($changed['records'][0]['employee']==='변경 상담원','counselor name resolves from current employee identity');
rejects(fn()=>intake_live_snapshot($one,[]),'employees cannot monitor colleagues');
rejects(fn()=>intake_live_snapshot($admin,['team'=>'invalid']),'invalid department rejected');
check($before===$d->query('SELECT * FROM sales_records ORDER BY id')->fetchAll(),'monitoring never modifies receipt records');
echo "PASS: actual all-department live feed, filters, current counselor identity, bounded latest rows and read-only polling.\n";
