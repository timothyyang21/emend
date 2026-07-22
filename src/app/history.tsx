import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppText, BackLink, Button, Card, Screen } from '@/components/ui';
import { describeEdit, relativeTime, restorable, restoreLabel } from '@/lib/session/history';
import { useDoc } from '@/store/doc';
import { useHistory } from '@/store/history';

/**
 * The edits you made, newest first — tap one to go back to before it.
 *
 * Restoring is an ordinary edit: it writes the old text through the document
 * store, which saves it as a NEW version. Nothing is ever removed from the
 * stack, so undoing an undo is just another row, and no work is lost by going
 * backwards.
 */
export default function History() {
  const router = useRouter();
  const doc = useDoc();
  const history = useHistory();
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);

  useEffect(() => {
    history.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = restorable(history.versions);
  const now = Date.now();

  async function restore(version: (typeof entries)[number]) {
    setRestoringVersion(version.version);
    try {
      doc.setMarkdown(version.markdown, restoreLabel(version, now));
      await doc.flush();
      router.navigate('/');
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <Screen scroll>
      <BackLink label="Chapter 4" onPress={() => router.navigate('/')} />
      <AppText variant="h1">History</AppText>
      <AppText variant="muted">
        Every edit you accepted. Tap one to put the manuscript back to how it was before that
        change — nothing is deleted, and you can come forward again.
      </AppText>

      {history.status === 'loading' && <AppText variant="muted">Loading your history…</AppText>}

      {history.status === 'error' && (
        <Card>
          <AppText variant="h2">Could not load your history</AppText>
          <AppText variant="muted">{history.error}</AppText>
          <Button title="Try again" variant="secondary" onPress={history.refresh} />
        </Card>
      )}

      {history.status === 'idle' && entries.length === 0 && (
        <Card>
          <AppText variant="h2">No edits yet</AppText>
          <AppText variant="muted">
            Once you accept a change, it shows up here and you can undo it.
          </AppText>
        </Card>
      )}

      {entries.map((v) => (
        <Card key={v.version}>
          <AppText variant="label">{relativeTime(v.createdAt, now).toUpperCase()}</AppText>
          <AppText variant="prose">{describeEdit(v, now)}</AppText>
          <Button
            title={`Undo ${describeEdit(v, now)}`}
            variant="secondary"
            onPress={() => restore(v)}
            loading={restoringVersion === v.version}
            disabled={restoringVersion !== null}
          />
        </Card>
      ))}

    </Screen>
  );
}
