import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  AppText,
  AutoGrowInput,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  Skeleton,
  SwipeToDelete,
} from '@/components/ui';
import { copyText } from '@/lib/feel/clipboard';
import { haptics } from '@/lib/feel/haptics';
import { staggerDelay, useFadeInUp, usePressScale } from '@/theme/motion';
import { space } from '@/theme/tokens';

function StaggeredRow({ index, label }: { index: number; label: string }) {
  const style = useFadeInUp(staggerDelay(index, 60));
  return (
    <Animated.View style={style}>
      <Card>
        <AppText>{label}</AppText>
      </Card>
    </Animated.View>
  );
}

function PressScaleCard() {
  const press = usePressScale();
  return (
    <Pressable onPressIn={press.onPressIn} onPressOut={press.onPressOut} onPress={() => haptics.tap()}>
      <Animated.View style={press.style}>
        <Card>
          <AppText variant="h2">Press me</AppText>
          <AppText variant="muted">Scales on press and fires a haptic.</AppText>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

export default function Kit() {
  const [note, setNote] = useState('');
  const [rows, setRows] = useState([
    { id: 'a', label: 'Swipe me left' },
    { id: 'b', label: 'And me' },
  ]);
  const [copied, setCopied] = useState<boolean | null>(null);

  return (
    <Screen scroll>
      <AppText variant="h1">Kit</AppText>
      <AppText variant="muted">Every primitive, mounted — a visual check and a reference.</AppText>

      <AppText variant="label">Motion</AppText>
      {['First', 'Second', 'Third'].map((label, i) => (
        <StaggeredRow key={label} index={i} label={label} />
      ))}
      <PressScaleCard />

      <AppText variant="label">States</AppText>
      <Card><Loading label="Loading…" /></Card>
      <Card><EmptyState title="Nothing here" hint="This is the empty state." /></Card>
      <Card><ErrorState message="Something went wrong." onRetry={() => haptics.warning()} /></Card>
      <Card>
        <View style={{ gap: space.sm }}>
          <Skeleton width="70%" />
          <Skeleton />
          <Skeleton width="40%" />
        </View>
      </Card>

      <AppText variant="label">Editor</AppText>
      <AutoGrowInput placeholder="Type — this grows…" value={note} onChangeText={setNote} clearable onClear={() => setNote('')} />

      <AppText variant="label">Feel</AppText>
      <Button
        title={copied === null ? 'Copy to clipboard' : copied ? 'Copied' : 'Copy failed'}
        variant="secondary"
        onPress={async () => {
          const ok = await copyText('Sent from the Cactus rig');
          setCopied(ok);
          await (ok ? haptics.success() : haptics.error());
        }}
      />

      <AppText variant="label">Swipe to delete</AppText>
      {rows.map((row) => (
        <SwipeToDelete key={row.id} onDelete={() => setRows((r) => r.filter((v) => v.id !== row.id))}>
          <Pressable onPress={() => haptics.selection()}>
            <Card><AppText>{row.label}</AppText></Card>
          </Pressable>
        </SwipeToDelete>
      ))}
      {rows.length === 0 ? <AppText variant="muted">All swiped away.</AppText> : null}
    </Screen>
  );
}
