import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import theme from './theme';
import {
  AuthUser,
  Category,
  Preferences,
  getAlarms,
  getCategories,
  getCurrentUser,
  getPreferences,
  logout,
  updatePreferences,
} from './api';

const colors = theme.colors;
const fonts = theme.fonts;

const STORE_META: Record<string, { label: string; letter: string; color: string }> = {
  amazon: { label: 'Amazon', letter: 'a', color: colors.foreground },
  trendyol: { label: 'Trendyol', letter: 't', color: colors.primary },
  hepsiburada: { label: 'Hepsiburada', letter: 'h', color: colors.chart1 },
  'trendyol-yemek': { label: 'Trendyol Yemek', letter: 'y', color: colors.primary },
  n11: { label: 'N11', letter: 'n', color: colors.chart4 },
};

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const Icon = ({
  name,
  size = 20,
  color = colors.foreground,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) => (
  <MaterialCommunityIcons name={name} size={size} color={color} style={style} />
);

const MarketplaceBadge = ({
  letter,
  label,
  color,
}: {
  letter: string;
  label: string;
  color: string;
}) => (
  <View style={styles.marketplaceBadge}>
    <View style={[styles.marketplaceMark, { backgroundColor: color }]}>
      <Text style={styles.marketplaceLetter}>{letter}</Text>
    </View>
    <Text style={styles.marketplaceLabel}>{label}</Text>
  </View>
);

const SectionHeading = ({
  eyebrow,
  title,
  action = 'Düzenle',
  onPress,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onPress?: () => void;
}) => (
  <View style={styles.sectionHeading}>
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <Pressable hitSlop={8} onPress={onPress}>
      <Text style={styles.actionText}>{action}</Text>
    </Pressable>
  </View>
);

const BottomTab = ({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) => (
  <Pressable style={styles.tab} onPress={onPress}>
    <View style={[styles.tabIcon, active && styles.activeTabIcon]}>
      <Icon
        name={icon}
        size={22}
        color={active ? colors.primary : colors.mutedForeground}
      />
    </View>
    <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>
      {label}
    </Text>
  </Pressable>
);

export default function ProfileScreen({
  onNavigateTab,
  refreshSignal,
  onOpenAuth,
  onOpenPreferences,
}: {
  onOpenDeal?: (id: number) => void;
  onNavigateTab?: (key: string) => void;
  refreshSignal?: number;
  onOpenAuth?: () => void;
  onOpenPreferences?: () => void;
} = {}) {
  const [trackedCount, setTrackedCount] = useState<number | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [categoryTitles, setCategoryTitles] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    try {
      const { summary } = await getAlarms();
      setTrackedCount(summary.trackedCount);
    } catch {
      // Profil ekraninin geri kalani alarm verisine bagimli degil; sessizce
      // vazgec, kullanici Alarmlar sekmesinden zaten gercek durumu gorur.
      setTrackedCount(null);
    }
    try {
      const [prefs, catsResult] = await Promise.all([getPreferences(), getCategories()]);
      setPreferences(prefs);
      const titles: Record<string, string> = {};
      catsResult.categories.forEach((c: Category) => {
        titles[c.slug] = c.title;
      });
      setCategoryTitles(titles);
    } catch {
      // Tercihler yuklenemezse ekranin geri kalani yine de calisir; ilgili
      // bolumler bos/varsayilan durumda gosterilir.
      setPreferences(null);
    }
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshSignal]);

  const handleAuthPress = useCallback(async () => {
    if (user) {
      await logout();
      setUser(null);
      load(); // cikis sonrasi bu cihazdaki misafir alarm sayisini yeniden yukle
    } else {
      onOpenAuth?.();
    }
  }, [user, onOpenAuth, load]);

  const handleEditProfilePress = useCallback(() => {
    if (user) {
      onOpenPreferences?.();
    } else {
      onOpenAuth?.();
    }
  }, [user, onOpenAuth, onOpenPreferences]);

  const handleNotificationsToggle = useCallback(async (value: boolean) => {
    setPreferences((prev) => (prev ? { ...prev, notificationsEnabled: value } : prev));
    try {
      await updatePreferences({ notificationsEnabled: value });
    } catch {
      setPreferences((prev) => (prev ? { ...prev, notificationsEnabled: !value } : prev));
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <View style={styles.headerOrb} />
            <View style={styles.headerGlow} />

            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerEyebrow}>Hesabım</Text>
                <Text style={styles.headerTitle}>Profil</Text>
              </View>

              <Pressable
                style={styles.roundButton}
                onPress={() => onOpenPreferences?.()}
              >
                <Icon name="cog-outline" size={21} color={colors.cardForeground} />
              </Pressable>
            </View>

            <View style={styles.profileRow}>
              <View style={styles.avatarWrap}>
                <LinearGradient
                  colors={[colors.primary, colors.chart5]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatar}
                >
                  <Text style={styles.avatarText}>
                    {user ? user.email.slice(0, 2).toUpperCase() : 'FR'}
                  </Text>
                </LinearGradient>
                {user ? (
                  <View style={styles.verified}>
                    <Icon name="check" size={13} color={colors.successForeground} />
                  </View>
                ) : null}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {user ? user.email : 'Misafir kullanıcı'}
                </Text>
                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.mutedText}>
                    {user ? 'Fırsat takipçisi' : 'Giriş yapmadın — misafir modu'}
                  </Text>
                </View>
              </View>

              <Pressable style={styles.editButton} onPress={handleEditProfilePress}>
                <Icon name="pencil-outline" size={19} color={colors.secondaryForeground} />
              </Pressable>
            </View>
          </View>

          <View style={styles.main}>
            <LinearGradient
              colors={[colors.primary, colors.chart1, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.preferenceCard}
            >
              <View style={styles.preferenceOrb} />

              <View style={styles.preferenceTop}>
                <View style={styles.preferenceIntro}>
                  <View style={styles.sparkleIcon}>
                    <Icon name="star-four-points-outline" size={22} color={colors.foreground} />
                  </View>
                  <View>
                    <Text style={styles.preferenceEyebrow}>Kişisel radarın</Text>
                    <Text style={styles.preferenceTitle}>Tercihlerini güçlendir</Text>
                  </View>
                </View>
                <View style={styles.recommended}>
                  <Text style={styles.recommendedText}>Önerilen</Text>
                </View>
              </View>

              <Text style={styles.preferenceDescription}>
                Mağaza, konum ve bildirim ayarlarını tamamla; sana uyan fırsatları
                daha hızlı yakala.
              </Text>

              <Pressable
                style={styles.preferenceButton}
                onPress={() => onOpenPreferences?.()}
              >
                <Text style={styles.preferenceButtonText}>
                  Tercihleri kişiselleştir
                </Text>
                <Icon name="arrow-right" size={18} color={colors.primary} />
              </Pressable>
            </LinearGradient>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Icon name="badge-account-outline" size={17} color={colors.accent} />
                  <Text style={styles.statLabel}>Planın</Text>
                </View>
                <Text style={styles.statValue}>Ücretsiz plan</Text>
                <Text style={styles.statHint}>FırsatRadar</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statLabelRow}>
                  <Icon name="bell-ring-outline" size={17} color={colors.primary} />
                  <Text style={styles.statLabel}>Aktif takip</Text>
                </View>
                <Text style={styles.statValue}>
                  {trackedCount == null ? '—' : `${trackedCount} fiyat alarmı`}
                </Text>
                <Text style={styles.statSuccess}>Takipte</Text>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                eyebrow="Radar ayarları"
                title="Tercihlerin"
                onPress={() => onOpenPreferences?.()}
              />

              <View style={styles.settingsCard}>
                <Pressable
                  style={styles.marketplacesBlock}
                  onPress={() => onOpenPreferences?.()}
                >
                  <View style={styles.settingTitleRow}>
                    <View style={styles.settingTitle}>
                      <Icon name="store-outline" size={20} color={colors.primary} />
                      <Text style={styles.settingTitleText}>
                        Takip ettiğin pazaryerleri
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={colors.mutedForeground} />
                  </View>

                  {preferences && preferences.stores.length > 0 ? (
                    <View style={styles.badges}>
                      {preferences.stores.map((key) => {
                        const meta = STORE_META[key];
                        if (!meta) return null;
                        return (
                          <MarketplaceBadge
                            key={key}
                            letter={meta.letter}
                            label={meta.label}
                            color={meta.color}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.emptyPreferenceHint}>
                      Henüz pazaryeri seçmedin — dokun ve seç.
                    </Text>
                  )}
                </Pressable>

                <View style={styles.settingRow}>
                  <View style={styles.settingIconBox}>
                    <Icon name="bell-ring-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.settingCopy}>
                    <Text style={styles.settingText}>Anlık fırsat bildirimleri</Text>
                    <Text style={styles.settingHint}>Flash sale bitmeden haber ver</Text>
                  </View>
                  <Switch
                    value={preferences?.notificationsEnabled ?? true}
                    onValueChange={handleNotificationsToggle}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.successForeground}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading
                eyebrow="Daha iyi eşleşmeler"
                title="İlgi alanların"
                onPress={() => onOpenPreferences?.()}
              />

              <View style={styles.interestsCard}>
                <Text style={styles.interestDescription}>
                  Seçtiklerin, Keşfet akışındaki fırsatları sana göre filtreler.
                </Text>

                <View style={styles.interests}>
                  {(preferences?.categories ?? []).length === 0 ? (
                    <Text style={styles.emptyPreferenceHint}>
                      Henüz ilgi alanı seçmedin.
                    </Text>
                  ) : (
                    preferences!.categories.map((slug, i) => (
                      <View
                        key={slug}
                        style={[
                          styles.interestChip,
                          i % 2 === 0 ? styles.primaryChip : styles.accentChip,
                        ]}
                      >
                        <Text style={i % 2 === 0 ? styles.primaryChipText : styles.accentChipText}>
                          {categoryTitles[slug] || slug}
                        </Text>
                      </View>
                    ))
                  )}
                  <Pressable
                    style={styles.addChip}
                    onPress={() => onOpenPreferences?.()}
                  >
                    <Icon name="plus" size={16} color={colors.mutedForeground} />
                    <Text style={styles.addChipText}>Ekle</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Pressable style={styles.logoutButton} onPress={handleAuthPress}>
              <Icon name={user ? 'logout' : 'login'} size={18} color={colors.mutedForeground} />
              <Text style={styles.logoutText}>
                {user ? 'Çıkış yap' : 'Giriş yap / Hesap oluştur'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.tabBar}>
          <BottomTab icon="compass-outline" label="Keşfet" onPress={() => onNavigateTab?.('kefet')} />
          <BottomTab icon="shape-outline" label="Kategoriler" onPress={() => onNavigateTab?.('kategoriler')} />
          <BottomTab icon="bell-outline" label="Alarmlar" onPress={() => onNavigateTab?.('alarmlar')} />
          <BottomTab icon="account-circle-outline" label="Profil" active onPress={() => onNavigateTab?.('profil')} />
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
  content: {
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  headerOrb: {
    position: 'absolute',
    right: -64,
    top: -76,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 20,
    borderColor: colors.primary,
    opacity: 0.1,
  },
  headerGlow: {
    position: 'absolute',
    left: -76,
    bottom: -76,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.accent,
    opacity: 0.05,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerEyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  headerTitle: {
    marginTop: 3,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: '700',
  },
  roundButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
  },
  avatarText: {
    color: colors.primaryForeground,
    fontFamily: fonts.heading,
    fontSize: 24,
    fontWeight: '800',
  },
  verified: {
    position: 'absolute',
    right: -1,
    bottom: 0,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 4,
    borderColor: colors.card,
    backgroundColor: colors.success,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 23,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  mutedText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  editButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.secondary,
  },
  main: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  preferenceCard: {
    position: 'relative',
    padding: 16,
    overflow: 'hidden',
    borderRadius: 16,
  },
  preferenceOrb: {
    position: 'absolute',
    right: -28,
    top: -38,
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 18,
    borderColor: colors.foreground,
    opacity: 0.1,
  },
  preferenceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  preferenceIntro: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkleIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    opacity: 0.9,
  },
  preferenceEyebrow: {
    color: colors.foreground,
    opacity: 0.75,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  preferenceTitle: {
    marginTop: 2,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  recommended: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.background,
    opacity: 0.9,
  },
  recommendedText: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '700',
  },
  preferenceDescription: {
    maxWidth: 290,
    marginTop: 12,
    color: colors.foreground,
    opacity: 0.82,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 20,
  },
  preferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  preferenceButtonText: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    marginTop: 9,
    color: colors.cardForeground,
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
  },
  statHint: {
    marginTop: 4,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  statSuccess: {
    marginTop: 4,
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 11,
  },
  section: {
    marginTop: 28,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 21,
    fontWeight: '700',
  },
  actionText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  settingsCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  marketplacesBlock: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingTitleText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 13,
  },
  marketplaceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: colors.secondary,
  },
  marketplaceMark: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  marketplaceLetter: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
  marketplaceLabel: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  settingCopy: {
    flex: 1,
  },
  settingText: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  settingHint: {
    marginTop: 3,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  emptyPreferenceHint: {
    marginTop: 13,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  interestsCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  interestDescription: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 20,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
  },
  primaryChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    opacity: 0.92,
  },
  primaryChipText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  accentChip: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  accentChipText: {
    color: colors.accentForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 20,
  },
  addChipText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.secondary,
  },
  logoutText: {
    color: colors.secondaryForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tabIcon: {
    width: 44,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  activeTabIcon: {
    backgroundColor: colors.primary,
    opacity: 0.9,
  },
  tabLabel: {
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