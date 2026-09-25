import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { colors, fonts } from './theme';
import {
  Alarm,
  DealDetail,
  createAlarm,
  deleteAlarm,
  formatDiscount,
  formatPrice,
  getAlarms,
  getDealDetail,
} from './api';

const STOCK_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'Stokta var', color: colors.accent },
  limited: { label: 'Sınırlı', color: colors.destructive },
  out_of_stock: { label: 'Tükendi', color: colors.mutedForeground },
};

const MONTHS_TR = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

function formatShortDateTR(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]}`;
}

const rgba = (hex: string, alpha: number) => {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

function IconButton({
  icon,
  color = colors.cardForeground,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconButton} accessibilityRole="button">
      <Ionicons name={icon} size={21} color={color} />
    </Pressable>
  );
}

function StatCard({
  icon,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={19} color={colors.accent} />
      <Text style={styles.statText}>{children}</Text>
    </View>
  );
}

const CHART_LEFT = 22;
const CHART_RIGHT = 330;
const CHART_TOP = 22;
const CHART_BOTTOM = 132;
const CHART_FILL_BASE = 138;

function PriceChart({ history }: { history: { price: number; checkedAt: string }[] }) {
  const points = useMemo(() => {
    if (history.length === 0) return [];
    const prices = history.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min || 1;
    const stepX =
      history.length > 1 ? (CHART_RIGHT - CHART_LEFT) / (history.length - 1) : 0;
    return history.map((h, i) => ({
      x: CHART_LEFT + i * stepX,
      y: CHART_TOP + ((max - h.price) / span) * (CHART_BOTTOM - CHART_TOP),
      price: h.price,
      checkedAt: h.checkedAt,
    }));
  }, [history]);

  if (points.length < 2) {
    return (
      <View style={{ height: 170, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}>
          Henüz yeterli fiyat geçmişi yok
        </Text>
      </View>
    );
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x} ${CHART_FILL_BASE} L${points[0].x} ${CHART_FILL_BASE} Z`;

  // En dusuk fiyatin gorulduğu nokta (kesikli cizgi + fiyat etiketi burada).
  const lowestIndex = points.reduce(
    (best, p, i) => (p.price < points[best].price ? i : best),
    0
  );
  const lowest = points[lowestIndex];
  const last = points[points.length - 1];
  const labelX = Math.min(Math.max(lowest.x, CHART_LEFT + 30), CHART_RIGHT - 30);

  return (
    <Svg width="100%" height={170} viewBox="0 0 340 150">
      {[22, 58, 94, 130].map((y) => (
        <Line key={y} x1="22" y1={y} x2="330" y2={y} stroke={colors.muted} strokeWidth="1" />
      ))}
      <Path d={areaPath} fill={rgba(colors.chart1, 0.1)} />
      <Path
        d={linePath}
        fill="none"
        stroke={colors.chart1}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={lowest.x}
        y1={CHART_TOP - 4}
        x2={lowest.x}
        y2={CHART_BOTTOM}
        stroke={colors.chart2}
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <Circle cx={lowest.x} cy={lowest.y} r="5" fill={colors.chart2} stroke={colors.card} strokeWidth="3" />
      <Rect x={labelX - 30} y={CHART_TOP + 20} width="61" height="27" rx="8" fill={colors.background} />
      <SvgText
        x={labelX}
        y={CHART_TOP + 37}
        fill={colors.foreground}
        fontSize="10"
        fontFamily={fonts.body}
        textAnchor="middle"
      >
        {formatPrice(lowest.price)}
      </SvgText>
      <Circle cx={last.x} cy={last.y} r="5" fill={colors.chart2} stroke={colors.card} strokeWidth="3" />
      <SvgText x={points[0].x} y="148" fill={colors.mutedForeground} fontSize="10" fontFamily={fonts.body}>
        {formatShortDateTR(points[0].checkedAt)}
      </SvgText>
      <SvgText
        x={last.x}
        y="148"
        fill={colors.mutedForeground}
        fontSize="10"
        fontFamily={fonts.body}
        textAnchor="end"
      >
        {formatShortDateTR(last.checkedAt)}
      </SvgText>
    </Svg>
  );
}

// dealId ve onBack App.tsx'teki basit navigasyon katmanindan geliyor:
// herhangi bir ekranda bir urun kartina dokunuldugunda App.tsx bu ekrani
// o urunun id'siyle acar (bkz. App.tsx -- openDeal). onBack, geri okuna
// basildiginda hangi ekrandan gelindiyse oraya donmeyi saglar.
export default function DealDetailScreen({
  dealId,
  onBack,
}: {
  dealId: number;
  onBack?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [alarmId, setAlarmId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ deal: d }, { alarms }] = await Promise.all([
        getDealDetail(dealId),
        getAlarms(),
      ]);
      setDeal(d);
      const existing = (alarms as Alarm[]).find((a) => a.productId === dealId);
      setAlarmId(existing ? existing.id : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ürün yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleAlarm = useCallback(async () => {
    if (!deal) return;
    try {
      if (alarmId) {
        await deleteAlarm(alarmId);
        setAlarmId(null);
      } else {
        const { alarm } = await createAlarm({ productId: deal.id });
        setAlarmId(alarm.id);
      }
    } catch {
      // Sessizce yut -- kullaniciyi bloklamaya gerek yok, bir sonraki
      // acilista alarm durumu zaten yeniden senkronize olur.
    }
  }, [deal, alarmId]);

  const copyCoupon = useCallback(async () => {
    if (!deal?.couponCode) return;
    await Clipboard.setStringAsync(deal.couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [deal?.couponCode]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !deal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
          <Text style={{ color: colors.destructive, fontFamily: fonts.body, fontSize: 13 }}>
            {error || 'Ürün bulunamadı'}
          </Text>
          <Pressable style={styles.cta} onPress={load}>
            <Text style={styles.ctaTitle}>Tekrar dene</Text>
          </Pressable>
          {onBack && (
            <Pressable onPress={onBack}>
              <Text style={{ color: colors.mutedForeground, fontFamily: fonts.body, fontSize: 13 }}>
                Geri dön
              </Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const stock = STOCK_LABELS[deal.stockStatus] || STOCK_LABELS.in_stock;
  const flashActive = deal.isFlashDeal && deal.flashDealEndsAt;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <IconButton icon="arrow-back" onPress={onBack} />
          <View style={styles.headerActions}>
            <IconButton
              icon="share-social-outline"
              color={colors.mutedForeground}
              onPress={() =>
                Share.share({
                  message: `${deal.title} — ${formatPrice(deal.currentPrice, deal.currency)} (${deal.storeLabel})\n${deal.storeUrl}`,
                }).catch(() => {})
              }
            />
            <IconButton
              icon={alarmId ? 'bookmark' : 'bookmark-outline'}
              color={colors.primary}
              onPress={toggleAlarm}
            />
          </View>
        </View>

        <View style={styles.gallerySection}>
          <View style={styles.galleryMeta}>
            <View style={styles.marketBadge}>
              <View style={styles.amazonLetter}>
                <Text style={styles.amazonLetterText}>{deal.storeLetter}</Text>
              </View>
              <Text style={styles.marketBadgeText}>{deal.storeLabel}'da Fırsat</Text>
            </View>
          </View>

          <View style={styles.gallery}>
            <View style={[styles.imageCard, { backgroundColor: colors.secondary, width: '100%' }]}>
              {deal.imageUrl && (
                <Image
                  source={{ uri: deal.imageUrl }}
                  accessibilityLabel={deal.title}
                  resizeMode="contain"
                  style={styles.productImage}
                />
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.titleRow}>
            <View style={styles.titleContent}>
              {deal.brand && <Text style={styles.brand}>{deal.brand.toUpperCase()}</Text>}
              <Text style={styles.title}>{deal.title}</Text>
              <Text style={styles.mutedText}>{deal.storeLabel}'da satılıyor</Text>
            </View>
            <IconButton
              icon={alarmId ? 'bookmark' : 'bookmark-outline'}
              color={colors.primary}
              onPress={toggleAlarm}
            />
          </View>

          <View style={styles.priceRow}>
            <View>
              {deal.oldPrice != null && (
                <Text style={styles.oldPrice}>{formatPrice(deal.oldPrice, deal.currency)}</Text>
              )}
              <Text style={styles.price}>{formatPrice(deal.currentPrice, deal.currency)}</Text>
            </View>
            {deal.discountPercent != null && (
              <View style={styles.discount}>
                <Text style={styles.discountText}>{formatDiscount(deal.discountPercent)}</Text>
              </View>
            )}
          </View>

          <View style={styles.stats}>
            <StatCard icon="trending-down">
              {deal.isLowest30d ? 'Son 30 günün en düşük fiyatı' : 'Fiyat son 30 günde dalgalandı'}
            </StatCard>
            <StatCard icon="checkmark-circle-outline">
              {deal.verifiedMinutesAgo != null
                ? `Fırsat doğrulandı ${deal.verifiedMinutesAgo} dk önce`
                : 'Doğrulama bekleniyor'}
            </StatCard>
            <StatCard icon="people-outline">
              {`${deal.followCount.toLocaleString('tr-TR')} kişi takip ediyor`}
            </StatCard>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.eyebrow}>FİYAT KANITI</Text>
                <Text style={styles.panelTitle}>Fiyat Geçmişi</Text>
              </View>
              {deal.isLowest30d && (
                <View style={styles.lowestBadge}>
                  <Text style={styles.lowestText}>EN DÜŞÜK</Text>
                </View>
              )}
            </View>

            <View style={styles.chartLabels}>
              {deal.oldPrice != null && (
                <Text style={styles.chartLabel}>{formatPrice(deal.oldPrice, deal.currency)}</Text>
              )}
              <Text style={styles.chartLabel}>{formatPrice(deal.currentPrice, deal.currency)}</Text>
            </View>
            <PriceChart history={deal.priceHistory} />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={styles.legendText}>{deal.storeLabel} fiyatı</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={styles.legendText}>En düşük nokta işaretli</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Fırsat Detayları</Text>
            <Ionicons name="information-circle-outline" size={20} color={colors.mutedForeground} />
          </View>
          <View style={styles.detailsPanel}>
            {flashActive && (
              <DetailRow
                icon="timer-outline"
                iconColor={colors.primary}
                label="Süreli fırsat bitiş"
                value={new Date(deal.flashDealEndsAt as string).toLocaleString('tr-TR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                valueColor={colors.primary}
              />
            )}
            <DetailRow
              icon="cube-outline"
              iconColor={stock.color}
              label="Stok durumu"
              value={stock.label}
              valueColor={stock.color}
            />
            <DetailRow
              icon="car-outline"
              iconColor={colors.accent}
              label="Mağaza"
              value={deal.storeLabel}
              valueColor={colors.accent}
            />
          </View>
        </View>

        {deal.couponCode && (
          <View style={styles.section}>
            <View style={styles.coupon}>
              <View style={styles.couponHeader}>
                <View>
                  <Text style={styles.eyebrow}>EKSTRA TASARRUF</Text>
                  <Text style={styles.panelTitle}>Kuponu kullan</Text>
                  <Text style={styles.couponHint}>{deal.storeLabel} ödeme adımında geçerlidir.</Text>
                </View>
                <Ionicons name="ticket-outline" size={28} color={colors.primary} />
              </View>
              <View style={styles.couponCode}>
                <Text style={styles.code}>{deal.couponCode}</Text>
                <Pressable style={styles.copyButton} onPress={copyCoupon}>
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={15}
                    color={colors.primaryForeground}
                  />
                  <Text style={styles.copyText}>{copied ? 'Kopyalandı' : 'Kopyala'}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Pressable style={styles.alertCard} onPress={toggleAlarm}>
            <View style={styles.alertIcon}>
              <Ionicons name="notifications-outline" size={23} color={colors.primary} />
            </View>
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>Fiyat düşünce haber ver</Text>
              <Text style={styles.mutedText}>
                {alarmId ? 'Alarmlar\'da takip ediliyor' : 'Bu ürünü Alarmlar\'a ekle'}
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                !alarmId && { backgroundColor: colors.secondary, alignItems: 'flex-start' },
              ]}
            >
              <View
                style={[styles.toggleKnob, !alarmId && { backgroundColor: colors.mutedForeground }]}
              />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.cta} onPress={() => Linking.openURL(deal.storeUrl)}>
          <View style={styles.ctaIcon}>
            {deal.store === 'amazon' ? (
              <FontAwesome name="amazon" size={20} color={colors.primaryForeground} />
            ) : (
              <Ionicons name="cart-outline" size={20} color={colors.primaryForeground} />
            )}
          </View>
          <View style={styles.ctaCopy}>
            <Text style={styles.ctaTitle}>{deal.storeLabel}'da Ürünü İncele</Text>
            <Text style={styles.ctaSubtitle}>Doğrulanmış fırsata git</Text>
          </View>
          <View style={styles.ctaPrice}>
            <Text style={styles.ctaPriceText}>{formatPrice(deal.currentPrice, deal.currency)}</Text>
            <View style={styles.openRow}>
              <Ionicons name="open-outline" size={12} color={colors.primaryForeground} />
              <Text style={styles.openText}>Aç</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  iconColor,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <View style={[styles.detailIcon, { backgroundColor: rgba(iconColor, 0.1) }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 12,
    paddingBottom: 125,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gallerySection: {
    marginTop: 20,
  },
  galleryMeta: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  amazonLetter: {
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: colors.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amazonLetterText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '800',
  },
  marketBadgeText: {
    color: colors.secondaryForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  counter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  counterText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.body,
  },
  gallery: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 16,
    paddingBottom: 8,
  },
  imageCard: {
    width: 350,
    height: 288,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageLabel: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: rgba(colors.background, 0.72),
  },
  imageLabelText: {
    color: colors.mutedForeground,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  productImage: {
    width: '100%',
    height: 260,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 20,
    backgroundColor: colors.primary,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleContent: {
    flex: 1,
  },
  brand: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 25,
    lineHeight: 29,
    fontWeight: '700',
  },
  mutedText: {
    marginTop: 8,
    color: colors.mutedForeground,
    fontSize: 14,
  },
  priceRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  oldPrice: {
    color: colors.mutedForeground,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  price: {
    marginTop: 2,
    color: colors.primary,
    fontFamily: fonts.heading,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
  },
  discount: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  discountText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '800',
  },
  stats: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 112,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statText: {
    marginTop: 10,
    color: colors.cardForeground,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  panel: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  panelTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  lowestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: rgba(colors.accent, 0.1),
  },
  lowestText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  chartLabels: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartLabel: {
    color: colors.mutedForeground,
    fontSize: 10,
  },
  legend: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: colors.mutedForeground,
    fontSize: 11,
  },
  sectionHeading: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 21,
    fontWeight: '700',
  },
  detailsPanel: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  detailRow: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabelText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  coupon: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: rgba(colors.primary, 0.4),
    backgroundColor: colors.card,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  couponHint: {
    marginTop: 5,
    color: colors.mutedForeground,
    fontSize: 12,
  },
  couponCode: {
    marginTop: 16,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: rgba(colors.primary, 0.5),
    backgroundColor: rgba(colors.background, 0.6),
    flexDirection: 'row',
    alignItems: 'center',
  },
  code: {
    flex: 1,
    paddingHorizontal: 8,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: '800',
  },
  alertCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCopy: {
    flex: 1,
  },
  alertTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  toggle: {
    width: 48,
    height: 28,
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    marginLeft: 20,
    borderRadius: 10,
    backgroundColor: colors.accentForeground,
  },
  note: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  noteCopy: {
    flex: 1,
  },
  noteText: {
    marginTop: 6,
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  detailImage: {
    width: '100%',
    height: 192,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
    backgroundColor: rgba(colors.card, 0.96),
  },
  cta: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: rgba(colors.primaryForeground, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaCopy: {
    flex: 1,
  },
  ctaTitle: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '800',
  },
  ctaSubtitle: {
    marginTop: 3,
    color: rgba(colors.primaryForeground, 0.75),
    fontSize: 11,
    fontWeight: '500',
  },
  ctaPrice: {
    alignItems: 'flex-end',
  },
  ctaPriceText: {
    color: colors.primaryForeground,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '800',
  },
  openRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  openText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
  },
});