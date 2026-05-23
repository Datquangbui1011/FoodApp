import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const MODEL = 'gemini-2.0-flash-lite'; // 1500 RPD free tier

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err instanceof GoogleGenerativeAIFetchError && err.status === 429;
      const isDaily = is429 && err.message.includes('PerDay');
      // Don't retry daily quota exhaustion — it won't help until tomorrow
      if (is429 && !isDaily && attempt < retries) {
        const match = err.message.match(/retry in (\d+)/i);
        const delay = match ? parseInt(match[1]) * 1000 + 2000 : 45000;
        console.log(`Gemini 429 (rate limit) — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (isDaily) {
        throw new Error('Gemini daily quota exceeded. Try again tomorrow or enable billing at console.cloud.google.com');
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export async function transcribeAudio(audioPath: string): Promise<string> {
  const modelPath = process.env.WHISPER_MODEL_PATH;
  const cliPath = process.env.WHISPER_CLI_PATH || 'whisper-cli';

  if (!modelPath) throw new Error('WHISPER_MODEL_PATH is not set in environment');

  const command = `"${cliPath}" -m "${modelPath}" -f "${audioPath}" -nt`;
  console.log(`Running whisper: ${command}`);

  try {
    const { stdout } = await execPromise(command);
    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Whisper execution failed: ${error.message}`);
  }
}

export interface VisionResult {
  name: string;
  city: string;
  menuItems: string[];
  cuisineType: string;
  confidence: number;
}

export async function analyzeFrames(frames: { timestamp: number, base64: string }[]): Promise<VisionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  // 4 frames instead of 8 — halves token cost while keeping accuracy
  const step = Math.ceil(frames.length / 4);
  const sampledFrames = frames.filter((_, i) => i % step === 0).slice(0, 4);

  const prompt = `Analyze these frames from a food video. Extract the restaurant name, city/location, menu items shown or mentioned, and the cuisine type. Output strictly as JSON. Confidence is a score from 0.0 to 1.0 based on how clearly the restaurant name and city are visible. Format: {"name": "...", "city": "...", "menuItems": [], "cuisineType": "...", "confidence": 0.9}`;

  const imageParts = sampledFrames.map(frame => ({
    inlineData: {
      data: frame.base64.replace(/^data:image\/jpeg;base64,/, ''),
      mimeType: 'image/jpeg' as const,
    },
  }));

  return withRetry(async () => {
    const result = await model.generateContent([prompt, ...imageParts]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text) as VisionResult;
  });
}

export interface InferenceCandidate {
  name: string;
  city: string;
  confidence: number;
}

export interface InferenceResult {
  candidates: InferenceCandidate[];
  topPick: InferenceCandidate | null;
  menuItems: string[];
  cuisineType: string;
}

export async function inferRestaurant(transcript: string, vision: VisionResult): Promise<InferenceResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `Transcript: ${transcript}

Vision API Output: ${JSON.stringify(vision)}

Combine these sources to determine the most likely restaurant being featured.
Output strictly as JSON:
{"candidates":[{"name":"Restaurant Name","city":"City Name","confidence":0.9}],"topPick":{"name":"Restaurant Name","city":"City Name","confidence":0.9},"menuItems":["Item 1"],"cuisineType":"Cuisine"}
Output up to 3 candidates if ambiguous. Confidence from 0.0 to 1.0.`;

  return withRetry(async () => {
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text) as InferenceResult;
  });
}
