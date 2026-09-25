// Tercihler.tsx
// -----------------------------------------------------------------------
// Profil ekranindaki butun "yakinda eklenecek" tuslarinin gercek karsiligi:
// takip edilen pazaryerleri, ilgi alani kategorileri, anlik fırsat
// bildirimi acik/kapali. App.tsx'te Giris/Urun Detayi ile ayni "ust katman"
// (overlay) mantigiyla acilir. Giris yapmadan da kullanilabilir (misafir/
// cihaz bazli, bkz. api.ts) -- kaydedilince backend'e yazilir, hesap
// acilinca/giris yapilinca o hesaba devredilir (bkz. backend/routes/preferences.js).
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from './theme';
import { getCategories, getPreferences, updatePreferences, Category } from './api';

const STORES: { key: string; label: string; letter: string; color: string }[] = [
  { key: 'amazon', label: 'Amazon', letter: 'a', color: colors.foreground },
  { key: 'trendyol', label: 'Trendyol', letter: 't', color: colors.primary },
  { key: 'hepsiburada', label: 'Hepsiburada', letter: 'h', color: colors.chart1 },
  { key: 'trendyol-yemek', label: 'Trendyol Yemek', letter: 'y', color: colors.primary },
  { key: 'n11', label: 'N11', letter: 'n', color: colors.chart4 },
];

export default function PreferencesScreen({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stores, setStores] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [prefs, catsResult] = await Promise.all([getPreferences(), getCategories()]);
        if (cancelled) return;
        setStores(prefs.stores);
        setSelectedCategories(prefs.categories);
        setNotificationsEnabled(prefs.notificationsEnabled);
        setCategories(catsResult.categories);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Tercihler yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleStore = (key: string) => {
    setStores((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  };

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const onToggleNotifications = useCallback(async (value: boolean) => {
    setNotificationsEnabled(value); // aninda tepki ver
    try {
      await updatePreferences({ notificationsEnabled: value });
    } catch {
      setNotificationsEnabled(!value); // basarisizsa geri al
    }
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({ stores, categories: selectedCategories, notificationsEnabled });
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Kaydedilemedi, tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={onClose} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>Tercihlerin</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.eyebrow}>Radar ayarları</Text>
            <Text style={styles.sectionTitle}>Takip ettiğin pazaryerleri</Text>
            <Text style={styles.sectionHint}>
              Seçtiklerin, Keşfet ve Arama'daki mağaza filtrelerinde öne çıkar.
            </Text>
            <View style={styles.chipsWrap}>
              {STORES.map((s) => {
                const active = stores.includes(s.key);
                return (
                  <Pressable
                    key={s.key}
                    style={[styles.storeChip, active && styles.storeChipActive]}
                    onPress={() => toggleStore(s.key)}
                  >
                    <View style={[styles.storeMark, { backgroundColor: s.color }]}>
                      <Text style={styles.storeMarkText}>{s.letter}</Text>
                    </View>
                    <Text style={[styles.storeChipText, active && styles.storeChipTextActive]}>
                      {s.label}
                    </Text>
                    {active ? (
                      <Feather name="check" size={14} color={colors.primary} style={styles.storeCheck} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Daha iyi eşleşmeler</Text>
            <Text style={styles.sectionTitle}>İlgi alanların</Text>
            <Text style={styles.sectionHint}>
              Seçtiklerin, Keşfet akışındaki fırsatları sana göre filtreler.
            </Text>
            {categories.length === 0 ? (
              <Text style={styles.emptyHint}>Henüz listelenecek kategori yok.</Text>
            ) : (
              <View style={styles.chipsWrap}>
                {categories.map((c) => {
                  const active = selectedCategories.includes(c.slug);
                  return (
                    <Pressable
                      key={c.slug}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                      onPress={() => toggleCategory(c.slug)}
                    >
                      <Text
                        style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                      >
                        {c.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Bildirimler</Text>
            <View style={styles.notifRow}>
              <View style={styles.notifCopy}>
                <Text style={styles.notifTitle}>Anlık fırsat bildirimleri</Text>
                <Text style={styles.sectionHint}>Flash sale bitmeden haber ver</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={onToggleNotifications}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.successForeground}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={save}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.saveButtonText}>Kaydet</Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
  },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, paddingBottom: 48 },
  section: { marginTop: 20 },
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
    fontSize: 20,
    fontWeight: '700',
  },
  sectionHint: {
    marginTop: 6,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyHint: {
    marginTop: 14,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  storeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  storeMark: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  storeMarkText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '800',
  },
  storeChipText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  storeChipTextActive: {
    color: colors.foreground,
  },
  storeCheck: { marginLeft: 2 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  notifCopy: { flex: 1, marginRight: 12 },
  notifTitle: {
    color: colors.cardForeground,
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    marginTop: 20,
    color: colors.destructive,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 28,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700',
  },
});
