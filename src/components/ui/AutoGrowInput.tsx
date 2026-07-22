import { useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputProps,
  View,
} from 'react-native';

import { Icon } from './Icon';
import { clampHeight } from '@/lib/ui/autoGrow';
import { colors, radius, space, typography } from '@/theme/tokens';

type Props = TextInputProps & {
  minHeight?: number;
  maxHeight?: number;
  clearable?: boolean;
  onClear?: () => void;
};

/** Multiline input that grows with its content, then scrolls past maxHeight. */
export function AutoGrowInput({
  minHeight = 96,
  maxHeight = 240,
  clearable,
  onClear,
  style,
  value,
  ...rest
}: Props) {
  const [height, setHeight] = useState(minHeight);
  const showClear = Boolean(clearable && value);

  const onContentSizeChange = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    setHeight(clampHeight(e.nativeEvent.contentSize.height, minHeight, maxHeight));
  };

  return (
    <View>
      {/* {...rest} sits between: callers may override placeholder styling, not the controlled growth props. */}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...rest}
        multiline
        value={value}
        onContentSizeChange={onContentSizeChange}
        style={[
          typography.prose,
          {
            height,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: space.md,
            paddingRight: showClear ? space.xl : space.md,
            borderWidth: 1,
            borderColor: colors.border,
            textAlignVertical: 'top',
          },
          style,
        ]}
      />
      {showClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={8}
          accessibilityLabel="Clear text"
          style={{ position: 'absolute', top: space.sm, right: space.sm, padding: space.xs }}
        >
          <Icon name="close-circle" size="sm" color="textMuted" />
        </Pressable>
      ) : null}
    </View>
  );
}
