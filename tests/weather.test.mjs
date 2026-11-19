import test from 'node:test';
import assert from 'node:assert/strict';
import {condition,dateKey,timeLabel,planningHours,recommend,nextWindow} from '../public/js/weather.js';
import {planningRows} from './fixtures.mjs';
const now=Date.parse('2030-01-10T07:00:00+02:00');
const prefs={date:'2030-01-10',duration:2,rainLimit:40,now};

test('date and time use Rwanda timezone across UTC midnight',()=>{
  const time=Date.parse('2030-01-09T23:30:00Z');
  assert.equal(dateKey(time),'2030-01-10');assert.equal(timeLabel(time),'01:30');
});
test('unknown and missing weather codes are not labelled as clear or stormy',()=>{
  assert.equal(condition(null).icon,'unknown');assert.equal(condition(94).icon,'unknown');assert.equal(condition(95).icon,'storm');
});
test('best window minimizes the highest hourly rain chance',()=>{
  const rows=planningRows(),windows=recommend(rows,prefs);
  assert.equal(windows[0].start,rows[2].start);assert.equal(windows[0].peakRain,15);
});
test('every hour must meet the limit; a low average cannot hide a wet hour',()=>{
  assert.equal(recommend(planningRows([0,80]),prefs).length,0);
});
test('unknown values never become zero-risk recommendations',()=>{
  for(const key of ['rain','wind','temperature','code']){
    const rows=planningRows([10,10]);rows[0][key]=null;
    assert.equal(recommend(rows,prefs).length,0,key);
  }
});
test('thunderstorm, high wind and temperatures outside comfort bounds are excluded',()=>{
  for(const [key,value] of [['code',95],['wind',26],['temperature',33],['temperature',11]]){
    const rows=planningRows([10,10]);rows[1][key]=value;
    assert.equal(recommend(rows,prefs).length,0,key);
  }
});
test('gaps cannot be combined into one activity window',()=>{
  const rows=planningRows([10,10,10]);rows.splice(1,1);
  assert.equal(recommend(rows,prefs).length,0);
});
test('already-started hours are excluded',()=>{
  const rows=planningRows([10,10,10]);
  const windows=recommend(rows,{...prefs,now:rows[0].start+1});
  assert.equal(windows[0].start,rows[1].start);
});
test('planning is limited to the chosen date and 06:00–18:00',()=>{
  const base=Date.parse('2030-01-10T00:00:00+02:00');
  const rows=Array.from({length:25},(_,i)=>({start:base+i*3600000,end:base+(i+1)*3600000,rain:10,temperature:24,wind:9,code:2}));
  const hours=planningHours(rows,'2030-01-10',base);
  assert.equal(hours.length,12);assert.equal(timeLabel(hours[0].start),'06:00');assert.equal(timeLabel(hours.at(-1).end),'18:00');
});
test('a window may end exactly at 18:00 but may not extend beyond it',()=>{
  const start=Date.parse('2030-01-10T16:00:00+02:00');
  const rows=planningRows([10,10,10]).map((row,i)=>({...row,start:start+i*3600000,end:start+(i+1)*3600000}));
  assert.equal(recommend(rows,prefs)[0].end,start+2*3600000);
  assert.equal(recommend(rows,{...prefs,duration:3}).length,0);
});
test('suggestions do not overlap and are limited to three',()=>{
  const windows=recommend(planningRows(Array(10).fill(10)),prefs);
  assert.equal(windows.length,3);
  assert.ok(windows.every((a,i)=>windows.every((b,j)=>i===j||a.end<=b.start||a.start>=b.end)));
});
test('one-hour and three-hour durations work; invalid preferences return no suggestions',()=>{
  const rows=planningRows([10,10,10]);
  assert.equal(recommend(rows,{...prefs,duration:3})[0].end-rows[0].start,3*3600000);
  assert.equal(recommend(rows,{...prefs,duration:1})[0].end-rows[0].start,3600000);
  assert.equal(recommend(rows,{...prefs,duration:0}).length,0);
  assert.equal(recommend(rows,{...prefs,rainLimit:NaN}).length,0);
});
test('overview searches a later day when today has no matching window',()=>{
  const rows=planningRows([10,10]);
  const later=rows.map(row=>({...row,start:row.start+86400000,end:row.end+86400000}));
  const forecast={rows:later,daily:[{date:'2030-01-10'},{date:'2030-01-11'}]};
  assert.equal(nextWindow(forecast,now).date,'2030-01-11');
});
