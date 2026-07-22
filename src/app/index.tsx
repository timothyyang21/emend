import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProposalReview } from '@/components/diff';
import { MarkdownEditor } from '@/components/editor';
import type { MarkdownEditorHandle } from '@/components/editor/types';
import { AppText, Button, Card, Icon, Screen, tokens } from '@/components/ui';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { applyDecisions, layoutDiff } from '@/lib/diff';
import { chapterLabel, currentChapter } from '@/lib/session/chapters';
import { describeEdit, lastEdit, restoreLabel } from '@/lib/session/history';
import { runEdit } from '@/lib/session/runEdit';
import { VOICE_STATUS_LABEL, useVoiceCapture } from '@/lib/voice';
import { useDictionary } from '@/store/dictionary';
import { useDoc } from '@/store/doc';
import { useHistory } from '@/store/history';
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
 *
 * Two layouts, deliberately: writing mode gives the editor a bounded flex:1 box
 * (it scrolls internally — nesting it in a ScrollView breaks its scrolling and
 * its caret tracking), review mode scrolls the page because the change list is
 * arbitrarily long.
 */
export default function Home() {
  const doc = useDoc();
  const review = useProposal();
  const voice = useVoiceCapture();
  const history = useHistory();
  const dictionary = useDictionary();
  const router = useRouter();
  const [applying, setApplying] = useState(false);
  const [undoing, setUndoing] = useState(false);
  // The command panel is closed by default: the editor is for writing, and a
  // permanent control bar competes with the sentence being written.
  const [voiceOpen, setVoiceOpen] = useState(false);
  // Mirrors the page's focus so the top bar can offer the way out of the
  // keyboard. Tap-outside still works; this is the backup that is always in the
  // same place.
  const [editorFocused, setEditorFocused] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle>(null);

  // Tapping anything that is not the manuscript puts the keyboard away. Without
  // this a contenteditable is a trap: iOS offers no "Done" of its own, and every
  // pixel of the editor is more document to type into.
  const dismissKeyboard = useCallback(() => editorRef.current?.blur(), []);

  useEffect(() => {
    doc.load();
    history.refresh();
    // Cold start only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStopSpeaking = useCallback(async () => {
    const instruction = await voice.stop();
    if (!instruction) return; // voice surfaces its own error in words

    review.begin(instruction);
    try {
      // The story bible rides every edit: the server turns it into "preserve the
      // exact spelling of these unless told otherwise".
      const proposal = await runEdit(doc.markdown, instruction, {
        dictionary: dictionary.terms,
      });
      if (proposal.hunks.length === 0) {
        review.fail(`Nothing changed — “${instruction}” left the text as it was.`);
        return;
      }
      review.present(proposal);
      setVoiceOpen(false);
    } catch (e) {
      review.fail(e instanceof Error ? e.message : 'The edit could not be made.');
    }
  }, [voice, review, doc.markdown, dictionary.terms]);

  const onApply = useCallback(async () => {
    const { proposal, decisions } = review;
    if (!proposal) return;
    setApplying(true);
    try {
      const next = applyDecisions(proposal.baseMarkdown, proposal.hunks, decisions);
      doc.setMarkdown(next, proposal.instruction);
      await doc.flush();
      review.discard();
      // The stack only gains an entry once the save lands, so refresh after the
      // flush — otherwise Undo would still name the previous edit.
      await history.refresh();
    } finally {
      setApplying(false);
    }
  }, [review, doc, history]);

  /**
   * Undo the most recent accepted edit. Restoring is an ordinary edit: it writes
   * the old text through the document store, which saves it as a NEW version.
   * Nothing is removed from the stack, so this is reversible in its turn.
   */
  const onUndo = useCallback(async () => {
    setUndoing(true);
    try {
      // Re-read the stack FIRST and act on what comes back, never on the cached
      // copy. The cache is refreshed in the background, so acting on it makes
      // Undo silently do nothing whenever that refresh was stale or had failed —
      // which is indistinguishable, on a phone, from a dead button.
      await history.refresh();
      const previous = lastEdit(useHistory.getState().versions);
      if (!previous) return;

      doc.setMarkdown(previous.markdown, restoreLabel(previous, Date.now()));
      await doc.flush();
      await history.refresh();
    } finally {
      setUndoing(false);
    }
  }, [doc, history]);

  const undoTarget = lastEdit(history.versions);

  /**
   * The review screen is secondary chrome, so it can afford to say its own name.
   * The editor cannot — see the writing-mode header below.
   */
  const reviewHeader = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <AppText variant="h2">Emend</AppText>
      <AppText variant="label">{SYNC_STATUS_LABEL[doc.status].toUpperCase()}</AppText>
    </View>
  );

  /**
   * WRITING MODE HEADER — deliberately almost nothing.
   *
   * The manuscript is the hero on this screen; a wordmark above it is the app
   * talking over the writer's own words. What survives is the one thing that
   * isn't decoration: whether their work is saved, in words, quietly. The name
   * lives on the splash, the icon, and the secondary screens.
   *
   * It stays a Pressable because it is also the tap-outside target that puts the
   * keyboard away.
   */
  const writingHeader = (
    <Pressable
      onPress={dismissKeyboard}
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
    >
      {/* Left: where you can GO, named. Right: where you ARE, and whether it is
          safe. Between them they say "chapter four of something" without putting
          a word of the app's own branding above the writer's prose. */}
      <Pressable
        onPress={() => {
          dismissKeyboard();
          router.navigate('/chapters');
        }}
        hitSlop={10}
      >
        <AppText variant="label">‹ ALL CHAPTERS</AppText>
      </Pressable>
      <AppText variant="label">
        {chapterLabel(currentChapter).toUpperCase()} · {SYNC_STATUS_LABEL[doc.status].toUpperCase()}
      </AppText>
    </Pressable>
  );

  /**
   * Undo and History belong UP HERE, reachable mid-sentence. Down beside the mic
   * they were controls about the past filed under the control for making new
   * changes, and you had to leave the keyboard to reach them.
   */
  const writingControls = (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.space.sm }}>
      {undoTarget && (
        <IconControl
          name="arrow-undo-outline"
          // The full sentence moves to the accessibility label rather than
          // disappearing: the control is compact, not mute.
          label={`Undo ${describeEdit(undoTarget, Date.now())}`}
          onPress={onUndo}
          disabled={undoing}
        />
      )}
      <IconControl
        name="time-outline"
        label="History of your edits"
        onPress={() => {
          dismissKeyboard();
          router.navigate('/history');
        }}
        disabled={undoing}
      />
      {/* Only while the keyboard is up. A permanent Done would be a control that
          does nothing most of the time. */}
      {editorFocused && (
        <Button title="Done" variant="secondary" size="sm" onPress={dismissKeyboard} />
      )}
    </View>
  );

  // --- Review mode: the page scrolls, the editor is off screen -------------
  if (review.phase === 'reviewing' && review.proposal) {
    return (
      <Screen scroll>
        {reviewHeader}
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
      </Screen>
    );
  }

  // --- Writing mode: editor owns the space, controls pinned below ----------
  const recording = voice.status === 'recording';
  const thinking = review.phase === 'thinking';
  const busy = thinking || voice.status === 'transcribing';

  return (
    <Screen>
      {writingHeader}
      {writingControls}
      {doc.error && <AppText variant="muted">{doc.error}</AppText>}

      {/* Bounded box — the editor scrolls itself. */}
      <View style={{ flex: 1 }}>
        <MarkdownEditor
          ref={editorRef}
          markdown={doc.markdown}
          onChangeMarkdown={(md: string) => doc.setMarkdown(md)}
          onFocusChange={setEditorFocused}
          editable={!busy}
        />
      </View>

      {/* The command panel, only when asked for. Anything the writer must SEE —
          an error, a failed edit — stays visible whether it is open or not. */}
      {(voiceOpen || busy || recording || voice.error || review.phase === 'error') && (
        <Pressable onPress={dismissKeyboard}>
          <Card>
            {/* Fixed footprint: a status line that appears and disappears would
                shove the controls out from under the writer's thumb. */}
            {/* Taller, and a fixed footprint: the status line changes wording as
                the state changes, and a box that resizes under a thumb is how a
                tap lands on the wrong control. */}
            <View style={{ minHeight: 76, justifyContent: 'center', gap: tokens.space.xs }}>
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
                title={thinking ? 'Working…' : 'Tap to speak an instruction'}
                onPress={() => {
                  dismissKeyboard();
                  voice.start();
                }}
                loading={busy}
                disabled={busy}
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
                <Button
                  title="Back to the manuscript"
                  variant="secondary"
                  onPress={() => {
                    review.discard();
                    setVoiceOpen(false);
                  }}
                />
              </>
            )}
          </Card>
        </Pressable>
      )}

      {/* Floating, bottom-right, over the manuscript. Never while recording —
          the panel owns the screen then, and a second control competing with
          "Stop" is how a recording gets lost. */}
      {!recording && (
        <View style={{ position: 'absolute', right: tokens.space.xl, bottom: tokens.space.xl }}>
          <VoiceButton
            active={voiceOpen}
            disabled={busy}
            onPress={() => {
              dismissKeyboard();
              setVoiceOpen((open) => !open);
            }}
          />
        </View>
      )}
    </Screen>
  );
}

/**
 * A compact icon control for the writing screen.
 *
 * The labels these replaced were whole sentences — "Undo replace Susan with
 * Janet" — which is the right words in the wrong place: above a manuscript they
 * read as chrome shouting. The sentence survives as the accessibility label, and
 * the History screen still spells every edit out in full.
 */
function IconControl({
  name,
  label,
  onPress,
  disabled,
}: {
  name: React.ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: tokens.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Icon name={name} size="md" color="textMuted" />
    </Pressable>
  );
}
