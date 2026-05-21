import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { downloadVideo } from './services/downloader';
import { extractAudio, extractFrames } from './services/extractor';
import { transcribeAudio, analyzeFrames, inferRestaurant } from './services/ai';
import { lookupPlace } from './services/places';

dotenv.config();

async function runTest(url: string) {
  const tempDir = path.join(__dirname, '..', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let videoPath = '';
  let audioPath = '';
  
  try {
    console.log(`[1/6] Downloading video from ${url}...`);
    videoPath = await downloadVideo(url, tempDir);
    console.log(`Downloaded to: ${videoPath}`);

    console.log(`[2/6] Extracting audio and frames...`);
    const [extractedAudioPath, frames] = await Promise.all([
      extractAudio(videoPath, tempDir),
      extractFrames(videoPath, tempDir)
    ]);
    audioPath = extractedAudioPath;
    console.log(`Extracted audio to: ${audioPath}`);
    console.log(`Extracted ${frames.length} frames.`);

    console.log(`[3/6] Transcribing audio with Whisper...`);
    const transcript = await transcribeAudio(audioPath);
    console.log(`Transcript: ${transcript}`);

    console.log(`[4/6] Analyzing frames with GPT-4o Vision...`);
    const visionResult = await analyzeFrames(frames);
    console.log(`Vision result:`, visionResult);

    console.log(`[5/6] Inferring restaurant...`);
    const inference = await inferRestaurant(transcript, visionResult);
    console.log(`Inference result:`, inference);

    console.log(`[6/6] Looking up on Google Places...`);
    if (inference.topPick) {
      const places = await lookupPlace(inference.topPick.name, inference.topPick.city);
      console.log(`Places result:`, JSON.stringify(places, null, 2));
    } else if (inference.candidates.length > 0) {
      const firstCandidate = inference.candidates[0];
      if (firstCandidate) {
        const places = await lookupPlace(firstCandidate.name, firstCandidate.city);
        console.log(`Fallback places result for first candidate:`, JSON.stringify(places, null, 2));
      }
    } else {
      console.log('No suitable candidates found to lookup.');
    }

  } catch (error) {
    console.error('Pipeline error:', error);
  } finally {
    // Cleanup
    console.log('Cleaning up temporary files...');
    if (videoPath && fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
    if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    // Cleanup frames dir
    if (videoPath) {
      const basename = path.basename(videoPath, path.extname(videoPath));
      const frameOutputDir = path.join(tempDir, `${basename}_frames`);
      if (fs.existsSync(frameOutputDir)) {
        fs.rmSync(frameOutputDir, { recursive: true, force: true });
      }
    }
  }
}

const urlArg = process.argv[2];
if (!urlArg) {
  console.error('Please provide a URL to test. Example: npm run test "https://www.tiktok.com/@..."');
  process.exit(1);
}

runTest(urlArg);
