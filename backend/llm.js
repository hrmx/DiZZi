import process from 'node:process';
import ollama from 'ollama';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, rm } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

const MODEL = process.env.LLM_MODEL || 'gemma3:4b';
const PLAYER_NAME = (process.env.PLAYER_NAME || '').trim();
const TTS_VOICE = process.env.TTS_VOICE || 'Kyoko';

function buildSystemPrompt(name) {
  const who = name ? `「${name}」` : '「きみ」';
  return `あなたは「ディジー」。ベイブレードXのシュートを見守る、明るくておしゃべりなAIの相棒です。
${name ? `プレイヤーは子どもの「${name}」です。\n` : ''}ベイブレードはひもを引いて回すコマで、シュートの強さはRPM（回転数）であらわします。
RPMの目安: 3000未満は弱め、3000〜7000はまずまず、7000以上はすごい。

ルール:
- 必ず日本語の話し言葉で、1文だけ、30文字以内で答える。
- 英語、ローマ字、絵文字、記号、マークダウンは使わない。
- 子ども向けなので、むずかしい漢字や専門用語は使わない。
- 7割は励まし、3割はちょっとだけ茶化す。悪口や決めつけはしない。
${name ? `- ときどき「${name}」と名前を呼ぶ（毎回でなくてよい）。\n` : ''}- 「前より上がった／下がった」と書いてあるときだけ、その流れにふれる。はじめてのシュートや「だいたい同じ」のときは、前との比べ方をしない。
- 数字の計算はしない。渡された数字だけを使う。

例: 「${who}、今のは強いぞ！」
例: 「おっ、ちょっと手がぬけたかな？」
例: 「前より上がってる、その調子！」`;
}

const SYSTEM_PROMPT = buildSystemPrompt(PLAYER_NAME);

// Speaks via macOS `say`; text goes through stdin so a leading "-" is never parsed as an option.
export async function speak(text, voice = TTS_VOICE) {
  const tmpPath = join(tmpdir(), `dizzi-${randomUUID()}.wav`);
  try {
    const child = execFileAsync('say', ['-v', voice, '-o', tmpPath, '--data-format=LEI16@24000']);
    child.child.stdin.end(text);
    await child;
    return await readFile(tmpPath);
  } catch (err) {
    throw new Error(`say failed (voice "${voice}"): ${err.stderr || err.message}`.trim(), { cause: err });
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export function describeLaunches(launchesValues) {
  const lastItem = launchesValues.at(-1);
  const previous = launchesValues.slice(-4, -1);

  if (previous.length === 0) {
    return `はじめてのシュート: ${lastItem} RPM。`;
  }

  const avgPrevious = Math.round(previous.reduce((a, b) => a + b, 0) / previous.length);
  const diff = lastItem - avgPrevious;
  const trend = diff > 300 ? '上がった' : diff < -300 ? '下がった' : 'だいたい同じ';

  return `前の数回のシュート: ${previous.join('、')} RPM（平均 ${avgPrevious}）。今回のシュート: ${lastItem} RPM。前より${trend}。`;
}

// loads the model into memory so the first real launch doesn't wait for it
export async function warmUpBrain() {
  await ollama.chat({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: describeLaunches([5000]) },
    ],
    keep_alive: -1,
    options: { num_predict: 1 },
  });
}

export function toSpeakableText(text) {
  return text
    .split('\n')[0]                        // first line only
    .replace(/^\s*例\s*[:：]\s*/, '')       // leading "例:" label
    .replace(/[*_`#~>＊]/g, '')             // markdown symbols
    .replace(/\p{Extended_Pictographic}/gu, '') // emojis
    .replace(/[「」『』“”"]/g, '')          // quotes and Japanese brackets
    .replace(/^'|'$/g, '')                 // surrounding single quotes
    .replace(/\s+/g, ' ')                  // collapse leftover spaces
    .trim();
}

export function isJapanese(text) {
  return /[぀-ヿ㐀-鿿]/.test(text || '');
}

const FALLBACKS = {
  weak: ['もっと思いっきり引いてみよう！', 'まだまだこれから、次いこう！', 'ちょっと手がぬけたかな？もう一回！'],
  ok: ['いいね、その調子！', 'まずまずだよ、もっといけるよ！', 'いい回転だね、次も楽しみ！'],
  great: ['すごい！今のは強いぞ！', 'おお、ものすごい回転だ！', 'さいこうのシュートだね！'],
};

export function fallbackComment(rpm, name = PLAYER_NAME) {
  const tier = rpm < 3000 ? 'weak' : rpm < 7000 ? 'ok' : 'great';
  const list = FALLBACKS[tier];
  const phrase = list[Math.floor(Math.random() * list.length)];
  return name ? `${name}、${phrase}` : phrase;
}

async function generate(launchesValues, hint) {
  const userContent = describeLaunches(launchesValues) + (hint ? `\n${hint}` : '');
  const response = await ollama.chat({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    stream: false,
    keep_alive: -1,
    options: { num_predict: 60, temperature: 0.8 },
  });
  return toSpeakableText(response.message.content);
}

export async function askBrain({ launchesValues }) {
  let comment = await generate(launchesValues);
  if (!isJapanese(comment)) {
    comment = await generate(launchesValues, '日本語で');
  }
  if (!isJapanese(comment)) {
    return fallbackComment(launchesValues.at(-1));
  }
  return comment;
}
