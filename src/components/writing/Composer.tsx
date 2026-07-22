import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, AutoGrowInput, Button, Card, Input } from '@/components/ui';
import { Icon, IconName } from '@/components/ui/Icon';
import { assist } from '@/lib/writing/assist';
import { pickImage } from '@/lib/writing/attach';
import { count } from '@/lib/writing/count';
import { shareText } from '@/lib/writing/share';
import { useDictation } from '@/lib/writing/useDictation';
import { colors, radius, space } from '@/theme/tokens';
import type { WritingDraft } from '@/types/contracts';

type Props = { initial?: Partial<WritingDraft>; onSubmit: (draft: WritingDraft) => void };

function IconButton({ name, onPress, active }: { name: IconName; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{ padding: space.sm, borderRadius: radius.md, backgroundColor: active ? colors.surfaceAlt : 'transparent' }}
    >
      <Icon name={name} color={active ? 'primary' : 'text'} />
    </Pressable>
  );
}

export function Composer({ initial, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [imageUri, setImageUri] = useState<string | undefined>(initial?.imageUri);
  const [busy, setBusy] = useState(false);
  const dictation = useDictation((chunk) => setBody((b) => (b ? `${b} ${chunk}` : chunk)));
  const metrics = count(body);

  const onAttach = async () => {
    const img = await pickImage();
    if (img) setImageUri(img.uri);
  };

  const onAssist = async () => {
    setBusy(true);
    try {
      const addition = await assist(body, 'continue');
      setBody((b) => (b && !/\s$/.test(b) ? `${b} ${addition}` : `${b}${addition}`));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!title.trim() && !body.trim()) return;
    onSubmit({ title: title.trim() || 'Untitled', body: body.trim(), imageUri });
    setTitle('');
    setBody('');
    setImageUri(undefined);
  };

  return (
    <Card>
      <Input label="Title" placeholder="Title…" value={title} onChangeText={setTitle} />
      <AutoGrowInput
        placeholder="Start writing…"
        value={body}
        onChangeText={setBody}
        clearable
        onClear={() => setBody('')}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppText variant="muted">
          {metrics.words}w · {metrics.chars}c
        </AppText>
        <View style={{ flex: 1 }} />
        {dictation.supported ? (
          <IconButton
            name={dictation.listening ? 'mic' : 'mic-outline'}
            active={dictation.listening}
            onPress={dictation.listening ? dictation.stop : dictation.start}
          />
        ) : null}
        <IconButton name="image-outline" onPress={onAttach} />
        <IconButton name="share-outline" onPress={() => shareText(body, title || 'Draft')} />
        <Button title={busy ? '…' : 'AI'} size="sm" variant="secondary" loading={busy} onPress={onAssist} />
      </View>
      {imageUri ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Icon name="image" size="sm" color="textMuted" />
          <AppText variant="muted">image attached</AppText>
        </View>
      ) : null}
      <Button title="Save entry" onPress={submit} />
    </Card>
  );
}
