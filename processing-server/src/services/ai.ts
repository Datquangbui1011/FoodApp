import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function transcribeAudio(audioPath: string): Promise<string> {
  const modelPath = process.env.WHISPER_MODEL_PATH;
  const cliPath = process.env.WHISPER_CLI_PATH || 'whisper-cli';
  
  if (!modelPath) {
    throw new Error('WHISPER_MODEL_PATH is not set in environment');
  }

  const command = `"${cliPath}" -m "${modelPath}" -f "${audioPath}" -nt`;
  console.log(`Running whisper: ${command}`);
  
  try {
    const { stdout, stderr } = await execPromise(command);
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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Sample 5-8 key frames to save tokens
  const step = Math.ceil(frames.length / 8);
  const sampledFrames = frames.filter((_, index) => index % step === 0).slice(0, 8);

  const prompt = `Analyze these frames from a food video. Extract the restaurant name, city/location, menu items shown or mentioned, and the cuisine type. Output strictly as JSON. Confidence is a score from 0.0 to 1.0 based on how clearly the restaurant name and city are visible. Format: {"name": "...", "city": "...", "menuItems": [], "cuisineType": "...", "confidence": 0.9}`;

  const imageParts = sampledFrames.map(frame => {
    // Clean data URI prefix if present
    const base64Data = frame.base64.replace(/^data:image\/jpeg;base64,/, '');
    return {
      inlineData: {
        data: base64Data,
        mimeType: "image/jpeg"
      }
    };
  });

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;
  let text = response.text();
  
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text) as VisionResult;
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
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
Transcript:
${transcript}

Vision API Output:
${JSON.stringify(vision)}

Combine these sources to determine the most likely restaurant being featured.
Output strictly as JSON format:
{
  "candidates": [
    { "name": "Restaurant Name", "city": "City Name", "confidence": 0.9 }
  ],
  "topPick": { "name": "Restaurant Name", "city": "City Name", "confidence": 0.9 },
  "menuItems": ["Item 1", "Item 2"],
  "cuisineType": "Cuisine"
}
Output up to 3 candidates if ambiguous. Confidence from 0.0 to 1.0.
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text) as InferenceResult;
}
