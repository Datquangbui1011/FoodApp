import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';

const execPromise = util.promisify(exec);

const DOWNLOAD_TIMEOUT_MS = 90_000;
const COBALT_API = 'https://api.cobalt.tools/';

const COBALT_PLATFORMS = ['tiktok.com', 'instagram.com', 'fb.watch', 'facebook.com/reel'];

function usesCobalt(url: string): boolean {
  return COBALT_PLATFORMS.some(p => url.includes(p));
}

async function downloadViaUrl(downloadUrl: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get = downloadUrl.startsWith('https') ? https.get : http.get;
    get(downloadUrl, res => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`download_failed: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

async function downloadViaCobalt(url: string, tempDir: string): Promise<string> {
  const res = await fetch(COBALT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('cobalt error response:', res.status, body);
    throw new Error('download_failed');
  }

  const data = await res.json() as {
    status: string;
    url?: string;
    error?: { code?: string };
  };

  if (data.status === 'error') {
    const code = data.error?.code ?? '';
    if (code.includes('content.private') || code.includes('private')) throw new Error('private_video');
    if (code.includes('link.unsupported') || code.includes('unsupported')) throw new Error('unsupported_url');
    console.error('cobalt error code:', code);
    throw new Error('download_failed');
  }

  const downloadUrl = data.url;
  if (!downloadUrl) throw new Error('download_failed');

  const destPath = path.join(tempDir, `${Date.now()}.mp4`);
  await downloadViaUrl(downloadUrl, destPath);
  return destPath;
}

async function downloadViaYtDlp(url: string, tempDir: string): Promise<string> {
  const id = Date.now().toString();
  const outputPath = path.join(tempDir, `${id}.%(ext)s`);
  const command = `yt-dlp --no-playlist -f "bestvideo[height<=720]+bestaudio/best[height<=720]/best" -o "${outputPath}" "${url}"`;

  const { stdout } = await execPromise(command, { timeout: DOWNLOAD_TIMEOUT_MS });
  console.log(stdout);

  const downloadedFile = fs.readdirSync(tempDir).find(f => f.startsWith(id));
  if (!downloadedFile) throw new Error('download_failed');
  return path.join(tempDir, downloadedFile);
}

export async function downloadVideo(url: string, tempDir: string): Promise<string> {
  if (usesCobalt(url)) {
    try {
      console.log('Using cobalt.tools for:', url);
      return await downloadViaCobalt(url, tempDir);
    } catch (err: any) {
      // Surface known errors immediately — don't fall through to yt-dlp
      if (['private_video', 'unsupported_url'].includes(err.message)) throw err;
      console.warn('cobalt failed, falling back to yt-dlp:', err.message);
    }
  }

  try {
    return await downloadViaYtDlp(url, tempDir);
  } catch (error: any) {
    console.error('yt-dlp error:', error.message);
    if (error.killed) throw new Error('download_timeout');
    const msg: string = error.message ?? '';
    if (msg.includes('Private video') || msg.includes('private') || msg.includes('Sign in')) {
      throw new Error('private_video');
    }
    if (msg.includes('Unsupported URL') || msg.includes('unsupported url')) {
      throw new Error('unsupported_url');
    }
    throw new Error('download_failed');
  }
}
