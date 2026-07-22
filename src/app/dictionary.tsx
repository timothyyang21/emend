import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, BackLink, Button, Card, Icon, Input, Screen, tokens } from '@/components/ui';
import { useDictionary } from '@/store/dictionary';

/**
 * The dictionary — names the AI must never quietly respell.
 *
 * Book-level, and its own screen: a character's name is a fact about the novel,
 * not about Chapter 4, and it is a list that grows for the length of a book. It
 * hangs off the manuscript screen rather than the editor so it is never chrome
 * competing with the prose.
 *
 * Every voice edit sends this list. The instruction always outranks it — asking
 * to rename Susan still renames Susan; the list only guards against changes
 * nobody asked for.
 */
export default function Dictionary() {
  const router = useRouter();
  const dictionary = useDictionary();
  const [draft, setDraft] = useState('');

  const trimmed = draft.trim();
  const duplicate =
    trimmed.length > 0 &&
    dictionary.terms.some((t) => t.toLowerCase() === trimmed.toLowerCase());

  function addTerm() {
    if (!trimmed || duplicate) return;
    dictionary.add(draft);
    setDraft('');
  }

  return (
    <Screen scroll>
      <BackLink label="Untitled Novel" onPress={() => router.navigate('/chapters')} />
      <AppText variant="h1">Dictionary</AppText>
      <AppText variant="muted">
        Characters, places and invented spellings. The AI reproduces these exactly and never
        &ldquo;corrects&rdquo; them — unless you ask it to change one.
      </AppText>

      <Card>
        <AppText variant="label">{dictionary.terms.length} ENTRIES</AppText>

        {dictionary.terms.length === 0 ? (
          <AppText variant="muted">
            Empty. The AI will spell names however it sees fit — add the ones that matter.
          </AppText>
        ) : (
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
                  accessibilityLabel={`Remove ${term} from the dictionary`}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 2 })}
                >
                  <Icon name="close" size="sm" color="textMuted" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <Input
          label="Add a name"
          placeholder="e.g. Wyckhampe"
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addTerm}
          returnKeyType="done"
          autoCapitalize="words"
          error={duplicate ? 'Already in the dictionary.' : undefined}
        />
        <Button
          title="Add to the dictionary"
          variant="secondary"
          onPress={addTerm}
          disabled={trimmed.length === 0 || duplicate}
        />
      </Card>

    </Screen>
  );
}
