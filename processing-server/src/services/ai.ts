import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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

// Only wait-and-retry for short per-minute (TPM) backoffs. A long retry-after
// means we hit the per-day (TPD) quota — retrying is pointless, so fail fast
// and let the caller surface a clear "rate limited" message.
const MAX_RETRY_WAIT_S = 15;

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429;
      const retryAfter = parseInt(err?.headers?.['retry-after'] ?? '10');
      if (is429 && attempt < retries && retryAfter <= MAX_RETRY_WAIT_S) {
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
  const client = getClient();
  console.log('Transcribing with Groq Whisper:', audioPath);
  return withRetry(async () => {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-large-v3-turbo',
      response_format: 'text',
    });
    return (transcription as unknown as string).trim();
  });
}

export interface VisionResult {
  name: string;
  city: string;
  menuItems: string[];
  cuisineType: string;
  confidence: number;
  _allFound?: { name: string; city: string; menuItems: string[]; cuisineType: string }[];
  _rawOcr?: string[];
}

// Try persistent OCR HTTP server first (model stays warm between requests).
// Falls back to subprocess if the server isn't ready yet (e.g. cold start).
async function runEasyOcr(filePaths: string[]): Promise<string[]> {
  try {
    const res = await fetch('http://localhost:5001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filePaths),
      signal: AbortSignal.timeout(180_000),
    });
    const lines: string[] = await res.json();
    return lines.filter(l => l.trim().length > 1);
  } catch {
    // OCR server not ready — fall back to subprocess
    console.log('[EasyOCR] HTTP server unavailable, using subprocess fallback');
    return runEasyOcrSubprocess(filePaths);
  }
}

async function runEasyOcrSubprocess(filePaths: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', '..', 'ocr.py');
    const pythonBin = process.env.PYTHON_PATH ?? (process.platform === 'darwin' ? '/opt/homebrew/bin/python3' : 'python3');
    const py = spawn(pythonBin, [scriptPath]);
    let stdout = '';

    py.stdin.write(JSON.stringify(filePaths));
    py.stdin.end();
    py.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
    py.stderr.on('data', (d: Buffer) => { console.error('[EasyOCR]', d.toString().trim()); });

    py.on('close', () => {
      try {
        const lines: string[] = JSON.parse(stdout);
        resolve(lines.filter(l => l.trim().length > 1));
      } catch {
        resolve([]);
      }
    });

    py.on('error', (err) => {
      console.error('Failed to start EasyOCR process:', err.message);
      resolve([]);
    });
  });
}

export async function analyzeFrames(frames: { timestamp: number, base64: string, filePath?: string }[]): Promise<VisionResult> {
  const filePaths = frames.map(f => f.filePath).filter((p): p is string => !!p);

  if (filePaths.length === 0) {
    console.log('No frame file paths available — skipping OCR');
    return { name: '', city: '', menuItems: [], cuisineType: '', confidence: 0, _rawOcr: [] };
  }

  console.log(`Running EasyOCR on ${filePaths.length} frames (local, no API cost)`);
  const rawLines = await runEasyOcr(filePaths);
  console.log(`EasyOCR found ${rawLines.length} text lines:`, rawLines.slice(0, 8));

  return {
    name: '',
    city: '',
    menuItems: [],
    cuisineType: '',
    confidence: rawLines.length > 0 ? 0.7 : 0,
    _rawOcr: rawLines,
  };
}

export interface InferenceRestaurant {
  name: string;
  city: string;
  confidence: number;
  menuItems: string[];
  cuisineType: string;
}

export interface InferenceResult {
  restaurants: InferenceRestaurant[];
  // legacy fields derived from restaurants[0] — kept for backwards compat
  topPick: { name: string; city: string; confidence: number } | null;
  candidates: { name: string; city: string; confidence: number }[];
  menuItems: string[];
  cuisineType: string;
}

export async function inferRestaurant(
  transcript: string,
  vision: VisionResult,
  caption: string = '',
): Promise<InferenceResult> {
  const client = getClient();

  const allFound = vision._allFound ?? [];
  const captionSection = caption
    ? `Video caption (written by the creator — HIGHEST PRIORITY source):\n${caption.slice(0, 1500)}\n\n`
    : '';
  // _rawOcr = flat text lines from local EasyOCR (zero API cost)
  // _allFound = structured objects from old Groq vision path (legacy)
  const visionSection = (vision._rawOcr && vision._rawOcr.length > 0)
    ? `Raw text extracted from video frames by local OCR (HIGH PRIORITY — look for restaurant/café names, signs, location tags):\n${JSON.stringify(vision._rawOcr)}\n\n`
    : allFound.length > 0
      ? `Text read from video frames (OCR across all frames — HIGH PRIORITY):\n${JSON.stringify(allFound)}\n\n`
      : '';

  const prompt = `${captionSection}${visionSection}Audio transcript: ${transcript || '(none)'}

This video may feature ONE restaurant or a LIST of multiple restaurants (e.g. "Top 5 date night spots").
Use ALL sources above. OCR text from frames is very reliable — if a name was read from the screen, include it.
If the caption or OCR shows multiple restaurants, list ALL of them.

Output strictly as JSON with no markdown:
{"restaurants":[{"name":"Restaurant Name","city":"City, State","confidence":0.9,"menuItems":["pasta"],"cuisineType":"Italian"}]}
Up to 5 restaurants. Sort by confidence descending. Confidence 0.0–1.0.`;

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: TEXT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(extractFirstJSON(raw)) as { restaurants?: InferenceRestaurant[] };
    const restaurants: InferenceRestaurant[] = parsed.restaurants ?? [];
    const top = restaurants[0] ?? null;

    return {
      restaurants,
      topPick: top ? { name: top.name, city: top.city, confidence: top.confidence } : null,
      candidates: restaurants.map(r => ({ name: r.name, city: r.city, confidence: r.confidence })),
      menuItems: top?.menuItems ?? [],
      cuisineType: top?.cuisineType ?? '',
    };
  });
}
