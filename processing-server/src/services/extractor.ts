import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

export async function extractAudio(videoPath: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(outputDir, `${path.basename(videoPath, path.extname(videoPath))}.wav`);
    
    ffmpeg(videoPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .run();
  });
}

export async function extractFrames(videoPath: string, outputDir: string): Promise<{ timestamp: number, base64: string, filePath: string }[]> {
  return new Promise((resolve, reject) => {
    const basename = path.basename(videoPath, path.extname(videoPath));
    const frameOutputDir = path.join(outputDir, `${basename}_frames`);

    if (!fs.existsSync(frameOutputDir)) {
      fs.mkdirSync(frameOutputDir, { recursive: true });
    }

    // 5 frames — covers the video evenly, faster OCR than 8
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(new Error(`ffprobe error: ${err.message}`));

      const duration = metadata.format.duration || 15;
      const interval = Math.max(1, duration / 5);

      ffmpeg(videoPath)
        .outputOptions([`-vf fps=1/${interval},scale=512:-1`])
        .output(path.join(frameOutputDir, 'frame-%03d.jpg'))
        .on('end', () => {
          try {
            const files = fs.readdirSync(frameOutputDir).filter(f => f.endsWith('.jpg')).sort();
            const frames = files.map((file, index) => {
              const filePath = path.join(frameOutputDir, file);
              const base64 = fs.readFileSync(filePath, { encoding: 'base64' });
              return {
                timestamp: index * interval,
                base64: `data:image/jpeg;base64,${base64}`,
                filePath,
              };
            });
            resolve(frames);
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (err) => reject(new Error(`Frame extraction failed: ${err.message}`)))
        .run();
    });
  });
}
