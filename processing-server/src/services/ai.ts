import Groq from 'groq-sdk';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const TEXT_MODEL = 'llama-3.3-70b-versatile';

function extractFirstJSON(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error(`No JSON object found in: ${text.slice(0, 200)}`);

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }

  throw new Error(`Unbalanced JSON in: ${text.slice(0, 200)}`);
}

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Missing GROQ_API_KEY');
  return new Groq({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429;
      if (is429 && attempt < retries) {
        const retryAfter = parseInt(err?.headers?.['retry-after'] ?? '10');
        const delay = (retryAfter + 2) * 1000;
        console.log(`Groq 429 — retrying in ${retryAfter + 2}s (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
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
  const client = getClient();

  // Sample up to 4 frames
  const step = Math.ceil(frames.length / 4);
  const sampled = frames.filter((_, i) => i % step === 0).slice(0, 4);

  const imageContent = sampled.map(frame => ({
    type: 'image_url' as const,
    image_url: {
      url: frame.base64.startsWith('data:') ? frame.base64 : `data:image/jpeg;base64,${frame.base64}`,
    },
  }));

  const prompt = `Analyze these frames from a food video. Extract the restaurant name, city/location, menu items shown or mentioned, and the cuisine type. Output strictly as JSON with no markdown. Confidence is 0.0–1.0 based on how clearly the restaurant name and city are visible.
Format: {"name":"...","city":"...","menuItems":[],"cuisineType":"...","confidence":0.9}`;

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent,
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    return JSON.parse(extractFirstJSON(raw)) as VisionResult;
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
  const client = getClient();

  const prompt = `Transcript: ${transcript}

Vision output: ${JSON.stringify(vision)}

Combine these sources to determine the most likely restaurant being featured.
Output strictly as JSON with no markdown:
{"candidates":[{"name":"Restaurant Name","city":"City Name","confidence":0.9}],"topPick":{"name":"Restaurant Name","city":"City Name","confidence":0.9},"menuItems":["Item 1"],"cuisineType":"Cuisine"}
Up to 3 candidates if ambiguous. Confidence from 0.0 to 1.0.`;

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    return JSON.parse(extractFirstJSON(raw)) as InferenceResult;
  });
}
