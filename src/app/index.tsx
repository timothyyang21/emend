import { Link } from 'expo-router';
import { useState } from 'react';

import { AppText, Button, Card, Input, Screen } from '@/components/ui';
import { useCounter } from '@/store';

export default function Home() {
  const { count, inc, reset } = useCounter();
  const [name, setName] = useState('');
  return (
    <Screen scroll>
      <AppText variant="h1">Cactus Rig</AppText>
      <AppText variant="muted">Base is live — edit src/app/index.tsx and save to hot-reload.</AppText>

      <Card>
        <AppText variant="h2">Counter: {count}</AppText>
        <AppText variant="muted">Persisted with Zustand + AsyncStorage.</AppText>
        <Button title="Increment" onPress={inc} />
        <Button title="Reset" variant="secondary" onPress={reset} />
      </Card>

      <Card>
        <Input label="Name" placeholder="Type something…" value={name} onChangeText={setName} />
        <Button title={name ? `Hi, ${name}` : 'Ghost button (disabled)'} variant="ghost" disabled={!name} />
      </Card>

      <Card>
        <AppText variant="h2">Writing kit</AppText>
        <AppText variant="muted">Bulk-select, dictation, attach, autosave, AI-assist.</AppText>
        <Link href="/writing" asChild>
          <Button title="Open writing demo" variant="secondary" />
        </Link>
      </Card>

      <Card>
        <AppText variant="h2">Kit gallery</AppText>
        <AppText variant="muted">Every primitive, mounted — motion, states, swipe, haptics.</AppText>
        <Link href="/kit" asChild>
          <Button title="Open kit gallery" variant="secondary" />
        </Link>
      </Card>
    </Screen>
  );
}
