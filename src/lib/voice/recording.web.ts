import { RecordingOptions, RecordingPresets } from 'expo-audio';

/**
 * Web recording — same public surface as recording.ts, different plumbing.
 *
 * TWO THINGS ARE DIFFERENT IN A BROWSER AND BOTH BROKE VOICE HERE:
 *
 * 1. `expo-file-system`'s File class has no web implementation of validatePath,
 *    so `new File(uri)` throws "this.validatePath is not a function" the instant
 *    a recording stops. A browser doesn't need it: the recording is a blob URL,
 *    and fetch reads it.
 *
 * 2. MediaRecorder gives you webm/opus in Chrome and mp4/aac in Safari. Neither
 *    is reliably accepted for audio input, and the format the writer gets would
 *    depend on their browser. So we decode whatever was captured and re-encode
 *    it ourselves as 16kHz mono WAV — the one format already proven end to end
 *    on this pipeline.
 */

export const VOICE_RECORDING_OPTIONS: RecordingOptions = RecordingPresets.HIGH_QUALITY;

/** Always wav, because we convert to it below regardless of what was captured. */
export const VOICE_AUDIO_FORMAT = 'wav';

const TARGET_RATE = 16_000;

/** Interleaved 16-bit PCM in a minimal RIFF container. */
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling: values outside [-1, 1] wrap and become loud noise.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked: one big String.fromCharCode(...bytes) blows the argument limit on
  // anything longer than a couple of seconds.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Read a browser recording and hand back 16kHz mono WAV as base64. */
export async function readRecordingAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const encoded = await response.arrayBuffer();
  if (encoded.byteLength === 0) throw new Error('That recording came back empty.');

  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(encoded.slice(0));
  } finally {
    await context.close().catch(() => {});
  }

  // Resample and downmix in one pass — OfflineAudioContext does both for us.
  const frames = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();

  return toBase64(encodeWav(rendered.getChannelData(0), TARGET_RATE));
}
