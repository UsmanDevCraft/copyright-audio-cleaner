import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  // Load core WebAssembly files from CDN
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export async function convertWavToMp3(wavBlob: Blob): Promise<Blob> {
  const ff = await getFFmpeg();

  // Write WAV blob into FFmpeg's virtual memory file system
  await ff.writeFile("input.wav", await fetchFile(wavBlob));

  // Run encoding command: Strip metadata (-map_metadata -1) & encode at 320 kbps MP3
  await ff.exec([
    "-i",
    "input.wav",
    "-map_metadata",
    "-1",
    "-b:a",
    "320k",
    "output.mp3",
  ]);

  // Read back the compressed MP3
  const data = await ff.readFile("output.mp3");

  // Clean up WASM memory
  await ff.deleteFile("input.wav");
  await ff.deleteFile("output.mp3");

  if (typeof data === "string") {
    throw new Error("FFmpeg output expected binary data but received string.");
  }

  // Copy bytes into a fresh standard Uint8Array (backed by standard ArrayBuffer)
  const cleanArray = new Uint8Array(data.length);
  cleanArray.set(data);

  return new Blob([cleanArray.buffer], { type: "audio/mp3" });
}
