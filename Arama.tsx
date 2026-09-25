import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { theme } from './theme';
import {
  type Alarm,
  type Deal,
  type SearchResult,
  createAlarm,
  deleteAlarm,
  formatDiscount,
  formatPrice,
  getAlarms,
  search,
} from './api';

const { colors } = theme;

const DEFAULT_QUERY = 'sony';
const SUGGESTED_CHIPS = ['Sony', 'Kulaklık', 'Amazon', 'Elektronik'];

const withAlpha = (color: string, alpha: number) => {
  const value = color.replace('#', '');
  const red = parseInt(value.substring(0, 2), 16);
  const green = parseInt(value.substring(2, 4), 16);
  const blue = parseInt(value.substring(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    onPress={onPress}
    style={styles.iconButton}
  >
    <Ionicons name={icon} size={21} color={colors.secondaryForeground} />
  </Pressable>
);

const Chip = ({
  children,
  active = false,
  onPress,
}: {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    style={[styles.chip, active ? styles.activeChip : styles.secondaryChip]}
    onPress={onPress}
  >
    <Text style={[styles.chipText, active && styles.activeChipText]}>{children}</Text>
  </Pressable>
);

const StoreMark = ({ letter, color }: { letter: string; color: string }) => (
  <View style={[styles.storeMark, { backgroundColor: color }]}>
    <Text style={styles.storeMarkText}>{letter}</Text>
  </View>
);

const ComparisonRow = ({
  name,
  price,
  letter,
  color,
  onPress,
}: {
  name: string;
  price: string;
  letter: string;
  color: string;
  onPress?: () => void;
}) => (
  <Pressable style={styles.comparisonRow} onPress={onPress}>
    <View style={styles.storeName}>
      <StoreMark letter={letter} color={color} />
      <Text style={styles.comparisonName}>{name}</Text>
    </View>
    <Text style={styles.comparisonPrice}>{price}</Text>
  </Pressable>
);

// Sinyal kartindaki kucuk trend grafigi: priceHistory noktalarini
// "0 0 340 82" viewBox'ina olcekler (dusuk fiyat -> grafikte daha asagida,
// RNDetay.tsx'teki PriceChart ile ayni sozlesme).
const buildTrendPath = (history: { price: number; checkedAt: string }[]) => {
  if (history.length < 2) return null;
  const CHART_LEFT = 5;
  const CHART_RIGHT = 335;
  const CHART_TOP = 18;
  const CHART_BOTTOM = 66;
  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const stepX = (CHART_RIGHT - CHART_LEFT) / (history.length - 1);
  const points = history.map((h, i) => ({
    x: CHART_LEFT + i * stepX,
    y: CHART_TOP + ((max - h.price) / span) * (CHART_BOTTOM - CHART_TOP),
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
  const lowestIndex = prices.indexOf(min);
  return { path, last: points[points.length - 1], lowestPrice: min, lowestPoint: points[lowestIndex] };
};

export default function DealComparisonScreen({
  onOpenDeal,
  onNavigateTab,
  refreshSignal,
}: {
  onOpenDeal?: (id: number) => void;
  onNavigateTab?: (key: string) => void;
  refreshSignal?: number;
} = {}) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [alarmId, setAlarmId] = useState<number | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResult(null);
      setAlarmId(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await search(trimmed);
      setResult(res);
      if (res.primary) {
        const { alarms } = await getAlarms();
        const existing = (alarms as Alarm[]).find((a) => a.productId === res.primary!.id);
        setAlarmId(existing ? existing.id : null);
      } else {
        setAlarmId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Arama başarısız oldu');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch(DEFAULT_QUERY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refreshSignal: App.tsx'ten periyodik gelen "arka planda yenile" sinyali.
  // Ekrani yeniden mount etmedigimiz icin, kullanicinin o an yazdigi/
  // aratmis oldugu sorguyu (query) sifirlamadan sadece SONUCLARI tazeleriz.
  // Ilk mount'ta da bu efekt calisir (React kurali), ustteki efekt zaten
  // ayni sorguyu aratmis oluyor -- gereksiz cift cagriyi engellemek icin
  // ilk calismayi atliyoruz.
  const isFirstRefresh = useRef(true);
  useEffect(() => {
    if (isFirstRefresh.current) {
      isFirstRefresh.current = false;
      return;
    }
    runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const toggleAlarm = useCallback(async () => {
    if (!result?.primary) return;
    try {
      if (alarmId) {
        await deleteAlarm(alarmId);
        setAlarmId(null);
      } else {
        const { alarm } = await createAlarm({ productId: result.primary.id });
        setAlarmId(alarm.id);
      }
    } catch {
      // sessizce vazgec; kullanici alarm butonuna tekrar dokunabilir
    }
  }, [result, alarmId]);

  const primary = result?.primary ?? null;
  // Backend karsilastirma listesini her zaman fiyata gore (dusukten
  // yuksege) dondurur. "sortButton" (En buyuk indirim / En dusuk fiyat)
  // bunu istemci tarafinda degistirir -- ayri bir backend sorgusu
  // gerekmiyor, cunku zaten elimizdeki tum karsilastirma satirlarinin
  // discountPercent'i de var.
  const [comparisonSort, setComparisonSort] = useState<'price' | 'discount'>('price');
  const rawComparisons: Deal[] = result?.comparisons ?? [];
  const comparisons: Deal[] = useMemo(() => {
    if (comparisonSort === 'price') return rawComparisons;
    return [...rawComparisons].sort(
      (a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0)
    );
  }, [rawComparisons, comparisonSort]);
  const trend = useMemo(
    () => (primary ? buildTrendPath(primary.priceHistory) : null),
    [primary]
  );
  const isAmazon = primary?.store === 'amazon';
  const savings =
    primary && primary.oldPrice != null && primary.oldPrice > primary.currentPrice
      ? primary.oldPrice - primary.currentPrice
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <IconButton
                icon="arrow-back"
                accessibilityLabel="Geri"
                onPress={() => onNavigateTab?.('kefet')}
              />
              <View style={styles.headerTitle}>
                <Text style={styles.eyebrowPrimary}>ARAMA</Text>
                <Text numberOfLines={1} style={styles.title}>
                  Fırsat karşılaştır
                </Text>
              </View>
              <IconButton
                icon="options-outline"
                accessibilityLabel="Sırala"
                onPress={() =>
                  setComparisonSort((s) => (s === 'price' ? 'discount' : 'price'))
                }
              />
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={21} color={colors.primary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => runSearch(query)}
                returnKeyType="search"
                placeholder="Ürün, marka veya mağaza ara..."
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchText}
              />
              <Pressable
                style={styles.clearButton}
                accessibilityLabel="Aramayı temizle"
                onPress={() => {
                  setQuery('');
                  setResult(null);
                  setAlarmId(null);
                  setError(null);
                }}
              >
                <Ionicons name="close" size={14} color={colors.mutedForeground} />
              </Pressable>
              <View style={styles.searchDivider} />
              <Ionicons name="scan-outline" size={20} color={colors.primary} />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipList}
            >
              {SUGGESTED_CHIPS.map((chip) => (
                <Chip
                  key={chip}
                  active={query.trim().toLowerCase() === chip.toLowerCase()}
                  onPress={() => {
                    setQuery(chip);
                    runSearch(chip);
                  }}
                >
                  {chip}
                </Chip>
              ))}
            </ScrollView>
          </View>

          <View style={styles.content}>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.sectionHeading}>
                <Text style={styles.eyebrowAccent}>CANLI FİYAT TARAMASI</Text>
                <Text style={styles.heroHeading}>
                  {result
                    ? `"${result.query}" için ${result.resultCount} fırsat`
                    : 'Bir ürün aramayla başla'}
                </Text>
              </View>
              <Pressable
                style={styles.sortButton}
                onPress={() =>
                  setComparisonSort((s) => (s === 'price' ? 'discount' : 'price'))
                }
              >
                <Text style={styles.sortText}>
                  {comparisonSort === 'price' ? 'En düşük fiyat' : 'En büyük indirim'}
                </Text>
                <Ionicons name="chevron-down" size={15} color={colors.primary} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            >
              <View style={styles.filterChip}>
                <Ionicons name="options-outline" size={15} color={colors.primary} />
                <Text style={styles.filterText}>Filtrele</Text>
              </View>
              <View style={styles.outlineChip}>
                <Text style={styles.outlineChipText}>Sadece kuponlu</Text>
              </View>
              <View style={styles.outlineChip}>
                <Text style={styles.outlineChipText}>Bugün bitiyor</Text>
              </View>
              <View style={styles.outlineChip}>
                <Text style={styles.outlineChipText}>₺5.000–₺8.000</Text>
              </View>
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
            >
              <View style={[styles.marketChip, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
                <StoreMark letter="t" color={colors.primary} />
                <Text style={[styles.marketText, { color: colors.primary }]}>Trendyol</Text>
              </View>
              <View style={[styles.marketChip, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
                <StoreMark letter="h" color={colors.primary} />
                <Text style={[styles.marketText, { color: colors.primary }]}>Hepsiburada</Text>
              </View>
              <View style={[styles.marketChip, { backgroundColor: withAlpha(colors.foreground, 0.1) }]}>
                <FontAwesome
                  name="amazon"
                  size={16}
                  color={colors.foreground}
                />
                <Text style={styles.marketTextLight}>Amazon</Text>
              </View>
            </ScrollView>

            {loading && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!loading && error && (
              <View style={{ paddingVertical: 24, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: colors.destructive, fontFamily: 'Inter', fontSize: 12 }}>
                  {error}
                </Text>
                <Pressable style={styles.filterChip} onPress={() => runSearch(query)}>
                  <Text style={styles.filterText}>Tekrar dene</Text>
                </Pressable>
              </View>
            )}

            {!loading && !error && !primary && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter', fontSize: 12 }}>
                  {query.trim() ? 'Bu aramayla eşleşen bir fırsat bulunamadı.' : 'Aramak için bir ürün adı yaz.'}
                </Text>
              </View>
            )}

            {!loading && !error && primary && (
              <>
                <View style={styles.productCard}>
                  <View style={styles.productCardHeader}>
                    <View style={styles.productMeta}>
                      <View style={styles.amazonBadge}>
                        {isAmazon ? (
                          <FontAwesome name="amazon" size={15} color={colors.foreground} />
                        ) : (
                          <StoreMark letter={primary.storeLetter} color={colors.primary} />
                        )}
                        <Text style={styles.amazonBadgeText}>{primary.storeLabel}</Text>
                      </View>
                      {primary.verifiedMinutesAgo != null && (
                        <View style={styles.verified}>
                          <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
                          <Text style={styles.verifiedText}>Doğrulandı</Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      style={styles.alarmButton}
                      accessibilityLabel="Alarmlara kaydet"
                      onPress={toggleAlarm}
                    >
                      <Ionicons
                        name={alarmId ? 'notifications' : 'notifications-outline'}
                        size={19}
                        color={colors.primary}
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    style={styles.imagePanel}
                    onPress={() => onOpenDeal?.(primary.id)}
                  >
                    {primary.discountPercent != null && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                          {formatDiscount(primary.discountPercent)} İNDİRİM
                        </Text>
                      </View>
                    )}
                    {primary.imageUrl ? (
                      <Image
                        source={{ uri: primary.imageUrl }}
                        accessibilityLabel={primary.title}
                        resizeMode="contain"
                        style={styles.productImage}
                      />
                    ) : (
                      <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
                    )}
                  </Pressable>

                  <Pressable style={styles.productDetails} onPress={() => onOpenDeal?.(primary.id)}>
                    <Text style={styles.productName}>{primary.title}</Text>
                    <View style={styles.priceRow}>
                      <View>
                        {primary.oldPrice != null && (
                          <Text style={styles.oldPrice}>
                            {formatPrice(primary.oldPrice, primary.currency)}
                          </Text>
                        )}
                        <Text style={styles.currentPrice}>
                          {formatPrice(primary.currentPrice, primary.currency)}
                        </Text>
                      </View>
                      {savings != null && (
                        <View style={styles.savingBadge}>
                          <Ionicons name="trending-down" size={14} color={colors.accent} />
                          <Text style={styles.savingText}>
                            {formatPrice(savings, primary.currency)} tasarruf
                          </Text>
                        </View>
                      )}
                    </View>
                    {primary.isLowest30d && (
                      <View style={styles.lowestPrice}>
                        <Ionicons name="checkmark-circle" size={17} color={colors.accent} />
                        <Text style={styles.lowestPriceText}>Son 30 günün en düşük fiyatı</Text>
                      </View>
                    )}
                  </Pressable>

                  {comparisons.length > 0 && (
                    <View style={styles.comparison}>
                      <View style={styles.comparisonHeader}>
                        <Text style={styles.comparisonLabel}>MAĞAZA KARŞILAŞTIRMASI</Text>
                        <Text style={styles.shippingText}>Kargo hariç</Text>
                      </View>
                      {comparisons.map((deal) => (
                        <ComparisonRow
                          key={deal.id}
                          name={deal.storeLabel}
                          price={formatPrice(deal.currentPrice, deal.currency)}
                          letter={deal.storeLetter}
                          color={colors.primary}
                          onPress={() => onOpenDeal?.(deal.id)}
                        />
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.signalCard}>
                  <View style={styles.signalHeader}>
                    <View>
                      <Text style={styles.eyebrowPrimary}>FİYAT SİNYALİ</Text>
                      <Text style={styles.signalTitle}>Bugünün en iyi fiyatı</Text>
                    </View>
                    {primary.discountPercent != null && (
                      <View style={styles.signalDiscount}>
                        <Text style={styles.signalDiscountText}>
                          {formatDiscount(primary.discountPercent)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {trend ? (
                    <>
                      <Svg height={82} width="100%" viewBox="0 0 340 82" style={styles.chart}>
                        <Line x1="4" y1="18" x2="336" y2="18" stroke={colors.muted} strokeWidth="1" />
                        <Line x1="4" y1="42" x2="336" y2="42" stroke={colors.muted} strokeWidth="1" />
                        <Line x1="4" y1="66" x2="336" y2="66" stroke={colors.muted} strokeWidth="1" />
                        <Path
                          d={trend.path}
                          stroke={colors.chart1}
                          strokeWidth="3"
                          strokeLinecap="round"
                          fill="none"
                        />
                        <Circle
                          cx={trend.last.x}
                          cy={trend.last.y}
                          r="4.5"
                          fill={colors.chart2}
                          stroke={colors.card}
                          strokeWidth="3"
                        />
                      </Svg>

                      <View style={styles.chartLabels}>
                        <Text style={styles.chartLabel}>
                          {primary.priceHistory.length} kayıtlı fiyat noktası
                        </Text>
                        <Text style={[styles.chartLabel, styles.chartHighlight]}>
                          En düşük: {formatPrice(trend.lowestPrice, primary.currency)}
                        </Text>
                        <Text style={styles.chartLabel}>Bugün</Text>
                      </View>
                    </>
                  ) : (
                    <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter', fontSize: 12 }}>
                        Henüz yeterli fiyat geçmişi yok
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.disclaimer}>
                  Fiyatlar mağazalardan düzenli olarak taranır. Stok ve kargo koşulları mağazaya göre değişebilir.
                </Text>
              </>
            )}
          </View>
        </ScrollView>

        {primary && (
          <View style={styles.bottomBar}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => Linking.openURL(primary.storeUrl)}
            >
              <Ionicons name="open-outline" size={19} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>
                {primary.storeLabel}’da en iyi fırsatı aç
              </Text>
              <Ionicons name="arrow-up-outline" size={19} color={colors.primaryForeground} />
            </Pressable>
          </View>
        )}
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
  scrollContent: {
    paddingBottom: 112,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.secondary,
  },
  headerTitle: {
    flex: 1,
  },
  eyebrowPrimary: {
    color: colors.primary,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 2,
    color: colors.foreground,
    fontFamily: 'Space Grotesk',
    fontSize: 18,
    fontWeight: '700',
  },
  searchBox: {
    height: 54,
    marginTop: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: colors.input,
  },
  searchText: {
    flex: 1,
    color: colors.foreground,
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  searchDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  chipList: {
    gap: 8,
    paddingTop: 16,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 20,
  },
  activeChip: {
    backgroundColor: colors.primary,
  },
  secondaryChip: {
    backgroundColor: colors.secondary,
  },
  chipText: {
    color: colors.secondaryForeground,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
  activeChipText: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeading: {
    flex: 1,
  },
  eyebrowAccent: {
    color: colors.accent,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  heroHeading: {
    marginTop: 5,
    color: colors.foreground,
    fontFamily: 'Space Grotesk',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
  },
  sortButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  sortText: {
    color: colors.cardForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
  },
  filterList: {
    gap: 8,
    paddingTop: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  filterText: {
    color: colors.primary,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
  },
  outlineChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  outlineChipText: {
    color: colors.cardForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '500',
  },
  marketChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
  },
  marketText: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
  },
  marketTextLight: {
    color: colors.cardForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
  },
  storeMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  storeMarkText: {
    color: colors.primaryForeground,
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '800',
  },
  productCard: {
    marginTop: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  productCardHeader: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  amazonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 18,
    backgroundColor: colors.secondary,
  },
  amazonBadgeText: {
    color: colors.secondaryForeground,
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    color: colors.accent,
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
  },
  alarmButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.secondary,
  },
  imagePanel: {
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  productImage: {
    width: 224,
    height: 176,
  },
  discountBadge: {
    position: 'absolute',
    zIndex: 1,
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  discountText: {
    color: colors.primaryForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  productDetails: {
    padding: 16,
  },
  productName: {
    color: colors.cardForeground,
    fontFamily: 'Space Grotesk',
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
  },
  priceRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  oldPrice: {
    color: colors.mutedForeground,
    fontFamily: 'Inter',
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  currentPrice: {
    color: colors.accent,
    fontFamily: 'Space Grotesk',
    fontSize: 32,
    fontWeight: '700',
  },
  savingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  savingText: {
    color: colors.accent,
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
  },
  lowestPrice: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  lowestPriceText: {
    color: colors.accent,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
  comparison: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: withAlpha(colors.background, 0.4),
  },
  comparisonHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  comparisonLabel: {
    color: colors.mutedForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  shippingText: {
    color: colors.mutedForeground,
    fontFamily: 'Inter',
    fontSize: 10,
  },
  comparisonRow: {
    minHeight: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    backgroundColor: withAlpha(colors.secondary, 0.6),
  },
  storeName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  comparisonName: {
    color: colors.cardForeground,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '600',
  },
  comparisonPrice: {
    color: colors.cardForeground,
    fontFamily: 'Space Grotesk',
    fontSize: 14,
    fontWeight: '700',
  },
  signalCard: {
    marginTop: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signalTitle: {
    marginTop: 4,
    color: colors.cardForeground,
    fontFamily: 'Space Grotesk',
    fontSize: 16,
    fontWeight: '700',
  },
  signalDiscount: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.accent, 0.1),
  },
  signalDiscountText: {
    color: colors.accent,
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: '700',
  },
  chart: {
    marginTop: 14,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabel: {
    color: colors.mutedForeground,
    fontFamily: 'Inter',
    fontSize: 10,
  },
  chartHighlight: {
    color: colors.accent,
    fontWeight: '600',
  },
  disclaimer: {
    marginTop: 20,
    paddingHorizontal: 4,
    color: colors.mutedForeground,
    fontFamily: 'Inter',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: withAlpha(colors.card, 0.96),
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontFamily: 'Space Grotesk',
    fontSize: 14,
    fontWeight: '700',
  },
});