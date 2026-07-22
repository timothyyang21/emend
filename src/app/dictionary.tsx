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

  const [draftDescription, setDraftDescription] = useState('');
  const trimmed = draft.trim();
  const duplicate =
    trimmed.length > 0 &&
    dictionary.entries.some((e) => e.term.toLowerCase() === trimmed.toLowerCase());

  function addTerm() {
    if (!trimmed || duplicate) return;
    dictionary.add(draft, draftDescription);
    setDraft('');
    setDraftDescription('');
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
        <AppText variant="label">{dictionary.entries.length} ENTRIES</AppText>

        {dictionary.entries.length === 0 ? (
          <AppText variant="muted">
            Empty. The AI will spell names however it sees fit — add the ones that matter.
          </AppText>
        ) : (
          <View style={{ gap: tokens.space.md }}>
            {dictionary.entries.map((entry) => (
              <View key={entry.term} style={{ gap: tokens.space.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <AppText variant="h2">{entry.term}</AppText>
                  <Pressable
                    onPress={() => dictionary.remove(entry.term)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.term} from the dictionary`}
                    hitSlop={10}
                    style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                  >
                    <Icon name="close" size="sm" color="textMuted" />
                  </Pressable>
                </View>
                {/* Edited in place: a name whose description is wrong is a name
                    the model will use wrongly, and it should take one tap to fix. */}
                <Input
                  placeholder="What is this? (a character, a street…)"
                  value={entry.description ?? ''}
                  onChangeText={(text: string) => dictionary.describe(entry.term, text)}
                />
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
          returnKeyType="next"
          autoCapitalize="words"
          error={duplicate ? 'Already in the dictionary.' : undefined}
        />
        <Input
          label="What is it? (optional)"
          placeholder="e.g. a village on the north line"
          value={draftDescription}
          onChangeText={setDraftDescription}
          onSubmitEditing={addTerm}
          returnKeyType="done"
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
