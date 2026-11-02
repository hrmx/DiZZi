// Generate Japanese prerecorded voice clips with macOS `say`.
// Usage: node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/gen-ja-clips.mjs [--out <dir>]
// Env: PLAYER_NAME (optional; embeds the name in some clips), TTS_VOICE (default Kyoko).
// Default output: backend/public/audio (no name) or backend/public/audio-local (name set, gitignored).
import { execFile } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = (process.env.PLAYER_NAME ?? '').trim();
const voice = (process.env.TTS_VOICE ?? '').trim() || 'Kyoko';

const outFlag = process.argv.indexOf('--out');
const root = (p) => fileURLToPath(new URL(p, import.meta.url));
const outDir =
  outFlag !== -1 && process.argv[outFlag + 1]
    ? process.argv[outFlag + 1]
    : root(name ? '../backend/public/audio-local' : '../backend/public/audio');

// [clip, text with {name}, text without a name (omit if identical)]
const phrases = [
  ['shoot1', '3、2、1、ゴーシュート！'],
  ['shoot2', 'いくぞ、{name}！', 'いくぞ！'],
  ['drop', 'あれ、ベイを落としちゃった？'],
  ['reset', 'リセットしたよ！'],
  ['load', 'データを読み込んだよ！'],
  ['praise_best', 'すごい！今のは最高のシュートだ！'],
  ['praise_keep', 'その調子、{name}！', 'その調子、その調子！'],
  ['praise_power', 'パワフル！ひもの引きがバッチリだね！'],
  ['praise_champion', '{name}、チャンピオンみたいなシュート！', 'チャンピオンみたいなシュート！'],
  ['praise_spin', '見て見て、回転がすごく速い！'],
  ['praise_pro', 'プロみたいな一発！やるなあ！'],
  ['praise_more', 'おお、まだまだ強くなれそうだね！'],
  ['praise_wow', 'うわあ、ビリビリくるシュートだ！'],
  ['roast_pull', 'おっと、ひもはもっと思いきり引いてみよう！'],
  ['roast_gentle', '今のはちょっと優しすぎたかな？'],
  ['roast_sleepy', '{name}、まだねむいの？もう一回！', 'あれ、まだねむいの？もう一回！'],
  ['roast_warmup', 'ウォーミングアップかな？次は本気で！'],
  ['roast_wobble', 'ふらふらしてるぞ、しっかりかまえて！'],
  ['roast_next', 'うーん、次はもっといけるはず！'],
  ['roast_power', 'パワーが足りないぞ、ごはん食べた？'],
  ['roast_again', '{name}、今のはなかったことにしよう！', '今のはなかったことにしよう！'],
];

function say(text, path) {
  return new Promise((resolve, reject) => {
    const child = execFile('say', ['-v', voice, '-o', path, '--data-format=LEI16@24000'], (err) =>
      err ? reject(err) : resolve(),
    );
    child.stdin.end(text); // say reads the text from stdin when no argument is given
  });
}

mkdirSync(outDir, { recursive: true });
console.log(`output dir: ${outDir}`);
console.log(`voice: ${voice}`);
console.log(`name embedded: ${name ? 'yes' : 'no'}`);

for (const [clip, withName, noName = withName] of phrases) {
  const text = name ? withName.replaceAll('{name}', name) : noName;
  const path = join(outDir, `${clip}.wav`);
  await say(text, path);
  console.log(`wrote ${path}`);
}
