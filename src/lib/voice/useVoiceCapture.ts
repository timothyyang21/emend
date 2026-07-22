import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { readRecordingAsBase64, VOICE_AUDIO_FORMAT, VOICE_RECORDING_OPTIONS } from './recording';
import { TranscriptionError, transcribeAudio } from './transcribe';

/**
 * Every state here is one the writer can be *told* about in words — see the
 * `VOICE_STATUS_LABEL` map. A mic button with no visible state is the classic
 * "did it hear me?" failure.
 */
export type VoiceStatus = 'idle' | 'permission' | 'recording' | 'transcribing' | 'error';

export const VOICE_STATUS_LABEL: Record<VoiceStatus, string> = {
  // Never the same words as the button beneath it — the panel said 'Tap to
  // speak' above a button reading 'Tap to speak an instruction'.
  idle: 'Ready when you are',
  permission: 'Asking for the microphone…',
  recording: 'Listening…',
  transcribing: 'Working out what you said…',
  error: 'Something went wrong',
};

export type VoiceCapture = {
  status: VoiceStatus;
  /** Human-readable, already safe to render. Null unless status === 'error'. */
  error: string | null;
  /** Seconds recorded so far, for a live duration readout. */
  durationSec: number;
  start: () => Promise<void>;
  /** Resolves with the transcript, or null if nothing usable was captured. */
  stop: () => Promise<string | null>;
  /** Abandon a recording without transcribing it. */
  cancel: () => Promise<void>;
  reset: () => void;
};

export function useVoiceCapture(options: { dictionary?: string[] } = {}): VoiceCapture {
  // Held in a ref so adding a name never rebuilds start/stop mid-recording.
  const dictionary = useRef<string[]>(options.dictionary ?? []);
  useEffect(() => {
    dictionary.current = options.dictionary ?? [];
  }, [options.dictionary]);

  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // Guards the stop path: without it a double-tap fires two transcriptions.
  const busy = useRef(false);

  const fail = useCallback((message: string) => {
    setError(message);
    setStatus('error');
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setStatus('permission');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        fail('Emend needs microphone access to hear your edits. Turn it on in Settings.');
        return;
      }
      // Without allowsRecording the iOS session stays in playback mode and the
      // recorder captures silence — no error, just an empty transcript.
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Could not start recording.');
    } finally {
      busy.current = false;
    }
  }, [recorder, fail]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (busy.current || status !== 'recording') return null;
    busy.current = true;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        fail('That recording came back empty.');
        return null;
      }
      setStatus('transcribing');
      const audioBase64 = await readRecordingAsBase64(uri);
      const text = await transcribeAudio(audioBase64, VOICE_AUDIO_FORMAT, dictionary.current);
      if (!text) {
        // Not an error state: the mic worked, there was just no speech. Saying
        // "failed" here would send the writer debugging a microphone that is fine.
        fail("I didn't catch that — try again a little closer to the mic.");
        return null;
      }
      setStatus('idle');
      return text;
    } catch (e) {
      fail(
        e instanceof TranscriptionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not transcribe that.'
      );
      return null;
    } finally {
      // Leave the recording session so playback elsewhere is not stuck in
      // record mode (iOS routes audio to the earpiece if you don't).
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      busy.current = false;
    }
  }, [recorder, status, fail]);

  const cancel = useCallback(async () => {
    try {
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // Nothing the writer can do about a failed teardown; don't surface it.
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      busy.current = false;
      reset();
    }
  }, [recorder, reset]);

  return {
    status,
    error,
    durationSec: recorderState.durationMillis ? recorderState.durationMillis / 1000 : 0,
    start,
    stop,
    cancel,
    reset,
  };
}
