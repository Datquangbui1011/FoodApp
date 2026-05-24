import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

const DOWNLOAD_TIMEOUT_MS = 90_000;

export async function downloadVideo(url: string, tempDir: string): Promise<string> {
  const id = Date.now().toString();
  const outputPath = path.join(tempDir, `${id}.%(ext)s`);

  // Cap resolution at 720p to keep file sizes manageable; --no-playlist prevents
  // accidentally pulling an entire playlist when given a playlist URL.
  const command = `yt-dlp --no-playlist -f "bestvideo[height<=720]+bestaudio/best[height<=720]/best" -o "${outputPath}" "${url}"`;

  try {
    const { stdout } = await execPromise(command, { timeout: DOWNLOAD_TIMEOUT_MS });
    console.log(stdout);

    const files = fs.readdirSync(tempDir);
    const downloadedFile = files.find(f => f.startsWith(id));

    if (!downloadedFile) {
      throw new Error('download_failed');
    }

    return path.join(tempDir, downloadedFile);
  } catch (error: any) {
    console.error('yt-dlp error:', error.message);
    if (error.killed) {
      throw new Error('download_timeout');
    }
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
