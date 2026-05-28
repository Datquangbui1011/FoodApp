import Groq from 'groq-sdk';
import fs from 'fs';

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
}

const OCR_PROMPT = `These are frames from a food/restaurant video (TikTok, Instagram Reel, YouTube).

Extract ALL restaurant or café names visible as text in these frames. Look for:
- Text overlays, title cards, captions burned into the video
- Storefront signs, logos, banners
- Location tags, address text, any on-screen text naming a place

List EVERY restaurant name you can read — there may be 1 or several across these frames.
Also note the city/location if visible, any menu items, and cuisine type.

Output strictly as JSON, no markdown:
{"restaurants":[{"name":"...","city":"...","menuItems":[],"cuisineType":"..."}],"city":"..."}`;

async function runOcrBatch(
  client: Groq,
  batch: { timestamp: number; base64: string }[],
): Promise<{ name: string; city: string; menuItems: string[]; cuisineType: string }[]> {
  const imageContent = batch.map(f => ({
    type: 'image_url' as const,
    image_url: { url: f.base64.startsWith('data:') ? f.base64 : `data:image/jpeg;base64,${f.base64}` },
  }));

  return withRetry(async () => {
    const response = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [{ role: 'user', content: [{ type: 'text', text: OCR_PROMPT }, ...imageContent] }],
      temperature: 0.1,
      max_tokens: 600,
    });
    const raw = response.choices[0]?.message?.content ?? '';
    try {
      const parsed = JSON.parse(extractFirstJSON(raw)) as {
        restaurants?: { name: string; city: string; menuItems?: string[]; cuisineType?: string }[];
      };
      return (parsed.restaurants ?? []).map(r => ({
        name: r.name,
        city: r.city,
        menuItems: r.menuItems ?? [],
        cuisineType: r.cuisineType ?? '',
      }));
    } catch { return []; }
  });
}

export async function analyzeFrames(frames: { timestamp: number, base64: string }[]): Promise<VisionResult> {
  const client = getClient();

  // Split all frames into batches of 5, run all batches in parallel
  const batches: typeof frames[] = [];
  for (let i = 0; i < frames.length; i += 5) batches.push(frames.slice(i, i + 5));

  console.log(`Running ${batches.length} parallel vision batch(es) over ${frames.length} frames`);
  const batchResults = await Promise.all(batches.map(b => runOcrBatch(client, b)));

  // Deduplicate by name (case-insensitive)
  const seen = new Set<string>();
  const all: { name: string; city: string; menuItems: string[]; cuisineType: string }[] = [];
  for (const results of batchResults) {
    for (const r of results) {
      const key = r.name.toLowerCase().trim();
      if (key && !seen.has(key)) { seen.add(key); all.push(r); }
    }
  }

  console.log(`Vision found ${all.length} unique place(s):`, all.map(r => r.name));

  // Return as VisionResult — put the highest-confidence (first) as primary
  const top = all[0];
  return {
    name: top?.name ?? '',
    city: top?.city ?? '',
    menuItems: top?.menuItems ?? [],
    cuisineType: top?.cuisineType ?? '',
    confidence: top ? 0.9 : 0,
    _allFound: all,
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
  const visionSection = allFound.length > 0
    ? `Text read from video frames (OCR across all frames — HIGH PRIORITY):\n${JSON.stringify(allFound)}\n\n`
    : `Vision analysis (single pass):\n${JSON.stringify(vision)}\n\n`;

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
