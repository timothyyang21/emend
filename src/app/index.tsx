import { useState } from 'react';
import { View } from 'react-native';

import { AppText, Button, Card, Screen, tokens } from '@/components/ui';
import { VOICE_STATUS_LABEL, transcribeEndpoint, useVoiceCapture } from '@/lib/voice';

/**
 * VOICE SPIKE — proves capture → transcript on a real device before anything
 * else is built on top of it. This screen is scaffolding: it becomes the real
 * document screen once the slice lands.
 */
export default function Home() {
  const voice = useVoiceCapture();
  const [transcript, setTranscript] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const configured = transcribeEndpoint() !== null;
  const busy = voice.status === 'transcribing' || voice.status === 'permission';

  async function onStop() {
    const text = await voice.stop();
    if (text) {
      setTranscript(text);
      setHistory((h) => [text, ...h].slice(0, 5));
    }
  }

  return (
    <Screen scroll>
      <AppText variant="h1">Emend</AppText>
      <AppText variant="muted">Voice spike — say an editing instruction.</AppText>

      {!configured && (
        <Card>
          <AppText variant="h2">Voice is not configured</AppText>
          <AppText variant="muted">
            EXPO_PUBLIC_TRANSCRIBE_ENDPOINT is unset, so there is nowhere to send audio. Set it in
            .env.local and restart Metro.
          </AppText>
        </Card>
      )}

      <Card>
        {/* Fixed-height status line: a label that appears and disappears would
            shove the button down mid-tap. */}
        <View style={{ height: 46, justifyContent: 'center' }}>
          <AppText variant="h2">{VOICE_STATUS_LABEL[voice.status]}</AppText>
          {voice.status === 'recording' && (
            <AppText variant="muted">{voice.durationSec.toFixed(1)}s</AppText>
          )}
        </View>

        {voice.status === 'recording' ? (
          <>
            <Button title="Stop and transcribe" onPress={onStop} />
            <Button title="Discard" variant="ghost" onPress={voice.cancel} />
          </>
        ) : (
          <Button
            title={busy ? 'Working…' : 'Start speaking'}
            onPress={voice.start}
            loading={busy}
            disabled={!configured || busy}
          />
        )}
      </Card>

      {voice.error && (
        <Card>
          <AppText variant="h2" style={{ color: tokens.colors.danger }}>
            {voice.error}
          </AppText>
          <Button title="Try again" variant="secondary" onPress={voice.reset} />
        </Card>
      )}

      {transcript && (
        <Card>
          <AppText variant="label">HEARD</AppText>
          <AppText variant="prose">{transcript}</AppText>
        </Card>
      )}

      {history.length > 1 && (
        <Card>
          <AppText variant="label">EARLIER</AppText>
          {history.slice(1).map((h, i) => (
            <AppText key={`${i}-${h.slice(0, 12)}`} variant="muted">
              {h}
            </AppText>
          ))}
        </Card>
      )}
    </Screen>
  );
}
