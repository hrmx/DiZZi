import { test } from 'node:test';
import process from 'node:process';
import assert from 'node:assert/strict';

process.env.PLAYER_NAME = 'テストくん';
const { describeLaunches, toSpeakableText, isJapanese, fallbackComment } = await import('./llm.js');

test('describeLaunches: first launch', () => {
  assert.equal(describeLaunches([4200]), 'はじめてのシュート: 4200 RPM。');
});

test('describeLaunches: trend up / down / same', () => {
  assert.match(describeLaunches([2000, 2000, 2000, 5000]), /平均 2000.*今回のシュート: 5000 RPM。前より上がった。/);
  assert.match(describeLaunches([5000, 5000, 5000, 2000]), /前より下がった。/);
  assert.match(describeLaunches([5000, 5100, 4900, 5100]), /前よりだいたい同じ。/);
});

test('describeLaunches: uses at most 3 previous launches', () => {
  assert.match(describeLaunches([1, 2000, 2000, 2000, 2000]), /2000、2000、2000 RPM/);
});

test('toSpeakableText: strips brackets, markdown, emoji, label, extra lines', () => {
  assert.equal(toSpeakableText('「テストくん、今のは強いぞ！」'), 'テストくん、今のは強いぞ！');
  assert.equal(toSpeakableText('**すごい**＊ね🔥'), 'すごいね');
  assert.equal(toSpeakableText('例: 「いいね！」'), 'いいね！');
  assert.equal(toSpeakableText('一行目！\n二行目'), '一行目！');
  assert.equal(toSpeakableText('『やった？』'), 'やった？');
});

test('isJapanese', () => {
  assert.equal(isJapanese('いいね！'), true);
  assert.equal(isJapanese('カタカナ'), true);
  assert.equal(isJapanese('強い'), true);
  assert.equal(isJapanese('Nice launch!'), false);
  assert.equal(isJapanese(''), false);
  assert.equal(isJapanese(undefined), false);
});

test('fallbackComment: Japanese for each tier, name from env default', () => {
  for (const rpm of [1000, 5000, 9000]) {
    const c = fallbackComment(rpm);
    assert.ok(isJapanese(c));
    assert.ok(c.startsWith('テストくん、'));
  }
});

test('fallbackComment: no name when empty, tiers differ', () => {
  const sets = [1000, 5000, 9000].map((rpm) => {
    const s = new Set();
    for (let i = 0; i < 100; i++) s.add(fallbackComment(rpm, ''));
    return s;
  });
  for (const s of sets) for (const c of s) assert.ok(isJapanese(c) && !c.includes('、テストくん'));
  assert.equal(sets[0].has([...sets[2]][0]), false);
  assert.equal(sets[1].has([...sets[2]][0]), false);
});
