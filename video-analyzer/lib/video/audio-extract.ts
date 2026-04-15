/**
 * Encode a File (video) into a compressed audio Blob suitable for upload
 * to the Gemini audio analysis route.
 *
 * Strategy: decodeAudioData → render OfflineAudioContext → PCM wav.
 * We do NOT use ffmpeg.wasm (previously crashed). WAV is larger than
 * mp3/aac but every browser can produce it and Gemini accepts it.
 *
 * For a 90s video at 16 kHz mono 16-bit, the WAV is ~2.9 MB — comfortably
 * below Vercel's default body size limit and Gemini's per-file limit.
 */

export async function encodeVideoAudioToWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Web Audio API unavailable");
  }

  const decodeCtx = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    decodeCtx.close();
  }

  const targetRate = 16_000; // 16 kHz is plenty for speech/music classification
  const targetChannels = 1; // mono cuts the payload in half
  const length = Math.ceil(audioBuffer.duration * targetRate);

  const offline = new OfflineAudioContext(targetChannels, length, targetRate);
  const src = offline.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  return encodeWav(rendered);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const ab = new ArrayBuffer(totalSize);
  const view = new DataView(ab);
  let offset = 0;

  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
    offset += s.length;
  };
  const writeUint32 = (v: number) => {
    view.setUint32(offset, v, true);
    offset += 4;
  };
  const writeUint16 = (v: number) => {
    view.setUint16(offset, v, true);
    offset += 2;
  };

  writeString("RIFF");
  writeUint32(totalSize - 8);
  writeString("WAVE");
  writeString("fmt ");
  writeUint32(16); // fmt chunk size
  writeUint16(1); // PCM
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(sampleRate * blockAlign); // byte rate
  writeUint16(blockAlign);
  writeUint16(bytesPerSample * 8);
  writeString("data");
  writeUint32(dataSize);

  // Interleave channels and convert float [-1,1] → int16
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }
  for (let i = 0; i < samples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x80_00 : s * 0x7f_ff, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}
