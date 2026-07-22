import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
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
      <AppText variant="h1">Untitled Novel</AppText>
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

      <Button
        title="Back to Chapter 4"
        variant="ghost"
        onPress={() => router.navigate('/')}
      />
    </Screen>
  );
}
