import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export interface Dictation {
  supported: boolean;
  listening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  error?: string;
}

function getRecognitionCtor(): any {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isDictationSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function useDictation(onText?: (chunk: string) => void): Dictation {
  const [supported] = useState(isDictationSupported);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | undefined>();
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const chunk = Array.from(e.results)
        .slice(e.resultIndex)
        .map((r: any) => r[0].transcript)
        .join(' ')
        .trim();
      if (!chunk) return;
      setTranscript((t) => (t ? `${t} ${chunk}` : chunk));
      onTextRef.current?.(chunk);
    };
    rec.onerror = (e: any) => setError(String(e?.error ?? 'dictation error'));
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError(undefined);
    setListening(true);
    rec.start();
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop?.();
    setListening(false);
  }, []);

  useEffect(() => () => recRef.current?.stop?.(), []);

  return { supported, listening, transcript, start, stop, error };
}
