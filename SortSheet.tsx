// SortSheet.tsx
// -----------------------------------------------------------------------
// Kucuk, tekrar kullanilabilir bir "sirala" secim penceresi (alttan acilan
// basit bir Modal). KeFet, Kategoriler ve benzer ekranlardaki "filtre/
// sirala" ikon butonlari (daha once hicbir seye bagli olmayan, dokununca
// hicbir sey olmayan dekoratif butonlardi) bunu kullanarak GERCEK,
// backend'in zaten destekledigi sort seceneklerini (indirim, fiyat artan/
// azalan, en yeni, en cok takip edilen) uygulamaya baglar.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from './theme';

export type SortOption = { value: string; label: string };

export function SortSheet({
  visible,
  onClose,
  options,
  selected,
  onSelect,
  title = 'Sırala',
}: {
  visible: boolean;
  onClose: () => void;
  options: SortOption[];
  selected: string;
  onSelect: (value: string) => void;
  title?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>
          {options.map((opt) => {
            const active = opt.value === selected;
            return (
              <Pressable
                key={opt.value}
                style={styles.row}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
              >
                <Text style={[styles.rowText, active && styles.rowTextActive]}>
                  {opt.label}
                </Text>
                {active && <Feather name="check" size={18} color={colors.primary} />}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  rowTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
