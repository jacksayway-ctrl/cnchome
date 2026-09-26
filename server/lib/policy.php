<?php
declare(strict_types=1);
function bounded(mixed $v, int $min=0): int {
    if (!is_int($v) || $v<$min || $v>100000000) throw new InvalidArgumentException('건수와 금액은 허용 범위의 정수로 입력해 주세요.');
    return $v;
}
function valid_day(mixed $s): bool {
    if (!is_string($s) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D',$s) || $s<'2000-01-01' || $s>'2099-12-31') return false;
    [$y,$m,$d]=array_map('intval',explode('-',$s)); return checkdate($m,$d,$y);
}
function normalize_policy(mixed $p): array {
    if (!is_array($p) || ($p['version']??null)!==1 || !in_array($p['weeklyBasis']??null,['average','total'],true)) throw new InvalidArgumentException('그레이드 기준 형식이 올바르지 않습니다.');
    $out=['version'=>1,'weeklyBasis'=>$p['weeklyBasis']];
    $out['dailyCash']=['start'=>bounded($p['dailyCash']['start']??null,1),'perCase'=>bounded($p['dailyCash']['perCase']??null)];
    foreach(['daily','weekly','monthly'] as $period) {
        $rows=$p[$period]??null;
        if (!is_array($rows) || !array_is_list($rows) || count($rows)<1 || count($rows)>($period==='weekly'?21:100)) throw new InvalidArgumentException('그레이드 행 수를 확인해 주세요.');
        $out[$period]=[]; $exclusive=$period==='weekly' && $out['weeklyBasis']==='average';
        foreach($rows as $i=>$r) {
            if (!is_array($r)) throw new InvalidArgumentException('행 형식을 확인해 주세요.');
            $v=[];
            foreach(['min','max','hourly','achievement','extraStart','extra'] as $key) {
                if (!array_key_exists($key,$r)) throw new InvalidArgumentException('필수 값이 없습니다.');
                $v[$key]=in_array($key,['max','extraStart'],true)&&$r[$key]===null?null:bounded($r[$key]);
            }
            if (($i===0 && $v['min']!==0) || ($i>0 && $v['min']!==$out[$period][$i-1]['max']+($exclusive?0:1)) || ($i<count($rows)-1 && $v['max']===null) || ($i===count($rows)-1 && $v['max']!==null) || ($v['max']!==null && ($exclusive?$v['max']<=$v['min']:$v['max']<$v['min']))) throw new InvalidArgumentException('구간이 겹치거나 누락되었습니다.');
            if ($v['extra']>0 && ($v['extraStart']===null || $v['extraStart']<$v['min'] || ($v['max']!==null && ($exclusive?$v['extraStart']>=$v['max']:$v['extraStart']>$v['max'])))) throw new InvalidArgumentException('추가수당 시작값을 확인해 주세요.');
            $out[$period][]=$v;
        }
    }
    if (isset($p['monthlyReference'])) {
        $rows=$p['monthlyReference'];
        if (!is_array($rows) || !array_is_list($rows) || count($rows)!==9) throw new InvalidArgumentException('월 기준표는 9개 구간이어야 합니다.');
        $previous=0;
        foreach($rows as $i=>$r) {
            $max=$i===8?null:bounded($r['max']??null);
            if (($i===8 && ($r['max']??null)!==null) || ($max!==null && ($max>99999999 || ($i>0 && $max<=$previous)))) throw new InvalidArgumentException('월 구간을 확인해 주세요.');
            $v=['max'=>$max,'hourly'=>bounded($r['hourly']??null,15000),'achievement'=>bounded($r['achievement']??null),'threshold'=>bounded($r['threshold']??null),'extra'=>bounded($r['extra']??null),'example'=>bounded($r['example']??null)];
            $v['label']=$i===0?number_format($max).'건 이하':number_format($previous+1).($max===null?'건 이상':'~'.number_format($max).'건');
            $out['monthlyReference'][]=$v; $previous=$max;
        }
    }
    foreach(['weeklyDraftVersion','weeklyStartEightVersion','monthlyManualVersion'] as $key) if (($p[$key]??null)===1) $out[$key]=1;
    if (isset($p['weeklyAuto'])) {
        $out['weeklyAuto']=['start'=>bounded($p['weeklyAuto']['start']??null,1),'amount'=>bounded($p['weeklyAuto']['amount']??null),'step'=>bounded($p['weeklyAuto']['step']??null)];
        if ($out['weeklyAuto']['start']+19>100000000 || $out['weeklyAuto']['amount']+$out['weeklyAuto']['step']*19>100000000) throw new InvalidArgumentException('주 기준 최대값을 초과했습니다.');
    }
    return $out;
}
