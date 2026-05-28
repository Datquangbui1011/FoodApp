import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface VideoMetadata {
  title: string;
  description: string;
}

export async function fetchVideoMetadata(url: string): Promise<VideoMetadata> {
  try {
    const { stdout } = await execPromise(
      `yt-dlp --dump-json --no-download --no-warnings "${url}"`,
      { timeout: 20_000 },
    );
    const data = JSON.parse(stdout) as { title?: string; description?: string };
    return {
      title: data.title ?? '',
      description: data.description ?? '',
    };
  } catch {
    return { title: '', description: '' };
  }
}
