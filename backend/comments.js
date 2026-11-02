import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import _ from 'lodash';

const DEFAULT_AUDIO_DIR = fileURLToPath(new URL('./public/audio', import.meta.url));
const LOCAL_AUDIO_DIR = fileURLToPath(new URL('./public/audio-local', import.meta.url));

// name-embedded clips are generated locally (scripts/gen-ja-clips.mjs) and gitignored
export const AUDIO_DIR = existsSync(LOCAL_AUDIO_DIR) ? LOCAL_AUDIO_DIR : DEFAULT_AUDIO_DIR;

// same threshold the frontend uses for spin_slow / spin_fast
const GOOD_LAUNCH_RPM = 5000;

const clips = readdirSync(AUDIO_DIR).map((file) => file.replace(/\.wav$/, ''));
const praises = clips.filter((name) => name.startsWith('praise_'));
const roasts = clips.filter((name) => name.startsWith('roast_'));

export function pickComment({ launchesValues }) {
  return _.sample(launchesValues.at(-1) >= GOOD_LAUNCH_RPM ? praises : roasts);
}
