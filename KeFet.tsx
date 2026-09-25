import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from './theme';
import {
  Deal,
  DealDetail,
  createAlarm,
  deleteAlarm,
  formatCountdown,
  formatDiscount,
  formatPrice,
  getAlarms,
  getDeals,
  getFeaturedDeal,
  getFlashDeal,
  msUntil,
} from './api';
import { AdBanner } from './ads';
import { SortSheet } from './SortSheet';

const FEATURED_SORT_OPTIONS = [
  { value: 'discount', label: 'En büyük indirim' },
  { value: 'price-asc', label: 'Fiyat: düşükten yükseğe' },
  { value: 'price-desc', label: 'Fiyat: yüksekten düşüğe' },
  { value: 'newest', label: 'En yeni eklenenler' },
  { value: 'followers', label: 'En çok takip edilen' },
];

type IconName = React.ComponentProps<typeof Feather>['name'];

const Icon = ({
  name,
  size = 18,
  color = colors.foreground,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <Feather name={name} size={size} color={color} />;

const StoreBadge = ({
  mark,
  label,
  tone = colors.primary,
}: {
  mark: string;
  label: string;
  tone?: string;
}) => (
  <View style={[styles.storeBadge, { backgroundColor: colors.secondary }]}>
    <View style={[styles.storeMark, { backgroundColor: tone }]}>
      <Text style={styles.storeMarkText}>{mark}</Text>
    </View>
    <Text style={styles.storeBadgeText}>{label}</Text>
  </View>
);

const FavoriteButton = ({
  small = false,
  active = false,
  onPress,
}: {
  small?: boolean;
  active?: boolean;
  onPress?: (e: any) => void;
}) => (
  <Pressable
    style={[styles.favorite, small && styles.favoriteSmall]}
    onPress={(e) => {
      e.stopPropagation?.();
      onPress?.(e);
    }}
  >
    <Icon name="heart" size={small ? 14 : 18} color={active ? colors.destructive : colors.foreground} />
  </Pressable>
);

const CompactDeal = ({
  deal,
  following,
  onPress,
  onToggleFollow,
}: {
  deal: Deal;
  following?: boolean;
  onPress?: () => void;
  onToggleFollow?: () => void;
}) => (
  <Pressable style={styles.compactCard} onPress={onPress}>
    <View style={[styles.compactImage, { backgroundColor: colors.muted }]}>
      {deal.discountPercent != null && (
        <Text style={styles.compactDiscount}>{formatDiscount(deal.discountPercent)}</Text>
      )}
      <FavoriteButton small active={following} onPress={onToggleFollow} />
      {deal.imageUrl && (
        <Image source={{ uri: deal.imageUrl }} style={styles.productImage} resizeMode="contain" />
      )}
    </View>
    <View style={styles.compactContent}>
      <View style={[styles.miniStore, { backgroundColor: colors.primary }]}>
        <Text style={styles.miniStoreMark}>{deal.storeLetter}</Text>
        <Text style={styles.miniStoreText}>{deal.storeLabel}</Text>
      </View>
      <Text numberOfLines={2} style={styles.compactTitle}>
        {deal.title}
      </Text>
      {deal.oldPrice != null && (
        <Text style={styles.oldPrice}>{formatPrice(deal.oldPrice, deal.currency)}</Text>
      )}
      <Text style={styles.compactPrice}>{formatPrice(deal.currentPrice, deal.currency)}</Text>
      <Pressable
        style={styles.inspectButton}
        onPress={(e) => {
          e.stopPropagation?.();
          Linking.openURL(deal.storeUrl);
        }}
      >
        <Text style={styles.inspectText}>İncele</Text>
        <Icon name="arrow-up-right" size={14} color={colors.secondaryForeground} />
      </Pressable>
    </View>
  </Pressable>
);

export default function FirsatRadarScreen({
  onOpenDeal,
  onNavigateTab,
  refreshSignal,
}: {
  onOpenDeal?: (id: number) => void;
  onNavigateTab?: (key: string) => void;
  refreshSignal?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalScanned, setTotalScanned] = useState(0);
  const [flashDeal, setFlashDeal] = useState<DealDetail | null>(null);
  const [featuredDeal, setFeaturedDeal] = useState<DealDetail | null>(null);
  const [compactDeals, setCompactDeals] = useState<Deal[]>([]);
  const [foodDeal, setFoodDeal] = useState<Deal | null>(null);
  const [newDeals, setNewDeals] = useState<Deal[]>([]);
  const [msLeft, setMsLeft] = useState(0);
  // productId -> alarmId. Kalp/favori butonlarinin "takip ediliyor mu"
  // durumunu gostermesi ve kapatip acabilmesi icin -- gercek bir "favori"
  // tablosu yok, bu yuzden hedef fiyatsiz bir alarm olarak modelliyoruz.
  const [followingMap, setFollowingMap] = useState<Record<number, number>>({});
  // "Tumu / Trendyol / Amazon / ..." magaza sekmesi -- null ise tum
  // magazalar. Sadece genel getDeals() sorgusuyla beslenen bolumleri
  // (iki sutunlu "Ozel Firsatlar" ve "Az once eklenenler") filtreler;
  // flash/featured/yemek kartlari her zaman genel kalir.
  const [activeStore, setActiveStore] = useState<string | null>(null);
  // "Ozel Firsatlar" bolumunun sirasi -- filtre/sirala ikonuyla degisir
  // (bkz. SortSheet). Backend'in zaten destekledigi sort degerleri.
  const [featuredSort, setFeaturedSort] = useState('discount');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flash, featured, list, food, latest, alarmsRes] = await Promise.all([
        getFlashDeal(),
        getFeaturedDeal(),
        getDeals({ sort: featuredSort, limit: 6, store: activeStore ?? undefined }),
        getDeals({ category: 'yemek', limit: 1 }),
        // "discount" sirasi Telegram'dan yeni gelen urunleri gosterMEZ --
        // yeni urunlerin ilk eklendigi anda old_price/discount'u henuz
        // yoktur (bkz. import_telegram_signals.js), bu yuzden mevcut
        // (ornek/seed) urunlerin gerisinde kalip listeye hic girmezler.
        // Bunu ayri, "en yeni eklenenler" (created_at DESC) sirali bir
        // sorguyla cozuyoruz -- bu sira discount'tan bagimsiz oldugu icin
        // yeni gelen Telegram urunleri her zaman burada gorunur.
        getDeals({ sort: 'newest', limit: 8, store: activeStore ?? undefined }),
        getAlarms(),
      ]);
      setFlashDeal(flash.deal);
      setFeaturedDeal(featured.deal);
      setTotalScanned(list.totalScanned);
      // Ust kartta zaten gosterilen urunu ikili listeden cikar.
      setCompactDeals(
        list.deals.filter((d) => d.id !== featured.deal?.id).slice(0, 2)
      );
      setFoodDeal(food.deals[0] ?? null);
      setNewDeals(latest.deals);
      setMsLeft(msUntil(flash.deal?.flashDealEndsAt));
      const nextFollowing: Record<number, number> = {};
      for (const a of alarmsRes.alarms) {
        if (a.active) nextFollowing[a.productId] = a.id;
      }
      setFollowingMap(nextFollowing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fırsatlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [activeStore, featuredSort]);

  const toggleFollow = useCallback(
    async (productId: number) => {
      const existingAlarmId = followingMap[productId];
      try {
        if (existingAlarmId) {
          await deleteAlarm(existingAlarmId);
          setFollowingMap((prev) => {
            const next = { ...prev };
            delete next[productId];
            return next;
          });
        } else {
          const { alarm } = await createAlarm({ productId });
          setFollowingMap((prev) => ({ ...prev, [productId]: alarm.id }));
        }
      } catch {
        // Sessizce yut -- bir sonraki load()'da zaten yeniden senkronize olur.
      }
    },
    [followingMap]
  );

  useEffect(() => {
    load();
    // refreshSignal: App.tsx'ten periyodik gelen "arka planda yenile"
    // sinyali -- ekrani yeniden mount etmeden veriyi tazeler, activeStore
    // gibi ekran ici state korunur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshSignal]);

  // Sureli firsat sayaci: her saniye geri sayimi guncelle.
  useEffect(() => {
    if (!flashDeal?.flashDealEndsAt) return;
    const interval = setInterval(() => {
      setMsLeft(msUntil(flashDeal.flashDealEndsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [flashDeal?.flashDealEndsAt]);

  const countdown = formatCountdown(msLeft);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <View style={styles.logo}>
                  <Icon name="radio" size={18} color={colors.primaryForeground} />
                </View>
                <Text style={styles.brand}>
                  Fırsat<Text style={styles.brandAccent}>Radar</Text>
                </Text>
              </View>
            </View>

            <View style={styles.searchRow}>
              <Pressable style={styles.searchBox} onPress={() => onNavigateTab?.('arama')}>
                <Icon name="search" size={20} />
                <Text numberOfLines={1} style={styles.searchPlaceholder}>
                  Ürün, marka veya mağaza ara...
                </Text>
                <Icon name="maximize" size={18} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.filterButton} onPress={() => setSortSheetOpen(true)}>
                <Icon name="sliders" size={20} color={colors.secondaryForeground} />
              </Pressable>
            </View>

            <View style={styles.categoryRow}>
              <Pressable style={styles.categoryButton} onPress={() => onNavigateTab?.('kategoriler')}>
                <Icon name="grid" size={15} color={colors.primary} />
                <Text style={styles.categoryText}>Tüm Kategoriler</Text>
                <Icon name="chevron-down" size={14} color={colors.secondaryForeground} />
              </Pressable>
              <Text style={styles.scanText}>
                {totalScanned.toLocaleString('tr-TR')} fırsat taranıyor
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketTabs}
          >
            <Pressable onPress={() => setActiveStore(null)}>
              <Text style={[styles.activeMarket, activeStore != null && styles.inactiveMarket]}>
                Tümü
              </Text>
            </Pressable>
            <MarketTab
              mark="t"
              label="Trendyol"
              color={colors.primary}
              active={activeStore === 'trendyol'}
              onPress={() => setActiveStore('trendyol')}
            />
            <MarketTab
              mark="h"
              label="Hepsiburada"
              color={colors.primary}
              active={activeStore === 'hepsiburada'}
              onPress={() => setActiveStore('hepsiburada')}
            />
            <MarketTab
              mark="a"
              label="Amazon"
              color={colors.foreground}
              active={activeStore === 'amazon'}
              onPress={() => setActiveStore('amazon')}
            />
            <MarketTab
              mark="y"
              label="Trendyol Yemek"
              color={colors.primary}
              active={activeStore === 'trendyol-yemek'}
              onPress={() => setActiveStore('trendyol-yemek')}
            />
            <MarketTab
              mark="n"
              label="N11"
              color={colors.chart4}
              active={activeStore === 'n11'}
              onPress={() => setActiveStore('n11')}
            />
          </ScrollView>

          <View style={styles.main}>
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
                <Pressable style={styles.goButton} onPress={load}>
                  <Text style={styles.goButtonText}>Tekrar dene</Text>
                </Pressable>
              </View>
            )}

            {!loading && !error && (
              <>
                {flashDeal && (
                  <LinearGradient
                    colors={[colors.primary, colors.primary, colors.destructive]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.flashCard}
                  >
                    <View style={styles.flashCircle} />
                    <View style={styles.flashInfo}>
                      <View style={styles.flashTitleRow}>
                        <View style={styles.flashIcon}>
                          <Icon name="zap" size={18} color={colors.foreground} />
                        </View>
                        <Text style={styles.flashTitle}>Süreli Fırsatlar</Text>
                      </View>
                      <Text style={styles.flashSubtitle}>Bugünün en hızlı düşen fiyatları</Text>
                    </View>
                    <View style={styles.timer}>
                      <TimerUnit value={countdown.hh} />
                      <Text style={styles.timerSeparator}>:</Text>
                      <TimerUnit value={countdown.mm} />
                      <Text style={styles.timerSeparator}>:</Text>
                      <TimerUnit value={countdown.ss} />
                    </View>
                  </LinearGradient>
                )}

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.eyebrow}>CANLI TARAMA</Text>
                    <Text style={styles.sectionTitle}>Öne çıkan fırsatlar</Text>
                  </View>
                  <Pressable style={styles.seeAll} onPress={() => onNavigateTab?.('kategoriler')}>
                    <Text style={styles.seeAllText}>Tümünü gör</Text>
                    <Icon name="arrow-up-right" size={14} color={colors.accent} />
                  </Pressable>
                </View>

                {featuredDeal && (
                  <Pressable
                    style={styles.featuredCard}
                    onPress={() => onOpenDeal?.(featuredDeal.id)}
                  >
                    {featuredDeal.discountPercent != null && (
                      <Text style={styles.featuredDiscount}>
                        {formatDiscount(featuredDeal.discountPercent)} İNDİRİM
                      </Text>
                    )}
                    <FavoriteButton
                      active={!!followingMap[featuredDeal.id]}
                      onPress={() => toggleFollow(featuredDeal.id)}
                    />
                    <View style={styles.featuredImageWrap}>
                      {featuredDeal.imageUrl && (
                        <Image
                          source={{ uri: featuredDeal.imageUrl }}
                          style={styles.featuredImage}
                          resizeMode="contain"
                        />
                      )}
                    </View>
                    <View style={styles.featuredContent}>
                      <View style={styles.metaRow}>
                        <StoreBadge
                          mark={featuredDeal.storeLetter}
                          label={`${featuredDeal.storeLabel}'da Fırsat`}
                          tone={colors.foreground}
                        />
                        {featuredDeal.isLowest30d && (
                          <View style={styles.trend}>
                            <Icon name="trending-down" size={14} color={colors.accent} />
                            <Text style={styles.trendText}>Son 30 günün dibi</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.featuredTitle}>{featuredDeal.title}</Text>
                      <View style={styles.priceRow}>
                        <View>
                          {featuredDeal.oldPrice != null && (
                            <Text style={styles.oldPrice}>
                              {formatPrice(featuredDeal.oldPrice, featuredDeal.currency)}
                            </Text>
                          )}
                          <Text style={styles.featuredPrice}>
                            {formatPrice(featuredDeal.currentPrice, featuredDeal.currency)}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.goButton}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            Linking.openURL(featuredDeal.storeUrl);
                          }}
                        >
                          <Text style={styles.goButtonText}>Mağazaya Git</Text>
                          <Icon name="arrow-up-right" size={16} color={colors.primaryForeground} />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                )}

                <View style={styles.twoColumn}>
                  {compactDeals.map((deal) => (
                    <CompactDeal
                      key={deal.id}
                      deal={deal}
                      following={!!followingMap[deal.id]}
                      onPress={() => onOpenDeal?.(deal.id)}
                      onToggleFollow={() => toggleFollow(deal.id)}
                    />
                  ))}
                </View>

                {/* Urunler arasi banner reklam -- "Ozel Firsatlar" ile
                    "Az once eklenenler" bolumleri arasinda, tam genislikte. */}
                <AdBanner style={{ marginVertical: 16 }} />

                {newDeals.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.eyebrow}>YENİ • CANLI</Text>
                        <Text style={styles.sectionTitle}>Az önce eklenenler</Text>
                      </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
                    >
                      {newDeals.map((deal) => (
                        <View key={deal.id} style={{ width: 150 }}>
                          <CompactDeal
                            deal={deal}
                            following={!!followingMap[deal.id]}
                            onPress={() => onOpenDeal?.(deal.id)}
                            onToggleFollow={() => toggleFollow(deal.id)}
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </>
                )}

                {foodDeal && (
                  <Pressable style={styles.foodCard} onPress={() => onOpenDeal?.(foodDeal.id)}>
                    <View style={styles.coffeeIcon}>
                      <Icon name="coffee" size={34} color={colors.primary} />
                    </View>
                    <View style={styles.foodInfo}>
                      <View style={styles.foodTop}>
                        <View style={styles.miniStore}>
                          <Text style={styles.miniStoreText}>{foodDeal.storeLabel}</Text>
                        </View>
                        {foodDeal.discountPercent != null && (
                          <Text style={styles.foodDiscount}>
                            {formatDiscount(foodDeal.discountPercent)}
                          </Text>
                        )}
                      </View>
                      <Text numberOfLines={1} style={styles.foodTitle}>
                        {foodDeal.title}
                      </Text>
                      <View style={styles.foodPriceRow}>
                        {foodDeal.oldPrice != null && (
                          <Text style={styles.oldPrice}>
                            {formatPrice(foodDeal.oldPrice, foodDeal.currency)}
                          </Text>
                        )}
                        <Text style={styles.foodPrice}>
                          {formatPrice(foodDeal.currentPrice, foodDeal.currency)}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.foodAction}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        Linking.openURL(foodDeal.storeUrl);
                      }}
                    >
                      <Icon name="arrow-up-right" size={18} color={colors.primary} />
                    </Pressable>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <BottomTab icon="compass" label="Keşfet" active onPress={() => onNavigateTab?.('kefet')} />
          <BottomTab icon="hexagon" label="Kategoriler" onPress={() => onNavigateTab?.('kategoriler')} />
          <BottomTab icon="bell" label="Alarmlar" onPress={() => onNavigateTab?.('alarmlar')} />
          <BottomTab icon="user" label="Profil" onPress={() => onNavigateTab?.('profil')} />
        </View>
      </View>
      <SortSheet
        visible={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        options={FEATURED_SORT_OPTIONS}
        selected={featuredSort}
        onSelect={setFeaturedSort}
        title="Özel Fırsatları sırala"
      />
    </SafeAreaView>
  );
}

function MarketTab({
  mark,
  label,
  color,
  active,
  onPress,
}: {
  mark: string;
  label: string;
  color: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.marketTab, active && styles.marketTabActive]} onPress={onPress}>
      <View style={[styles.marketMark, { backgroundColor: color }]}>
        <Text style={styles.marketMarkText}>{mark}</Text>
      </View>
      <Text style={[styles.marketLabel, active && styles.marketLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function TimerUnit({ value }: { value: string }) {
  return (
    <View style={styles.timerUnit}>
      <Text style={styles.timerValue}>{value}</Text>
    </View>
  );
}

function BottomTab({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.bottomTab} onPress={onPress}>
      <View style={[styles.bottomIcon, active && styles.bottomIconActive]}>
        <Icon name={icon} size={20} color={active ? colors.primary : colors.mutedForeground} />
      </View>
      <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text>
    </Pressable>
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
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  brand: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  brandAccent: {
    color: colors.primary,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  locationText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  searchBox: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.input,
  },
  searchPlaceholder: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  filterButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.secondary,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: colors.secondary,
  },
  categoryText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  scanText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  marketTabs: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeMarket: {
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  inactiveMarket: {
    borderBottomColor: 'transparent',
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  marketTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  marketTabActive: {
    borderBottomColor: colors.primary,
  },
  marketLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  marketMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  marketMarkText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  marketLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  main: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  flashCard: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    overflow: 'hidden',
    padding: 16,
    borderRadius: 16,
  },
  flashCircle: {
    position: 'absolute',
    right: -28,
    top: -32,
    width: 112,
    height: 112,
    borderWidth: 18,
    borderColor: colors.foreground,
    borderRadius: 56,
    opacity: 0.12,
  },
  flashInfo: {
    flex: 1,
  },
  flashTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flashIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.background,
    opacity: 0.85,
  },
  flashTitle: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },
  flashSubtitle: {
    marginTop: 8,
    color: colors.foreground,
    opacity: 0.8,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  timerUnit: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  timerValue: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '800',
  },
  timerSeparator: {
    paddingTop: 6,
    color: colors.foreground,
    opacity: 0.8,
    fontFamily: fonts.body,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 23,
    fontWeight: '700',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  featuredCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  featuredDiscount: {
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 2,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  favorite: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  favoriteSmall: {
    left: undefined,
    right: 8,
    top: 8,
    width: 28,
    height: 28,
  },
  featuredImageWrap: {
    height: 208,
    backgroundColor: colors.muted,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    padding: 12,
  },
  featuredContent: {
    padding: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 18,
  },
  storeMark: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  storeMarkText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 8,
    fontWeight: '800',
  },
  storeBadgeText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  trendText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
  },
  featuredTitle: {
    marginTop: 10,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  oldPrice: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  featuredPrice: {
    color: colors.accent,
    fontFamily: fonts.heading,
    fontSize: 29,
    fontWeight: '800',
  },
  goButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  goButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  compactCard: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  compactImage: {
    height: 140,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    padding: 8,
  },
  compactDiscount: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
  compactContent: {
    padding: 12,
  },
  miniStore: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: colors.secondary,
  },
  miniStoreMark: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
  miniStoreText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '700',
  },
  compactTitle: {
    minHeight: 38,
    marginTop: 8,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  compactPrice: {
    color: colors.accent,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '800',
  },
  inspectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: colors.secondary,
  },
  inspectText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  coffeeIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  foodInfo: {
    flex: 1,
  },
  foodTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  foodDiscount: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  foodTitle: {
    marginTop: 5,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  foodPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  foodPrice: {
    color: colors.accent,
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '800',
  },
  foodAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.secondary,
  },
  bottomBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bottomIcon: {
    width: 44,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIconActive: {
    borderRadius: 18,
    backgroundColor: colors.secondary,
  },
  bottomLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '500',
  },
  bottomLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
});