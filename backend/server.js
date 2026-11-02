import process from 'node:process';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { startBluetooth, bleEvents, sendReset, getRecordings } from './scanner.js';
import { pickComment, AUDIO_DIR } from './comments.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const HOST = process.env.HOST || '0.0.0.0';
const AI_ENABLED = process.env.AI_ENABLED === "true";

const llm = AI_ENABLED ? await import('./llm.js') : null;

const app = express();
const server = createServer(app);

let deviceStatus = 'disconnected';

app.use(express.json());

app.get('/api/config', (_req, res) => {
  res.json({ aiEnabled: AI_ENABLED, playerName: process.env.PLAYER_NAME || '' });
});

app.post('/api/tts', async (req, res) => {
  if (!AI_ENABLED) return res.status(404).json({ error: 'AI disabled' });

  const { text, voice } = req.body;
  if (typeof text !== 'string' || !text) return res.status(400).json({ error: 'text is required' });

  try {
    const wav = await llm.speak(text, voice);
    res.set('Content-Type', 'audio/wav');
    res.send(wav);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.use('/api/audio', express.static(AUDIO_DIR));

app.post('/api/recordings', async (req, res) => {
  try {
    await getRecordings();
    res.json({ message: 'REQ SENT!' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    await sendReset();
    res.json({ message: 'RESET OK!' });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

const DEBUG = process.env.DEBUG === 'true';
const fakeLaunches = [];

if (DEBUG) {
  console.log('DEBUG endpoints enabled: POST /api/debug/launch');

  // emits a fake launch shaped like decoder.js output, so the normal recording handler runs
  app.post('/api/debug/launch', (req, res) => {
    const rpm = req.body?.rpm;
    if (typeof rpm !== 'number' || !Number.isFinite(rpm) || rpm <= 0) {
      return res.status(400).json({ error: 'rpm must be a positive number' });
    }

    fakeLaunches.push(rpm);
    const launchesValues = [...fakeLaunches];
    bleEvents.emit('recording', {
      highScore: Math.max(...launchesValues),
      launchesValues,
      lifetimeCounter: launchesValues.length,
      status: 'launched',
      battery: 100,
    });
    res.json({ message: 'FAKE LAUNCH SENT!', launchesValues });
  });
}

app.use(express.static(DIST));

const wss = new WebSocketServer({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

wss.on('connection', (socket) => {
  console.log('client connected total: ', wss.clients.size);
  socket.send(JSON.stringify({ type: 'device', device: deviceStatus }));
  socket.on('close', () => console.log('client left, total: ', wss.clients.size));
});

bleEvents.on('device', (device) => {
  deviceStatus = device;
  broadcast({ type: 'device', device });
});

bleEvents.on('recording', async (recording) => {
  broadcast({ type: 'recording', recording });

  if (recording.status !== 'launched') return;

  // without AI we skip ollama entirely and pick a prerecorded clip
  if (!AI_ENABLED) {
    broadcast({ type: 'comment', comment: pickComment(recording) });
    return;
  }

  try {
    const comment = await llm.askBrain(recording);
    console.log('Comment:', comment);

    broadcast({ type: 'comment', comment });
  } catch (err) {
    console.error('LLM comment failed:', err.message);
  }
});

const PORT = process.env.BACKEND_PORT || 4567;

export const ready = new Promise((resolve) => {
  server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    startBluetooth();

    if (AI_ENABLED) {
      console.log("Loading AI features...");
      // load both models in the background so the first launch isn't slow
      llm.speak("こんにちは")
        .then(() => { console.log('Voice model ready'); })
        .catch((err) => console.error('Voice model warm-up failed: ', err.message));

      llm.warmUpBrain()
        .then(() => console.log('LLM model ready'))
        .catch((err) => console.error('LLM warm-up failed:', err.message));
    } else {
      console.log("AI features DISABLED, using prerecorded clips");
    }

    resolve();
  });
});
