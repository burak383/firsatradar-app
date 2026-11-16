// Onboarding.tsx
// -----------------------------------------------------------------------
// Ilk acilista gosterilen kisa uygulama turu (4 adim). Atlanabilir; Profil
// ekranindaki "Uygulama turunu göster" ile istenildiginde tekrar acilabilir.
// Tur bir kez gorulunce (ya da atlaninca) AsyncStorage'a isaretlenir ve
// uygulama bir sonraki acilista tekrar gostermez.
import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from './theme';

const ONBOARDING_KEY = 'fr_onboarding_done_v1';

// Depolama okunamazsa turu GOSTERME (true don): her acilista karsisina
// cikmasin.
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // yazilamazsa tur bir sonraki acilista tekrar gorunebilir; kritik degil
  }
}

type Step = { icon: React.ComponentProps<typeof Feather>['name']; title: string; body: string };

const STEPS: Step[] = [
  {
    icon: 'compass',
    title: 'Fırsatları tek yerde gör',
    body:
      'Trendyol, Hepsiburada, N11 gibi mağazalardaki indirimler Keşfet ve Kategoriler sekmelerinde. ' +
      'Arama ile bir ürünün mağazalardaki fiyatlarını karşılaştırabilirsin.',
  },
  {
    icon: 'shield',
    title: 'İndirim gerçek mi?',
    body:
      'Ürün detayında güncel fiyatın, geçmiş fiyat ortalamasına göre nasıl durduğunu görürsün. ' +
      'Fiyat grafiğindeki kesikli çizgi ortalamayı gösterir.',
  },
  {
    icon: 'bell',
    title: 'Hedef fiyatını belirle',
    body: 'Bir ürüne alarm kur; fiyat hedefine düştüğünde bildirim al. Alarmların Alarmlar sekmesinde durur.',
  },
  {
    icon: 'sliders',
    title: 'Sana göre ayarla',
    body:
      'Profil sekmesinden mağaza ve kategori tercihlerini seç, bildirimleri yönet. ' +
      'Giriş yapmak zorunda değilsin; yapmazsan alarmların bu cihazda saklanır. ' +
      'Bu turu Profil → "Uygulama turunu göster" ile tekrar açabilirsin.',
  },
];

export default function Onboarding({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = () => {
    markOnboardingSeen();
    onClose();
  };

  return (
    <SafeAreaView style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.topRow}>
        {!isLast ? (
          <Pressable
            hitSlop={12}
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Turu atla"
          >
            <Text style={styles.skipText}>Atla</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Feather name={step.icon} size={44} color={colors.primary} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {step.title}
        </Text>
        <Text style={styles.body}>{step.body}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots} accessibilityLabel={`Adım ${index + 1} / ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          style={styles.nextButton}
          onPress={() => (isLast ? finish() : setIndex(index + 1))}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Başla' : 'Sonraki adım'}
        >
          <Text style={styles.nextText}>{isLast ? 'Başla' : 'İleri'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  topRow: { height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28,
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: 14,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  bottom: { alignItems: 'center' },
  dots: { flexDirection: 'row', marginBottom: 22 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: colors.border,
  },
  dotActive: { width: 24, backgroundColor: colors.primary },
  nextButton: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  nextText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
  },
});
