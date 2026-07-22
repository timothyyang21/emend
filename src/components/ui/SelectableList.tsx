import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { Input } from './Input';
import { useBulkSelection } from '@/lib/selection/bulkSelection';
import { colors, fontFamily, radius, space } from '@/theme/tokens';

type SelectableListProps<T> = {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, selected: boolean) => React.ReactNode;
  onDeleteMany: (ids: string[]) => void;
  searchable?: boolean;
  matches?: (item: T, query: string) => boolean;
  undoMs?: number;
  empty?: React.ReactNode;
};

type Pending = { ids: string[]; timer: ReturnType<typeof setTimeout> };

export function SelectableList<T>({
  data,
  keyExtractor,
  renderItem,
  onDeleteMany,
  searchable,
  matches,
  undoMs = 4000,
  empty,
}: SelectableListProps<T>) {
  const sel = useBulkSelection();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);

  // Latest-value refs so the unmount cleanup below can see the current pending
  // batch and the current onDeleteMany without re-subscribing on every change
  // (the cleanup must fire only on actual unmount, not on every pending update).
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;
  const onDeleteManyRef = useRef(onDeleteMany);
  onDeleteManyRef.current = onDeleteMany;

  // Finalize any still-pending batch exactly once on unmount: clear its timer
  // (so it can never also fire after teardown) and commit it immediately.
  useEffect(() => {
    return () => {
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timer);
        onDeleteManyRef.current(p.ids);
      }
    };
  }, []);

  const visible = useMemo(() => {
    const hidden = new Set(pending?.ids ?? []);
    return data.filter((it) => {
      const id = keyExtractor(it);
      if (hidden.has(id)) return false;
      if (searchable && query && matches) return matches(it, query);
      return true;
    });
  }, [data, pending, query, searchable, matches, keyExtractor]);

  const commitDelete = (ids: string[]) => {
    // Flush-on-new: only one batch is ever "pending" at a time. If a previous
    // batch is still waiting out its undo window, finalize it right now —
    // clear its timer (so it can never also fire later and double-delete)
    // and commit it for real — before starting the new batch's own timer.
    if (pending) {
      clearTimeout(pending.timer);
      onDeleteMany(pending.ids);
    }
    const timer = setTimeout(() => {
      onDeleteMany(ids);
      setPending(null);
    }, undoMs);
    setPending({ ids, timer });
    sel.exit();
  };

  const undo = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    setPending(null);
  };

  return (
    <View style={{ flex: 1, gap: space.sm }}>
      {sel.mode ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Button title="Cancel" variant="ghost" size="sm" onPress={sel.exit} />
          <Button title="All" variant="secondary" size="sm" onPress={() => sel.selectAll(visible.map(keyExtractor))} />
          <View style={{ flex: 1 }} />
          <Button
            title={`Delete ${sel.count}`}
            variant="secondary"
            size="sm"
            disabled={sel.count === 0}
            onPress={() => commitDelete(sel.selectedIds)}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {searchable ? (
            <View style={{ flex: 1 }}>
              <Input placeholder="Search…" value={query} onChangeText={setQuery} />
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Button title="Select" variant="ghost" size="sm" onPress={sel.enter} />
        </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ gap: space.sm }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={empty ? <>{empty}</> : null}
        renderItem={({ item }) => {
          const id = keyExtractor(item);
          const selected = sel.isSelected(id);
          return (
            <Pressable
              onPress={() => (sel.mode ? sel.toggle(id) : undefined)}
              onLongPress={() => {
                if (!sel.mode) {
                  sel.enter();
                  sel.toggle(id);
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
              {sel.mode ? (
                <Icon name={selected ? 'checkmark-circle' : 'ellipse-outline'} color={selected ? 'primary' : 'textMuted'} />
              ) : null}
              <View style={{ flex: 1 }}>{renderItem(item, selected)}</View>
            </Pressable>
          );
        }}
      />

      {pending ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            padding: space.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="muted">{pending.ids.length} deleted</AppText>
          <Pressable onPress={undo} hitSlop={8}>
            <AppText style={{ color: colors.primary, fontFamily: fontFamily.sansBold }}>Undo</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
