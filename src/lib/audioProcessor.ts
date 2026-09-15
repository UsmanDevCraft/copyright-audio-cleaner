export interface ProcessAudioOptions {
  detuneCents?: number; // Micro-pitch shift (-10 = -10 cents)
  tempoMultiplier?: number; // Micro-speed change (1.008 = +0.8%)
  delayTimeSeconds?: number; // Stereo phase delay (0.002 = 2ms)
}

export async function processAudioFile(
  file: File,
  options: ProcessAudioOptions = {},
): Promise<{ wavBlob: Blob; originalName: string }> {
  const {
    detuneCents = -10,
    tempoMultiplier = 1.008,
    delayTimeSeconds = 0.002,
  } = options;

  // 1. Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // 2. Decode raw binary into AudioBuffer (strips embedded metadata)
  const tempCtx = new (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  )();
  const originalBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  await tempCtx.close();

  // 3. Initialize OfflineAudioContext for fast rendering
  const offlineCtx = new OfflineAudioContext(
    originalBuffer.numberOfChannels,
    originalBuffer.length,
    originalBuffer.sampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = originalBuffer;

  // --- DSP Pipeline ---
  source.playbackRate.value = tempoMultiplier;
  source.detune.value = detuneCents;

  // High-Pass Filter (< 20 Hz)
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 20;

  // Low-Pass Filter (> 19.5 kHz)
  const lowPass = offlineCtx.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 19500;

  // Stereo Phase Delay
  const merger = offlineCtx.createChannelMerger(2);
  const splitter = offlineCtx.createChannelSplitter(2);
  const rightDelay = offlineCtx.createDelay();
  rightDelay.delayTime.value = delayTimeSeconds;

  source.connect(highPass);
  highPass.connect(lowPass);

  if (originalBuffer.numberOfChannels >= 2) {
    lowPass.connect(splitter);
    splitter.connect(merger, 0, 0); // Left channel
    splitter.connect(rightDelay, 1);
    rightDelay.connect(merger, 0, 1); // Right channel delayed
    merger.connect(offlineCtx.destination);
  } else {
    lowPass.connect(offlineCtx.destination);
  }

  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();

  // 4. Encode to WAV
  const wavBlob = audioBufferToWavBlob(renderedBuffer);

  return { wavBlob, originalName: file.name };
}

// Helper: Convert AudioBuffer to WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels: Float32Array[] = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF Header
  writeString("RIFF");
  setUint32(length - 8);
  writeString("WAVE");
  writeString("fmt ");
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16); // 16-bit
  writeString("data");
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: "audio/wav" });
}
