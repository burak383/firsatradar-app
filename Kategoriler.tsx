import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import theme from './theme';
import {
  type Category,
  type Deal,
  createAlarm,
  deleteAlarm,
  formatDiscount,
  formatPrice,
  getAlarms,
  getCategories,
  getDeals,
} from './api';
import { SortSheet } from './SortSheet';

const colors = theme.colors;
const fonts = theme.fonts;

const FEATURED_SORT_OPTIONS = [
  { value: 'discount', label: 'En büyük indirim' },
  { value: 'price-asc', label: 'Fiyat: düşükten yükseğe' },
  { value: 'price-desc', label: 'Fiyat: yüksekten düşüğe' },
  { value: 'newest', label: 'En yeni eklenenler' },
  { value: 'followers', label: 'En çok takip edilen' },
];

const opacityColor = (hex: string, opacity: number) => {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

// Backend, kategori basina renk gondermiyor (bkz. backend/routes/categories.js) --
// slug'a gore sabit bir renk paleti kullaniyoruz, boylece kategoriler her
// yenilemede ayni renkte kalir.
const TILE_PALETTE: { background: string; foreground: string }[] = [
  { background: opacityColor(colors.destructive, 0.15), foreground: colors.destructive },
  { background: opacityColor(colors.accent, 0.15), foreground: colors.accent },
  { background: opacityColor(colors.chart4, 0.15), foreground: colors.chart4 },
  { background: opacityColor(colors.chart3, 0.15), foreground: colors.chart3 },
  { background: opacityColor(colors.chart5, 0.15), foreground: colors.chart5 },
  { background: opacityColor(colors.primary, 0.15), foreground: colors.primary },
];

const paletteFor = (index: number) => TILE_PALETTE[index % TILE_PALETTE.length];

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

const SectionHeading = ({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) => (
  <View style={styles.sectionHeading}>
    <View style={styles.headingCopy}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action}
  </View>
);

const CategoryIcon = ({
  icon,
  background,
  foreground,
}: {
  icon: IconName;
  background: string;
  foreground: string;
}) => (
  <View style={[styles.categoryIcon, { backgroundColor: background }]}>
    <Icon name={icon} size={19} color={foreground} />
  </View>
);

const CategoryTile = ({
  title,
  count,
  icon,
  background,
  foreground,
  onPress,
}: {
  title: string;
  count: string;
  icon: IconName;
  background: string;
  foreground: string;
  onPress?: () => void;
}) => (
  <Pressable style={styles.categoryTile} onPress={onPress}>
    <CategoryIcon icon={icon} background={background} foreground={foreground} />
    <View>
      <View style={styles.tileTitleRow}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Icon name="arrow-up-right" size={16} color={colors.primary} />
      </View>
      <Text style={styles.mutedText}>{count} fırsat</Text>
    </View>
  </Pressable>
);

const ProductCard = ({
  image,
  title,
  merchant,
  oldPrice,
  price,
  discount,
  imageBackground,
  following,
  onPress,
  onToggleFollow,
}: {
  image: string | null;
  title: string;
  merchant: string;
  oldPrice: string;
  price: string;
  discount: string;
  imageBackground: string;
  following?: boolean;
  onPress?: () => void;
  onToggleFollow?: () => void;
}) => (
  <Pressable style={styles.productCard} onPress={onPress}>
    <View style={[styles.productImageArea, { backgroundColor: imageBackground }]}>
      {discount ? <Text style={styles.discount}>{discount}</Text> : null}
      <Pressable
        style={styles.favoriteButton}
        onPress={(e) => {
          e.stopPropagation?.();
          onToggleFollow?.();
        }}
      >
        <Icon name="heart" size={15} color={following ? colors.destructive : colors.foreground} />
      </Pressable>
      {image ? (
        <Image source={{ uri: image }} style={styles.productImage} resizeMode="contain" />
      ) : (
        <Icon name="image" size={26} color={colors.mutedForeground} />
      )}
    </View>
    <View style={styles.productDetails}>
      <View style={styles.merchantBadge}>
        <Icon name="shopping-bag" size={10} color={colors.secondaryForeground} />
        <Text style={styles.merchantText}>{merchant}</Text>
      </View>
      <Text style={styles.productTitle} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.oldPrice}>{oldPrice}</Text>
      <Text style={styles.price}>{price}</Text>
    </View>
  </Pressable>
);

const FollowedProduct = ({
  rank,
  title,
  followers,
  image,
  imageBackground,
  first,
  following,
  onPress,
  onToggleFollow,
}: {
  rank: string;
  title: string;
  followers: string;
  image: string | null;
  imageBackground: string;
  first?: boolean;
  following?: boolean;
  onPress?: () => void;
  onToggleFollow?: () => void;
}) => (
  <Pressable
    style={[styles.followedRow, !first && styles.followedRowBorder]}
    onPress={onPress}
  >
    <View
      style={[
        styles.rank,
        { backgroundColor: first ? colors.primary : colors.secondary },
      ]}
    >
      <Text
        style={[
          styles.rankText,
          { color: first ? colors.primaryForeground : colors.secondaryForeground },
        ]}
      >
        {rank}
      </Text>
    </View>
    <View style={[styles.followedImageWrap, { backgroundColor: imageBackground }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.followedImage} resizeMode="contain" />
      ) : (
        <Icon name="image" size={18} color={colors.mutedForeground} />
      )}
    </View>
    <View style={styles.followedCopy}>
      <Text style={styles.followedTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.followersLine}>
        <Icon name="users" size={14} color={colors.accent} />
        <Text style={styles.followersText}>{followers} kişi takip ediyor</Text>
      </View>
    </View>
    <Pressable
      style={styles.alertButton}
      onPress={(e) => {
        e.stopPropagation?.();
        onToggleFollow?.();
      }}
    >
      <Icon name="bell" size={16} color={following ? colors.primary : colors.accent} />
    </Pressable>
  </Pressable>
);

const BottomTab = ({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconName;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable style={styles.bottomTab} onPress={onPress}>
    <View style={[styles.tabIcon, active && styles.activeTabIcon]}>
      <Icon name={icon} size={20} color={active ? colors.primary : colors.mutedForeground} />
    </View>
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
  </Pressable>
);

export default function CategoriesScreen({
  onOpenDeal,
  onNavigateTab,
  refreshSignal,
}: {
  onOpenDeal?: (id: number) => void;
  onNavigateTab?: (key: string) => void;
  refreshSignal?: number;
}) {
  const { width } = useWindowDimensions();
  const tileWidth = (width - 55) / 2;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [electronicsDeals, setElectronicsDeals] = useState<Deal[]>([]);
  const [topFollowed, setTopFollowed] = useState<Deal[]>([]);
  // Hangi kategori kartina dokunulduysa "Öne Çıkanlar" bölümü onu gösterir
  // (varsayilan: elektronik, önceki sabit davranisla ayni).
  const [activeSlug, setActiveSlug] = useState('elektronik');
  const [followingMap, setFollowingMap] = useState<Record<number, number>>({});
  // Bir kategori kartina dokunulunca dolar -- dolu oldugu surece asagidaki
  // izgara/bolumler yerine o kategorinin TUM urunlerini gosteren tam
  // ekran bir liste acilir (bkz. renderCategoryList). null iken normal
  // "kategori sec" gorunumu gosterilir.
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);
  const [categoryListDeals, setCategoryListDeals] = useState<Deal[]>([]);
  const [categoryListLoading, setCategoryListLoading] = useState(false);
  const [categoryListError, setCategoryListError] = useState<string | null>(null);
  // Ust bardaki filtre/sirala ikonu "Öne Çıkanlar" bolumunun sirasini
  // degistirir; kategori tam listesinde ayrica kendi sirala butonu var
  // (asagida categoryListSort).
  const [featuredSort, setFeaturedSort] = useState('discount');
  const [featuredSortSheetOpen, setFeaturedSortSheetOpen] = useState(false);
  const [categoryListSort, setCategoryListSort] = useState('discount');
  const [categoryListSortSheetOpen, setCategoryListSortSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoriesRes, electronicsRes, followedRes, alarmsRes] = await Promise.all([
        getCategories(),
        getDeals({ category: activeSlug, sort: featuredSort, limit: 6 }),
        getDeals({ sort: 'followers', limit: 3 }),
        getAlarms(),
      ]);
      setCategories(categoriesRes.categories);
      setElectronicsDeals(electronicsRes.deals);
      setTopFollowed(followedRes.deals);
      const nextFollowing: Record<number, number> = {};
      for (const a of alarmsRes.alarms) {
        if (a.active) nextFollowing[a.productId] = a.id;
      }
      setFollowingMap(nextFollowing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kategoriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [activeSlug, featuredSort]);

  useEffect(() => {
    load();
    // refreshSignal: App.tsx'ten periyodik gelen "arka planda yenile"
    // sinyali -- ekrani yeniden mount etmeden veriyi tazeler, kullanici
    // bir kategorinin icindeyse (viewingCategory) oradan disari atilmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshSignal]);

  const loadCategoryList = useCallback(async (slug: string, sort = categoryListSort) => {
    setCategoryListLoading(true);
    setCategoryListError(null);
    try {
      const res = await getDeals({ category: slug, sort, limit: 100 });
      setCategoryListDeals(res.deals);
    } catch (e) {
      setCategoryListError(e instanceof Error ? e.message : 'Fırsatlar yüklenemedi');
    } finally {
      setCategoryListLoading(false);
    }
  }, [categoryListSort]);

  const openCategory = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      setViewingCategory(slug);
      loadCategoryList(slug);
    },
    [loadCategoryList]
  );

  // Kullanici bir kategorinin tam listesini goruntulerken periyodik
  // yenileme sinyali gelirse, o listeyi de arka planda tazele (ekrandan
  // cikarmadan).
  useEffect(() => {
    if (viewingCategory) {
      loadCategoryList(viewingCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

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

  const totalDeals = categories.reduce((sum, c) => sum + c.count, 0);
  const featuredCategory = categories[0] ?? null;
  const secondCategory = categories[1] ?? null;
  const restCategories = categories.slice(2);
  const activeCategoryTitle =
    categories.find((c) => c.slug === activeSlug)?.title || 'Elektronik';

  // Bir kategoriye dokunulduysa (bkz. openCategory), izgara yerine o
  // kategorinin tum urunlerini gosteren tam ekran bir liste aciyoruz.
  if (viewingCategory) {
    const viewingTitle =
      categories.find((c) => c.slug === viewingCategory)?.title || viewingCategory;
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={[styles.categoryListHeader, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable
                style={styles.backButton}
                onPress={() => setViewingCategory(null)}
                accessibilityLabel="Geri"
              >
                <Icon name="arrow-left" size={20} color={colors.foreground} />
              </Pressable>
              <View>
                <Text style={styles.brand}>Kategoriler</Text>
                <Text style={styles.pageTitle}>{viewingTitle}</Text>
              </View>
            </View>
            <Pressable
              style={styles.backButton}
              accessibilityLabel="Sırala"
              onPress={() => setCategoryListSortSheetOpen(true)}
            >
              <Icon name="sliders" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.categoryListContent}
          >
            {categoryListLoading && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}

            {!categoryListLoading && categoryListError && (
              <View style={{ paddingVertical: 24, alignItems: 'center', gap: 10 }}>
                <Text style={{ color: colors.destructive, fontFamily: fonts.body, fontSize: 12 }}>
                  {categoryListError}
                </Text>
                <Pressable style={styles.goButton} onPress={() => loadCategoryList(viewingCategory)}>
                  <Text style={styles.goButtonText}>Tekrar dene</Text>
                </Pressable>
              </View>
            )}

            {!categoryListLoading && !categoryListError && categoryListDeals.length === 0 && (
              <Text style={[styles.mutedText, { padding: 14 }]}>
                Bu kategoride henüz fırsat yok.
              </Text>
            )}

            <View style={styles.categoryListGrid}>
              {categoryListDeals.map((deal, index) => (
                <ProductCard
                  key={deal.id}
                  image={deal.imageUrl}
                  title={deal.title}
                  merchant={deal.storeLabel}
                  oldPrice={deal.oldPrice != null ? formatPrice(deal.oldPrice, deal.currency) : ''}
                  price={formatPrice(deal.currentPrice, deal.currency)}
                  discount={formatDiscount(deal.discountPercent)}
                  imageBackground={
                    index % 2 === 0 ? colors.mutedForeground : colors.secondaryForeground
                  }
                  following={!!followingMap[deal.id]}
                  onPress={() => onOpenDeal?.(deal.id)}
                  onToggleFollow={() => toggleFollow(deal.id)}
                />
              ))}
            </View>
          </ScrollView>
        </View>
        <SortSheet
          visible={categoryListSortSheetOpen}
          onClose={() => setCategoryListSortSheetOpen(false)}
          options={FEATURED_SORT_OPTIONS}
          selected={categoryListSort}
          onSelect={(value) => {
            setCategoryListSort(value);
            loadCategoryList(viewingCategory, value);
          }}
          title={`${viewingTitle} sırala`}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.brand}>FırsatRadar</Text>
                <Text style={styles.pageTitle}>Kategoriler</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.filterButton}
                  onPress={() => setFeaturedSortSheetOpen(true)}
                  accessibilityLabel="Sırala"
                >
                  <Icon name="sliders" size={18} color={colors.secondaryForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.headerBottom}>
              <Text style={styles.headerDescription}>
                İhtiyacına göre fırsatları daralt, gerçek fiyat düşüşlerini keşfet.
              </Text>
              <View style={styles.dealPill}>
                <Icon name="search" size={14} color={colors.accent} />
                <Text style={styles.dealText}>
                  {totalDeals > 0 ? `${totalDeals.toLocaleString('tr-TR')} fırsat` : 'Fırsatlar taranıyor'}
                </Text>
              </View>
            </View>
          </View>

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
                <SectionHeading
                  eyebrow="Hızlı keşif"
                  title="Bir kategori seç"
                  action={
                    <Text style={styles.categoryCount}>{categories.length} kategori</Text>
                  }
                />

                <View style={styles.categoryGrid}>
                  {featuredCategory && (
                    <Pressable
                      style={styles.featuredCategory}
                      onPress={() => openCategory(featuredCategory.slug)}
                    >
                      <LinearGradient
                        colors={[colors.primary, opacityColor(colors.primary, 0.75)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.featuredContent}>
                        <View>
                          <View style={styles.featuredIcon}>
                            <Icon
                              name={featuredCategory.icon as IconName}
                              size={18}
                              color={colors.primaryForeground}
                            />
                          </View>
                          <Text style={styles.featuredTitle}>{featuredCategory.title}</Text>
                          <Text style={styles.featuredCount}>
                            {featuredCategory.count.toLocaleString('tr-TR')} fırsat
                          </Text>
                        </View>
                        <View style={styles.featuredArrow}>
                          <Icon name="arrow-up-right" size={19} color={colors.primaryForeground} />
                        </View>
                      </View>
                    </Pressable>
                  )}

                  {secondCategory && (
                    <Pressable
                      style={[styles.homeCategory, { width: tileWidth }]}
                      onPress={() => openCategory(secondCategory.slug)}
                    >
                      <LinearGradient
                        colors={[colors.accent, opacityColor(colors.accent, 0.7)]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.homeContent}>
                        <View style={styles.homeIcon}>
                          <Icon
                            name={secondCategory.icon as IconName}
                            size={15}
                            color={colors.foreground}
                          />
                        </View>
                        <Text style={styles.homeTitle}>{secondCategory.title}</Text>
                        <Text style={styles.homeCount}>
                          {secondCategory.count.toLocaleString('tr-TR')} fırsat
                        </Text>
                      </View>
                    </Pressable>
                  )}

                  {restCategories.map((category, index) => {
                    const palette = paletteFor(index);
                    return (
                      <CategoryTile
                        key={category.slug}
                        title={category.title}
                        count={category.count.toLocaleString('tr-TR')}
                        icon={category.icon as IconName}
                        background={palette.background}
                        foreground={palette.foreground}
                        onPress={() => openCategory(category.slug)}
                      />
                    );
                  })}
                </View>

                <View style={styles.section}>
                  <SectionHeading
                    eyebrow={activeCategoryTitle}
                    title={`${activeCategoryTitle}'te Öne Çıkanlar`}
                    action={
                      <Pressable style={styles.seeAll} onPress={() => onNavigateTab?.('arama')}>
                        <Text style={styles.seeAllText}>Tümünü gör</Text>
                        <Icon name="arrow-up-right" size={14} color={colors.accent} />
                      </Pressable>
                    }
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.productList}
                  >
                    {electronicsDeals.length === 0 && (
                      <Text style={styles.mutedText}>Şu an öne çıkan elektronik fırsatı yok.</Text>
                    )}
                    {electronicsDeals.map((deal, index) => (
                      <ProductCard
                        key={deal.id}
                        image={deal.imageUrl}
                        title={deal.title}
                        merchant={deal.storeLabel}
                        oldPrice={deal.oldPrice != null ? formatPrice(deal.oldPrice, deal.currency) : ''}
                        price={formatPrice(deal.currentPrice, deal.currency)}
                        discount={formatDiscount(deal.discountPercent)}
                        imageBackground={
                          index % 2 === 0 ? colors.mutedForeground : colors.secondaryForeground
                        }
                        following={!!followingMap[deal.id]}
                        onPress={() => onOpenDeal?.(deal.id)}
                        onToggleFollow={() => toggleFollow(deal.id)}
                      />
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.section}>
                  <SectionHeading
                    eyebrow="Topluluk sinyali"
                    title="Bugün En Çok Takip Edilenler"
                    action={<Icon name="activity" size={19} color={colors.accent} />}
                  />
                  <View style={styles.followedCard}>
                    {topFollowed.length === 0 && (
                      <Text style={[styles.mutedText, { padding: 14 }]}>
                        Henüz takip verisi yok.
                      </Text>
                    )}
                    {topFollowed.map((deal, index) => (
                      <FollowedProduct
                        key={deal.id}
                        first={index === 0}
                        rank={String(index + 1).padStart(2, '0')}
                        title={deal.title}
                        followers={deal.followCount.toLocaleString('tr-TR')}
                        image={deal.imageUrl}
                        imageBackground={
                          index === 0
                            ? colors.chart5
                            : index === 1
                            ? colors.mutedForeground
                            : colors.secondaryForeground
                        }
                        following={!!followingMap[deal.id]}
                        onPress={() => onOpenDeal?.(deal.id)}
                        onToggleFollow={() => toggleFollow(deal.id)}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <BottomTab label="Keşfet" icon="compass" onPress={() => onNavigateTab?.('kefet')} />
          <BottomTab label="Kategoriler" icon="grid" active onPress={() => onNavigateTab?.('kategoriler')} />
          <BottomTab label="Alarmlar" icon="bell" onPress={() => onNavigateTab?.('alarmlar')} />
          <BottomTab label="Profil" icon="user" onPress={() => onNavigateTab?.('profil')} />
        </View>
      </View>
      <SortSheet
        visible={featuredSortSheetOpen}
        onClose={() => setFeaturedSortSheetOpen(false)}
        options={FEATURED_SORT_OPTIONS}
        selected={featuredSort}
        onSelect={setFeaturedSort}
        title="Öne Çıkanları sırala"
      />
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
  content: {
    paddingBottom: 110,
  },
  categoryListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  categoryListContent: {
    padding: 16,
    paddingBottom: 110,
  },
  categoryListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: colors.card,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  pageTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  locationText: {
    color: colors.cardForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  filterButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.secondary,
  },
  headerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  headerDescription: {
    flex: 1,
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  dealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: opacityColor(colors.accent, 0.1),
  },
  dealText: {
    color: colors.accent,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  main: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headingCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  categoryCount: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
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
    fontFamily: theme.fonts.body,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 11,
  },
  featuredCategory: {
    width: '100%',
    height: 176,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: opacityColor(colors.primary, 0.6),
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  featuredContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
  },
  featuredIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 11,
    backgroundColor: colors.primary,
  },
  featuredTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  featuredCount: {
    marginTop: 2,
    color: opacityColor(colors.foreground, 0.75),
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  featuredArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primary,
  },
  homeCategory: {
    height: 144,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  homeContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 14,
  },
  homeIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  homeTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 15,
    fontWeight: '700',
  },
  homeCount: {
    marginTop: 2,
    color: opacityColor(colors.foreground, 0.7),
    fontFamily: theme.fonts.body,
    fontSize: 10,
  },
  categoryTile: {
    width: '48%',
    minHeight: 144,
    justifyContent: 'space-between',
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  tileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  tileTitle: {
    flex: 1,
    color: colors.foreground,
    fontFamily: theme.fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  mutedText: {
    marginTop: 5,
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 11,
  },
  section: {
    marginTop: 30,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeAllText: {
    color: colors.accent,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  productList: {
    gap: 12,
    paddingBottom: 2,
  },
  productCard: {
    width: 210,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  productImageArea: {
    height: 128,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
    padding: 12,
  },
  discount: {
    position: 'absolute',
    zIndex: 2,
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    fontWeight: '800',
  },
  favoriteButton: {
    position: 'absolute',
    zIndex: 2,
    top: 9,
    right: 9,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: opacityColor(colors.background, 0.8),
  },
  productDetails: {
    padding: 14,
  },
  merchantBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: colors.secondary,
  },
  merchantText: {
    color: colors.secondaryForeground,
    fontFamily: theme.fonts.body,
    fontSize: 9,
    fontWeight: '700',
  },
  productTitle: {
    minHeight: 36,
    marginTop: 9,
    color: colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  oldPrice: {
    marginTop: 8,
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  price: {
    marginTop: 1,
    color: colors.accent,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  followedCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  followedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
  },
  followedRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rank: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  rankText: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '800',
  },
  followedImageWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  followedImage: {
    width: 44,
    height: 44,
  },
  followedCopy: {
    flex: 1,
    minWidth: 0,
  },
  followedTitle: {
    color: colors.foreground,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  followersLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  followersText: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 10,
  },
  alertButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
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
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: opacityColor(colors.card, 0.97),
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIcon: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  activeTabIcon: {
    borderRadius: 18,
    backgroundColor: opacityColor(colors.primary, 0.15),
  },
  tabLabel: {
    color: colors.mutedForeground,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    fontWeight: '500',
  },
  activeTabLabel: {
    color: colors.primary,
    fontWeight: '800',
  },
});