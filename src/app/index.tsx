import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ProposalReview } from '@/components/diff';
import { MarkdownEditor } from '@/components/editor';
import type { MarkdownEditorHandle } from '@/components/editor/types';
import { AppText, Button, Card, Icon, Screen, tokens } from '@/components/ui';
import { VoiceButton } from '@/components/voice/VoiceButton';
import { VoiceStatus } from '@/components/voice/VoiceStatus';
import { applyDecisions, layoutDiff } from '@/lib/diff';
import { chapterLabel, currentChapter } from '@/lib/session/chapters';
import { describeEdit, lastEdit, restoreLabel } from '@/lib/session/history';
import { runEdit } from '@/lib/session/runEdit';
import { VOICE_STATUS_LABEL, useVoiceCapture } from '@/lib/voice';
import { toPromptTerms, useDictionary } from '@/store/dictionary';
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
  // Mirrors the page's focus so the top bar can offer the way out of the
  // keyboard. Tap-outside still works; this is the backup that is always in the
  // same place.
  const [editorFocused, setEditorFocused] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  // The rose opens the panel; the panel holds the button that actually records.
  // Two deliberate steps, so a single stray tap on a floating control can never
  // start listening to the room.
  const [voiceOpen, setVoiceOpen] = useState(false);

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
        dictionary: toPromptTerms(dictionary.entries),
      });
      if (proposal.hunks.length === 0) {
        review.fail(`Nothing changed — “${instruction}” left the text as it was.`);
        setVoiceOpen(false);
        return;
      }
      review.present(proposal);
      setVoiceOpen(false);
    } catch (e) {
      review.fail(e instanceof Error ? e.message : 'The edit could not be made.');
      setVoiceOpen(false);
    }
  }, [voice, review, doc.markdown, dictionary.entries]);

  const onApply = useCallback(async () => {
    // Read the store, not this render's snapshot: "accept all, then apply" sets
    // the decisions and applies in the same tap, and a captured snapshot would
    // still hold the empty decision map — applying nothing at all.
    const { proposal, decisions } = useProposal.getState();
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
   * The fast path: accept every change and commit it in one tap.
   *
   * Safe to collapse into one control because it is not destructive — the whole
   * edit lands as a single version, and Undo reverses it by name. The per-change
   * controls are still there for anyone who wants them; this is the shortcut, not
   * a replacement for the review.
   */
  const onApplyAll = useCallback(async () => {
    review.decideAll('accepted');
    await onApply();
  }, [review, onApply]);

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
      <Screen>
        {reviewHeader}
        <ProposalReview
          proposal={review.proposal}
          segments={layoutDiff(review.proposal.baseMarkdown, review.proposal.hunks)}
          decisions={review.decisions}
          onDecide={review.decide}
          onDecideAll={review.decideAll}
          onApply={onApply}
          onApplyAll={onApplyAll}
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
  const panelVisible = voiceOpen || recording || busy || !!voice.error || review.phase === 'error';

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

      {/* Status, not a menu. There is no "open the voice panel" any more: the
          button IS the control, and this appears only when there is something
          the writer needs to see. */}
      {panelVisible && (
        <Pressable onPress={dismissKeyboard}>
          <Card>
            {/* Fixed footprint, and one constant anchor: the rose stays put
                across recording → transcribing → thinking so the steps read as
                one request continuing, not three screens. */}
            <View style={{ minHeight: 76, justifyContent: 'center' }}>
              <VoiceStatus
                label={thinking ? REVIEW_PHASE_LABEL.thinking : VOICE_STATUS_LABEL[voice.status]}
                detail={recording ? `${voice.durationSec.toFixed(1)}s` : undefined}
                busy={busy}
                recording={recording}
              />
            </View>

            {review.pendingInstruction && (thinking || review.phase === 'error') && (
              <AppText variant="prose">“{review.pendingInstruction}”</AppText>
            )}

            {recording ? (
              <>
                <Button title="Stop and make the change" onPress={onStopSpeaking} />
                <Button
                  title="Discard this recording"
                  variant="ghost"
                  onPress={() => {
                    voice.cancel();
                    setVoiceOpen(false);
                  }}
                />
              </>
            ) : (
              !busy && (
                <>
                  {/* The button that actually records. Deliberately not the same
                      words as the line above it. */}
                  <Button title="Start speaking" onPress={voice.start} />
                  <Button
                    title="Close"
                    variant="ghost"
                    onPress={() => {
                      voice.reset();
                      setVoiceOpen(false);
                    }}
                  />
                </>
              )
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
                                }}
                />
              </>
            )}
          </Card>
        </Pressable>
      )}

      {/* Floating, bottom-right, over the manuscript. Hidden whenever the status
          panel is up so the two can never collide — which they did. */}
      {!panelVisible && (
        <View style={{ position: 'absolute', right: tokens.space.xl, bottom: tokens.space.xl }}>
          <VoiceButton
            disabled={busy}
            recording={recording}
            durationSec={voice.durationSec}
            onPress={() => {
              dismissKeyboard();
              setVoiceOpen(true);
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
