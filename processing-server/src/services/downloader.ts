import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

export async function downloadVideo(url: string, tempDir: string): Promise<string> {
  const id = Date.now().toString();
  const outputPath = path.join(tempDir, `${id}.%(ext)s`);
  
  try {
    const { stdout, stderr } = await execPromise(`yt-dlp -o "${outputPath}" "${url}"`);
    console.log(stdout);
    
    // Find the downloaded file
    const files = fs.readdirSync(tempDir);
    const downloadedFile = files.find(f => f.startsWith(id));
    
    if (!downloadedFile) {
      throw new Error('download_failed');
    }
    
    return path.join(tempDir, downloadedFile);
  } catch (error: any) {
    console.error('yt-dlp error:', error);
    if (error.message.includes('Private video') || error.message.includes('private')) {
      throw new Error('private_video');
    }
    if (error.message.includes('Unsupported URL')) {
      throw new Error('unsupported_url');
    }
    throw new Error('download_failed');
  }
}
