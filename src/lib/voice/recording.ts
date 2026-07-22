import { IOSOutputFormat, RecordingOptions, RecordingPresets } from 'expo-audio';
import { File } from 'expo-file-system';

/**
 * 16kHz mono LINEAR PCM — i.e. a real `.wav`.
 *
 * Why not `RecordingPresets.HIGH_QUALITY`: it writes AAC in an `.m4a`. OpenRouter
 * lists `m4a` as accepted but "not all models support all formats", and a format
 * negotiation failure here looks exactly like a bad transcription. `wav` is the
 * format in OpenRouter's own audio example, so it is the one we can rely on.
 *
 * 16kHz mono is what speech recognisers actually want — 44.1kHz stereo would
 * quadruple the upload for no gain in accuracy. A 10s instruction is ~320KB raw,
 * ~430KB base64: fine for one POST.
 */
export const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: '.wav',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 256_000, // ignored for LINEARPCM; kept so the type is satisfied honestly
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    sampleRate: 16_000,
    // Channel count is top-level only — RecordingOptionsIos has no
    // numberOfChannels field, so mono is set by the parent option above.
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/** The wire format name that goes with {@link VOICE_RECORDING_OPTIONS}. */
export const VOICE_AUDIO_FORMAT = 'wav';

/** Read a recording off disk as base64 so it can be POSTed as JSON. */
export async function readRecordingAsBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}
