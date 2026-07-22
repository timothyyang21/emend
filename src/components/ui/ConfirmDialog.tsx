import { Modal, Pressable, View } from 'react-native';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Our own confirm, not the system alert.
 *
 * A native `Alert.alert` is grey iOS chrome dropped on top of an ivory Regency
 * page — it belongs to the operating system, not to Emend, and it is the one
 * moment a writer is being asked about their manuscript. The moment that matters
 * most should not look borrowed.
 *
 * Deliberately dumb and fully controlled: it renders what it is told and calls
 * back. No state, no timers, no "are you sure" logic of its own.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Reserved for future tinting of throw-away actions; the confirm is already emphasised. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android hardware back and iOS swipe both mean "no", never "yes".
      onRequestClose={onCancel}
    >
      {/* Tapping the scrim cancels — the safe outcome, never the destructive one. */}
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(43, 38, 32, 0.32)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: space.xl,
        }}
      >
        {/* Swallows taps so pressing the dialog itself doesn't dismiss it. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            padding: space.lg,
            gap: space.md,
            ...shadow.card,
          }}
        >
          <AppText variant="h2">{title}</AppText>
          {message ? <AppText variant="muted">{message}</AppText> : null}

          <View style={{ gap: space.sm }}>
            {/* The confirm carries the emphasis: someone who opened this dialog
                came here to do the thing, and making them hunt for it in the
                quieter control is friction on a decision they already made. The
                safety is the dialog existing at all — plus the scrim and the
                hardware back both meaning "no". */}
            <Button title={confirmLabel} onPress={onConfirm} />
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
