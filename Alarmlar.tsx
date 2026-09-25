import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from './theme';
import { Alarm, deleteAlarm, formatPrice, getAlarms, updateAlarm } from './api';

// react-native-web'de Alert.alert butonlari destekleyen bir dialog
// gostermiyor (sadece window.alert'e dusuyor) -- bu yuzden web'de
// window.confirm kullaniyoruz, native'de gercek Alert.alert.
function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: 'Kaldır', style: 'destructive', onPress: onConfirm },
  ]);
}

export default function TrackedProductsScreen({
  onOpenDeal,
  onNavigateTab,
  refreshSignal,
}: {
  onOpenDeal?: (id: number) => void;
  onNavigateTab?: (key: string) => void;
  refreshSignal?: number;
} = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [summary, setSummary] = useState({ trackedCount: 0, potentialSavings: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAlarms();
      setAlarms(res.alarms);
      setSummary(res.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Alarmlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshSignal]);

  const toggleActive = useCallback(
    async (alarm: Alarm) => {
      // Once tepkiyle guncelle, hata olursa listeyi yeniden yukleyerek duzelt.
      setAlarms((prev) =>
        prev.map((a) => (a.id === alarm.id ? { ...a, active: !a.active } : a))
      );
      try {
        await updateAlarm(alarm.id, { active: !alarm.active });
      } catch {
        load();
      }
    },
    [load]
  );

  const removeAlarm = useCallback(
    async (alarm: Alarm) => {
      setAlarms((prev) => prev.filter((a) => a.id !== alarm.id));
      try {
        await deleteAlarm(alarm.id);
      } catch {
        load();
      }
    },
    [load]
  );

  const renderProduct = (alarm: Alarm, index: number) => {
    const deal = alarm.deal;
    if (!deal) return null;
    const disabled = !alarm.active;

    return (
      <View
        key={alarm.id}
        style={[styles.productCard, index === 0 && styles.featuredCard]}
      >
        <Pressable style={styles.productRow} onPress={() => onOpenDeal?.(deal.id)}>
          <View style={[styles.productImageBox, { backgroundColor: colors.secondary }]}>
            <View style={styles.storeBadge}>
              <Text
                style={[styles.storeText, deal.store !== 'amazon' && styles.storeTextLight]}
              >
                {deal.store}
              </Text>
            </View>

            {deal.imageUrl ? (
              <Image
                source={{ uri: deal.imageUrl }}
                resizeMode="contain"
                style={styles.productImage}
                accessibilityLabel={deal.title}
              />
            ) : (
              <View style={styles.placeholderIcon}>
                <MaterialCommunityIcons name="headphones" size={30} color={colors.mutedForeground} />
              </View>
            )}
          </View>

          <View style={styles.productDetails}>
            <View style={styles.titleRow}>
              <Text style={styles.productName} numberOfLines={2}>
                {deal.title}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Takipten kaldır"
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation?.();
                  confirmAction(
                    'Takipten kaldır',
                    `"${deal.title}" fiyat alarmını kaldırmak istediğine emin misin?`,
                    () => removeAlarm(alarm)
                  );
                }}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={21} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.priceRow}>
              <View>
                <Text style={styles.caption}>Güncel fiyat</Text>
                <Text style={styles.currentPrice}>{formatPrice(deal.currentPrice, deal.currency)}</Text>
              </View>
              {alarm.targetPrice != null && (
                <View style={styles.targetPrice}>
                  <Text style={styles.targetCaption}>Hedef fiyat</Text>
                  <Text style={styles.targetValue}>{formatPrice(alarm.targetPrice, deal.currency)}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {alarm.dropText && (
          <View style={styles.dropRow}>
            <MaterialCommunityIcons name="trending-down" size={16} color={colors.accent} />
            <Text style={styles.dropText}>{alarm.dropText}</Text>
          </View>
        )}

        <View style={styles.alertRow}>
          <View style={styles.alertLabel}>
            <View style={[styles.alertIcon, disabled && styles.disabledAlertIcon]}>
              <MaterialCommunityIcons
                name={disabled ? 'bell-off-outline' : 'bell-ring-outline'}
                size={15}
                color={disabled ? colors.mutedForeground : colors.accent}
              />
            </View>
            <Text style={[styles.alertText, disabled && styles.disabledAlertText]}>
              Fiyat Düşünce Bildir
            </Text>
          </View>

          <TouchableOpacity
            accessibilityLabel="Bildirimi aç/kapat"
            style={[styles.switchTrack, disabled && styles.switchTrackOff]}
            onPress={() => toggleActive(alarm)}
          >
            <View style={[styles.switchThumb, disabled && styles.switchThumbOff]} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.historyButton}
          onPress={() => Linking.openURL(deal.storeUrl)}
        >
          <MaterialCommunityIcons name="chart-line" size={16} color={colors.primary} />
          <Text style={styles.historyText}>Mağazada gör</Text>
          <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.secondaryForeground} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
      />

      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Fırsat kontrol merkezi</Text>
            <Text style={styles.screenTitle}>Takip Ettiklerim</Text>
            <View style={styles.followingPill}>
              <View style={styles.onlineDot} />
              <Text style={styles.followingText}>{summary.trackedCount} ürün takipte</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.headerButton}
            accessibilityLabel="Bildirim ayarları"
            onPress={() => onNavigateTab?.('profil')}
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={22}
              color={colors.foreground}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.savingsCard}>
            <View style={styles.decorativeCircle} />
            <View style={styles.savingsContent}>
              <View style={styles.savingsHeading}>
                <View style={styles.savingsIcon}>
                  <MaterialCommunityIcons
                    name="trending-up"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.savingsLabel}>Tasarruf görünümü</Text>
              </View>

              <Text style={styles.savingsTitle}>
                Bu ay takip ettiklerinden{' '}
                <Text style={styles.savingsAmount}>{formatPrice(summary.potentialSavings)}</Text> tasarruf
                potansiyeli
              </Text>

              <View style={styles.savingsFooter}>
                <MaterialCommunityIcons
                  name="arrow-down-right"
                  size={17}
                  color={colors.accent}
                />
                <Text style={styles.savingsHint}>
                  Fiyat düşüşlerini kaçırma
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>Aktif izleme</Text>
              <Text style={styles.sectionTitle}>Fiyat alarmların</Text>
            </View>
            <Text style={styles.productCount}>{alarms.length} ürün</Text>
          </View>

          {loading && (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {!loading && error && (
            <View style={{ paddingVertical: 24, alignItems: 'center', gap: 10 }}>
              <Text style={{ color: colors.destructive, fontFamily: fonts.body, fontSize: 12 }}>
                {error}
              </Text>
              <TouchableOpacity style={styles.createButton} onPress={load}>
                <Text style={styles.createButtonText}>Tekrar dene</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && alarms.length === 0 && (
            <Text style={styles.helperText}>
              Henüz takip ettiğin bir ürün yok. Arama'dan bir ürün seçip alarm kur.
            </Text>
          )}

          {!loading && !error && alarms.map(renderProduct)}

          <TouchableOpacity style={styles.createButton} onPress={() => onNavigateTab?.('arama')}>
            <MaterialCommunityIcons
              name="plus"
              size={22}
              color={colors.primaryForeground}
            />
            <Text style={styles.createButtonText}>
              Yeni fiyat alarmı oluştur
            </Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color={colors.primaryForeground}
            />
          </TouchableOpacity>

          <Text style={styles.helperText}>
            Arama’dan bir ürün seç, hedef fiyatını belirle ve düşüşü ilk sen
            öğren.
          </Text>
        </ScrollView>

        <View style={styles.tabBar}>
          {[
            { label: 'Keşfet', icon: 'compass-outline', key: 'kefet' },
            { label: 'Kategoriler', icon: 'shape-outline', key: 'kategoriler' },
            { label: 'Alarmlar', icon: 'bell-outline', active: true, key: 'alarmlar' },
            { label: 'Profil', icon: 'account-outline', key: 'profil' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.label}
              style={styles.tab}
              onPress={() => onNavigateTab?.(tab.key)}
            >
              <View style={[styles.tabIcon, tab.active && styles.activeTabIcon]}>
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={21}
                  color={tab.active ? colors.primary : colors.mutedForeground}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  tab.active && styles.activeTabLabel,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  screenTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 27,
    fontWeight: '700',
  },
  followingPill: {
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  onlineDot: {
    width: 6,
    height: 6,
    marginRight: 8,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  followingText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  headerButton: {
    width: 44,
    height: 44,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  savingsCard: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.card,
  },
  decorativeCircle: {
    position: 'absolute',
    width: 145,
    height: 145,
    right: -42,
    top: -48,
    borderRadius: 75,
    borderWidth: 20,
    borderColor: colors.accent,
    opacity: 0.1,
  },
  savingsContent: {
    padding: 20,
  },
  savingsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsIcon: {
    width: 32,
    height: 32,
    marginRight: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.accent,
    opacity: 0.95,
  },
  savingsLabel: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  savingsTitle: {
    maxWidth: 290,
    marginTop: 15,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 27,
  },
  savingsAmount: {
    color: colors.accent,
  },
  savingsFooter: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsHint: {
    marginLeft: 7,
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    marginTop: 27,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  productCount: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
  },
  productCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  featuredCard: {
    borderColor: colors.primary,
  },
  productRow: {
    flexDirection: 'row',
  },
  productImageBox: {
    width: 92,
    height: 92,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  storeBadge: {
    position: 'absolute',
    zIndex: 1,
    left: 7,
    top: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: colors.foreground,
  },
  storeText: {
    color: colors.background,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
  storeTextLight: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
  },
  productImage: {
    width: 84,
    height: 84,
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  productDetails: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  productName: {
    flex: 1,
    marginRight: 6,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 18,
  },
  priceRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  caption: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  currentPrice: {
    marginTop: 3,
    color: colors.accent,
    fontFamily: fonts.heading,
    fontSize: 23,
    fontWeight: '700',
  },
  targetPrice: {
    alignItems: 'flex-end',
  },
  targetCaption: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  targetValue: {
    marginTop: 3,
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
  },
  dropRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropText: {
    marginLeft: 6,
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  alertRow: {
    marginTop: 15,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  alertLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIcon: {
    width: 28,
    height: 28,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.accent,
    opacity: 0.9,
  },
  disabledAlertIcon: {
    backgroundColor: colors.muted,
  },
  alertText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  disabledAlertText: {
    color: colors.mutedForeground,
  },
  switchTrack: {
    width: 48,
    height: 28,
    padding: 4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.accent,
  },
  switchTrackOff: {
    alignItems: 'flex-start',
    backgroundColor: colors.secondary,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.successForeground,
  },
  switchThumbOff: {
    backgroundColor: colors.mutedForeground,
  },
  historyButton: {
    marginTop: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  historyText: {
    marginHorizontal: 8,
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  createButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  createButtonText: {
    marginHorizontal: 9,
    color: colors.primaryForeground,
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    marginTop: 10,
    paddingHorizontal: 14,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  tabBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  tabIcon: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabIcon: {
    width: 44,
    borderRadius: 18,
    backgroundColor: colors.primary,
    opacity: 0.95,
  },
  tabLabel: {
    marginTop: 3,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '700',
  },
});