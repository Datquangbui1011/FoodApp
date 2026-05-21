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

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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
      extractFrames(videoPath, tempDir)
    ]);
    audioPath = extractedAudioPath;

    const transcript = await transcribeAudio(audioPath);
    const visionResult = await analyzeFrames(frames);
    const inference = await inferRestaurant(transcript, visionResult);

    let places: any[] = [];
    if (inference.topPick) {
      places = await lookupPlace(inference.topPick.name, inference.topPick.city);
    } else if (inference.candidates.length > 0) {
      const firstCandidate = inference.candidates[0];
      if (firstCandidate) places = await lookupPlace(firstCandidate.name, firstCandidate.city);
    }

    res.json({ 
      status: 'success', 
      url, 
      inference, 
      places 
    });
  } catch (error: any) {
    console.error('Error processing video:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  } finally {
    // Cleanup
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    if (videoPath) {
      const basename = path.basename(videoPath, path.extname(videoPath));
      const frameOutputDir = path.join(__dirname, '..', 'temp', `${basename}_frames`);
      if (fs.existsSync(frameOutputDir)) {
        fs.rmSync(frameOutputDir, { recursive: true, force: true });
      }
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
