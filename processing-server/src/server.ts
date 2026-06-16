import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { downloadVideo } from './services/downloader';
import { extractAudio, extractFrames } from './services/extractor';
import { transcribeAudio, analyzeFrames, inferRestaurant } from './services/ai';
import { lookupPlace } from './services/places';
import { fetchVideoMetadata } from './services/metadata';
import { getCached, setCache } from './services/cache';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// CORS — allow browser requests from Vercel frontend and local dev
app.use((req: Request, res: Response, next: express.NextFunction) => {
  const allowed = ['https://foody-pied.vercel.app', 'http://localhost:3000', 'http://localhost:3001'];
  const origin = req.headers.origin as string | undefined;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-api-key');
  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// API Key middleware
const requireApiKey = (req: Request, res: Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
};

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

const KNOWN_CLIENT_ERRORS = new Set([
  'private_video', 'unsupported_url', 'download_failed', 'download_timeout',
  "Restaurant couldn't be identified",
]);

function normalizeError(error: any): { msg: string; status: number } {
  const raw: string = error?.message ?? 'Internal server error';
  if (error?.status === 429 || raw.startsWith('429')) {
    return { msg: 'AI service is busy — please try again in a moment', status: 429 };
  }
  const status = KNOWN_CLIENT_ERRORS.has(raw) ? 422 : 500;
  return { msg: raw, status };
}

app.post('/process', requireApiKey, async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing video URL in request body' });
  }

  // Return cached result instantly if we've processed this URL before
  const cached = await getCached(url);
  if (cached) {
    console.log('Cache hit:', url);
    return res.json({ ...cached, _cached: true });
  }

  let videoPath = '';
  let audioPath = '';
  try {
    const tempDir = path.join(__dirname, '..', 'temp');

    // Fetch caption first — free, fast, most accurate signal
    const metadata = await fetchVideoMetadata(url);
    const caption = [metadata.title, metadata.description].filter(Boolean).join('\n\n');
    console.log('Caption extracted:', caption.slice(0, 120));

    videoPath = await downloadVideo(url, tempDir);

    const [extractedAudioPath, frames] = await Promise.all([
      extractAudio(videoPath, tempDir),
      extractFrames(videoPath, tempDir),
    ]);
    audioPath = extractedAudioPath;

    const transcript = await transcribeAudio(audioPath);
    const visionResult = await analyzeFrames(frames);
    const inference = await inferRestaurant(transcript, visionResult, caption);

    if (inference.restaurants.length === 0) {
      throw new Error("Restaurant couldn't be identified");
    }

    // Look up all restaurants in parallel (up to 10)
    const allPlaces = await Promise.all(
      inference.restaurants.slice(0, 10).map(async r => ({
        name: r.name,
        confidence: r.confidence,
        menuItems: r.menuItems,
        cuisineType: r.cuisineType,
        places: await lookupPlace(r.name, r.city),
      }))
    );

    // Legacy: top result's places array for any old clients
    const places = allPlaces[0]?.places ?? [];

    const result = { status: 'success', url, inference, places, allPlaces, _debug: { caption, transcript, visionResult } };
    await setCache(url, result);
    res.json(result);
  } catch (error: any) {
    console.error('Error processing video:', error);
    const { msg, status } = normalizeError(error);
    res.status(status).json({ error: msg });
  } finally {
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    if (videoPath) {
      const basename = path.basename(videoPath, path.extname(videoPath));
      const frameOutputDir = path.join(__dirname, '..', 'temp', `${basename}_frames`);
      if (fs.existsSync(frameOutputDir)) fs.rmSync(frameOutputDir, { recursive: true, force: true });
    }
  }
});

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

app.listen(port, () => {
  console.log(`Processing server listening on port ${port}`);
});
