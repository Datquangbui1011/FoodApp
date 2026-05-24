import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { downloadVideo } from './services/downloader';
import { extractAudio, extractFrames } from './services/extractor';
import { transcribeAudio, analyzeFrames, inferRestaurant } from './services/ai';
import { lookupPlace } from './services/places';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

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

app.post('/process', requireApiKey, async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing video URL in request body' });
  }

  let videoPath = '';
  let audioPath = '';
  try {
    const tempDir = path.join(__dirname, '..', 'temp');
    videoPath = await downloadVideo(url, tempDir);

    const [extractedAudioPath, frames] = await Promise.all([
      extractAudio(videoPath, tempDir),
      extractFrames(videoPath, tempDir),
    ]);
    audioPath = extractedAudioPath;

    const transcript = await transcribeAudio(audioPath);
    const visionResult = await analyzeFrames(frames);
    const inference = await inferRestaurant(transcript, visionResult);

    if (!inference.topPick && inference.candidates.length === 0) {
      throw new Error("Restaurant couldn't be identified");
    }

    let places: any[] = [];
    if (inference.topPick) {
      places = await lookupPlace(inference.topPick.name, inference.topPick.city);
    } else {
      const first = inference.candidates[0];
      if (first) places = await lookupPlace(first.name, first.city);
    }

    res.json({ status: 'success', url, inference, places });
  } catch (error: any) {
    console.error('Error processing video:', error);
    const msg: string = error.message || 'Internal server error';
    const status = KNOWN_CLIENT_ERRORS.has(msg) ? 422 : 500;
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
