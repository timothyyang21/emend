import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Card, Icon, Input, Screen, tokens } from '@/components/ui';
import { CHAPTERS, CURRENT_CHAPTER_ID, chapterLabel } from '@/lib/session/chapters';
import { useDictionary } from '@/store/dictionary';

/**
 * The manuscript: the chapters this one sits among.
 *
 * Only Chapter 4 opens. The others are rendered visibly inert — dimmed, no
 * chevron, and honest about why — rather than tappable and empty. A tap that
 * goes nowhere is worse than a row that says it isn't ready.
 */
export default function Chapters() {
  const router = useRouter();

  return (
    <Screen scroll>
      <AppText variant="h1">Untitled Novel</AppText>
      <AppText variant="muted">Five chapters. One of them is where you left off.</AppText>

      <StoryBible />

      {CHAPTERS.map((chapter) => {
        const isCurrent = chapter.id === CURRENT_CHAPTER_ID;

        if (!chapter.available) {
          return (
            <Card key={chapter.id} style={{ opacity: 0.45 }}>
              <AppText variant="label">{chapterLabel(chapter).toUpperCase()}</AppText>
              <AppText variant="h2">{chapter.title}</AppText>
              {/* Says what it is instead of pretending to be a destination. */}
              <AppText variant="muted">Not part of this prototype</AppText>
            </Card>
          );
        }

        return (
          <Card key={chapter.id} onPress={() => router.navigate('/')}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="label">{chapterLabel(chapter).toUpperCase()}</AppText>
              {isCurrent && <AppText variant="label">WHERE YOU LEFT OFF</AppText>}
            </View>
            <AppText variant="h2">{chapter.title}</AppText>
            <AppText variant="muted">Open this chapter</AppText>
          </Card>
        );
      })}

      <Button
        title="Back to Chapter 4"
        variant="ghost"
        onPress={() => router.navigate('/')}
      />
    </Screen>
  );
}

/**
 * The story bible — names the AI must never quietly respell.
 *
 * It lives here, at book level, because a character's name is a fact about the
 * novel rather than about Chapter 4. Every voice edit sends this list, and the
 * instruction always outranks it: asking to rename Susan still renames Susan.
 */
function StoryBible() {
  const dictionary = useDictionary();
  const [draft, setDraft] = useState('');

  function addTerm() {
    dictionary.add(draft);
    setDraft('');
  }

  return (
    <Card>
      <AppText variant="label">STORY BIBLE</AppText>
      <AppText variant="muted">
        Names and places the AI must spell exactly as written — unless you ask it to change one.
      </AppText>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
        {dictionary.terms.map((term) => (
          <View
            key={term}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.space.xs,
              paddingVertical: 6,
              paddingLeft: tokens.space.md,
              paddingRight: 6,
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.colors.surfaceAlt,
              borderWidth: 1,
              borderColor: tokens.colors.border,
            }}
          >
            <AppText variant="body">{term}</AppText>
            <Pressable
              onPress={() => dictionary.remove(term)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${term} from the story bible`}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 2 })}
            >
              <Icon name="close" size="sm" color="textMuted" />
            </Pressable>
          </View>
        ))}
        {dictionary.terms.length === 0 && (
          <AppText variant="muted">Empty — the AI will spell names however it sees fit.</AppText>
        )}
      </View>

      <Input
        label="Add a name"
        placeholder="e.g. Wyckhampe"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTerm}
        returnKeyType="done"
        autoCapitalize="words"
      />
      <Button title="Add to the story bible" variant="secondary" size="sm" onPress={addTerm} disabled={draft.trim().length === 0} />
    </Card>
  );
}
