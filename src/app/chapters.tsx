import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, BackLink, Card, Icon, Screen, tokens } from '@/components/ui';
import { CHAPTERS, CURRENT_CHAPTER_ID, chapterLabel } from '@/lib/session/chapters';

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
      <BackLink label="Chapter 4" onPress={() => router.navigate('/')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="h1">Untitled Novel</AppText>
        {/* The dictionary is a property of the book, so it hangs off the book's
            own screen rather than crowding the chapter you are writing in. */}
        <Pressable
          onPress={() => router.navigate('/dictionary')}
          accessibilityRole="button"
          accessibilityLabel="Dictionary of names and proper nouns"
          hitSlop={10}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: tokens.radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.surface,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="book-outline" size="md" color="textMuted" />
        </Pressable>
      </View>
      <AppText variant="muted">Five chapters. One of them is where you left off.</AppText>

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

    </Screen>
  );
}
