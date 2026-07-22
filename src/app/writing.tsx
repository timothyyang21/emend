import { AppText, Card, EmptyState, Screen, SelectableList } from '@/components/ui';
import { Composer } from '@/components/writing/Composer';
import { useWriting } from '@/store';
import type { WritingEntry } from '@/types/contracts';

export default function Writing() {
  const { entries, upsert, removeMany } = useWriting();
  return (
    <Screen padded avoidKeyboard dismissOnTap>
      <AppText variant="h1">Writing</AppText>
      <Composer onSubmit={(d) => upsert(d)} />
      <SelectableList<WritingEntry>
        data={entries}
        keyExtractor={(e) => e.id}
        onDeleteMany={removeMany}
        searchable
        matches={(e, q) => `${e.title} ${e.body}`.toLowerCase().includes(q.toLowerCase())}
        empty={<EmptyState title="No entries yet" hint="Write something above and save it." />}
        renderItem={(e) => (
          <Card>
            <AppText variant="h2">{e.title}</AppText>
            {e.body ? (
              <AppText variant="muted" numberOfLines={2}>
                {e.body}
              </AppText>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}
