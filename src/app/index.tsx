import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ProposalReview } from '@/components/diff';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { applyDecisions, layoutDiff } from '@/lib/diff';
import { runEdit } from '@/lib/session/runEdit';
import { VOICE_STATUS_LABEL, useVoiceCapture } from '@/lib/voice';
import { useDoc } from '@/store/doc';
import { REVIEW_PHASE_LABEL, useProposal } from '@/store/proposal';
import { SYNC_STATUS_LABEL } from '@/types/contracts';

/**
 * Emend — the whole product on one screen.
 *
 *   the manuscript  →  speak an instruction  →  review the diff  →  accept or
 *   reject each change  →  it saves.
 *
 * The screen never mutates the manuscript directly. Applying a proposal is the
 * single path from AI output to the document, and it runs through
 * `applyDecisions`, which only honours hunks the writer explicitly accepted.
 */
export default function Home() {
  const doc = useDoc();
  const review = useProposal();
  const voice = useVoiceCapture();
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    doc.load();
    // Cold start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStopSpeaking = useCallback(async () => {
    const instruction = await voice.stop();
    if (!instruction) return; // voice surfaces its own error in words

    review.begin(instruction);
    try {
      const proposal = await runEdit(doc.markdown, instruction);
      if (proposal.hunks.length === 0) {
        review.fail(`Nothing changed — “${instruction}” left the text as it was.`);
        return;
      }
      review.present(proposal);
    } catch (e) {
      review.fail(e instanceof Error ? e.message : 'The edit could not be made.');
    }
  }, [voice, review, doc.markdown]);

  const onApply = useCallback(async () => {
    const { proposal, decisions } = review;
    if (!proposal) return;
    setApplying(true);
    try {
      const next = applyDecisions(proposal.baseMarkdown, proposal.hunks, decisions);
      doc.setMarkdown(next, proposal.instruction);
      await doc.flush();
      review.discard();
    } finally {
      setApplying(false);
    }
  }, [review, doc]);

  const recording = voice.status === 'recording';
  const thinking = review.phase === 'thinking';

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="h1">Emend</AppText>
        <AppText variant="label">{SYNC_STATUS_LABEL[doc.status].toUpperCase()}</AppText>
      </View>
      {doc.error && <AppText variant="muted">{doc.error}</AppText>}

      {review.phase === 'reviewing' && review.proposal ? (
        <ProposalReview
          proposal={review.proposal}
          segments={layoutDiff(review.proposal.baseMarkdown, review.proposal.hunks)}
          decisions={review.decisions}
          onDecide={review.decide}
          onDecideAll={review.decideAll}
          onApply={onApply}
          onDiscard={review.discard}
          applying={applying}
        />
      ) : (
        <Card>
          <MarkdownEditor
            markdown={doc.markdown}
            onChangeMarkdown={(md) => doc.setMarkdown(md)}
            editable={!thinking}
          />
        </Card>
      )}

      {review.phase !== 'reviewing' && (
        <Card>
          {/* Fixed footprint: a status line that appears and disappears would
              shove the mic button out from under the writer's thumb. */}
          <View style={{ height: 46, justifyContent: 'center' }}>
            <AppText variant="h2">
              {thinking ? REVIEW_PHASE_LABEL.thinking : VOICE_STATUS_LABEL[voice.status]}
            </AppText>
            {recording && <AppText variant="muted">{voice.durationSec.toFixed(1)}s</AppText>}
          </View>

          {review.pendingInstruction && (thinking || review.phase === 'error') && (
            <AppText variant="prose">“{review.pendingInstruction}”</AppText>
          )}

          {recording ? (
            <>
              <Button title="Stop and make the change" onPress={onStopSpeaking} />
              <Button title="Discard" variant="ghost" onPress={voice.cancel} />
            </>
          ) : (
            <Button
              title={thinking ? 'Working…' : 'Speak an instruction'}
              onPress={voice.start}
              loading={thinking || voice.status === 'transcribing'}
              disabled={thinking || voice.status === 'transcribing'}
            />
          )}

          {voice.error && (
            <>
              <AppText variant="muted">{voice.error}</AppText>
              <Button title="Try again" variant="secondary" onPress={voice.reset} />
            </>
          )}
          {review.phase === 'error' && review.error && (
            <>
              <AppText variant="muted">{review.error}</AppText>
              <Button title="Back to the manuscript" variant="secondary" onPress={review.discard} />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}
