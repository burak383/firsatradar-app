// PriceDisclaimer.tsx
// -----------------------------------------------------------------------
// Fiyat bilgilendirme notu. Fiyatlar Telegram fırsat kanallarından ve
// mağaza sayfalarından otomatik toplandığı için gecikmeli/hatalı olabilir;
// bunu kullanıcıya açıkça söylemek hem dürüst hem de mağaza politikaları
// (yanıltıcı içerik) açısından önemli. Birkaç ekranda ortak kullanılır.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from './theme';

export const PRICE_DISCLAIMER_TEXT =
  'Fiyatlar ve indirim oranları mağazalardan ve fırsat kanallarından otomatik toplanır; ' +
  'gecikmeli, eksik ya da hatalı olabilir. Satın almadan önce güncel fiyatı mağaza sayfasında kontrol et.';

export default function PriceDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[styles.box, compact && styles.boxCompact]}
      accessible
      accessibilityLabel={`Bilgilendirme. ${PRICE_DISCLAIMER_TEXT}`}
    >
      <Feather name="info" size={15} color={colors.mutedForeground} style={styles.icon} />
      <Text style={styles.text}>{PRICE_DISCLAIMER_TEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  boxCompact: { marginHorizontal: 0 },
  icon: { marginRight: 8, marginTop: 2 },
  text: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
});
