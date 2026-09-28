import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import FirsatRadarScreen from './KeFet';
import CategoriesScreen from './Kategoriler';
import TrackedProductsScreen from './Alarmlar';
import ProfileScreen from './Profil';
import DealComparisonScreen from './Arama';
import DealDetailScreen from './RNDetay';
import AuthScreen from './Giris';
import PreferencesScreen from './Tercihler';
import { AdBanner, initAds, useInterstitialAd } from './ads';
import { initNotifications, useNotificationTapListener } from './notifications';

// Ust bardaki 5 ana sekme arasinda gecis yapan basit bir anahtar (gercek
// bir navigasyon kutuphanesi degil, ama artik gercek uygulama akisinin
// parcasi -- KeFet/Kategoriler/Arama/Alarmlar ekranlarindaki urun
// kartlarina dokunuldugunda asagidaki `detailDealId` state'i uzerinden
// Urun Detayi ekrani bir "ust katman" olarak acilir, geri okuyla kapanir).
// Her ekranin kendi ic "alt sekme" cubugu ayrica var ama dekoratif --
// gercek sekme gecisi bu ustteki bar ile yapiliyor.
const SCREENS: { key: string; label: string; Component: React.ComponentType<any> }[] = [
  { key: 'kefet', label: 'Keşfet', Component: FirsatRadarScreen },
  { key: 'kategoriler', label: 'Kategoriler', Component: CategoriesScreen },
  { key: 'alarmlar', label: 'Alarmlar', Component: TrackedProductsScreen },
  { key: 'profil', label: 'Profil', Component: ProfileScreen },
  { key: 'arama', label: 'Arama', Component: DealComparisonScreen },
];

// Ekranlar veriyi kendi ic useEffect'lerinde (mount aninda) backend'den
// cekiyor. Gercek bir "canli veri" abonelikleri olmadigi icin, en basit
// otomatik yenileme yontemi: belirli araliklarla ekrana bir "refreshSignal"
// sayisi gondermek; ekranin kendi useEffect'i bu sayi degistiginde
// load()'u tekrar cagirir. ONEMLI: ekrani "key" degistirerek yeniden
// MOUNT ETMIYORUZ artik -- daha once oyle yapiliyordu ama bu, ekranin
// kendi ic state'ini (ornegin Kategoriler'de hangi kategoriye girildigi,
// KeFet'te hangi magaza filtresinin secili oldugu) sifirlayip kullaniciyi
// bulundugu yerden farkinda olmadan disari atiyordu.
const POLL_INTERVAL_MS = 30000; // 30 saniye

export default function App() {
  const [active, setActive] = useState(SCREENS[0].key);
  const [refreshTick, setRefreshTick] = useState(0);
  // Herhangi bir ekranda bir urun kartina dokunulunca dolar; dolu oldugu
  // surece Urun Detayi ekrani ana sekmelerin USTUNDE gosterilir (basit bir
  // tek-seviyeli navigasyon yigini). Geri okuyla (onBack) null'a doner.
  const [detailDealId, setDetailDealId] = useState<number | null>(null);
  // Profil ekranindaki "Giriş yap" butonuna dokunulunca dolar; Urun
  // Detayi ile ayni "ust katman" mantigiyla gosterilir (bkz. asagidaki
  // render). Basarili giris/kayittan sonra kapanir ve o anki ekran
  // yenilenir (refreshTick artirilarak) ki Profil hemen yeni hesabi gostersin.
  const [showAuth, setShowAuth] = useState(false);
  // Profil ekranindaki Ayarlar/Tercihleri kişiselleştir/Pazaryeri/İlgi
  // alani/Bildirim tuslarina dokunulunca dolar -- Giris ile ayni "ust
  // katman" mantigiyla gosterilir (bkz. asagidaki render).
  const [showPreferences, setShowPreferences] = useState(false);
  // Urun detayina gecis (interstitial) reklami -- her acilista degil,
  // belirli araliklarla gosterilir (bkz. ads.tsx). Web'de ads.web.tsx'in
  // no-op suru kullanilir, hicbir sey gostermez.
  // GECICI TANI DEGISIKLIGI: reklamin hic cikmadigi bildirildigi icin test
  // kolayligi amaciyla "her 3 urunde bir" yerine "her urunde" gostermeye
  // ceviriyoruz -- boylece sayaç mi yoksa AdMob'un kendisi mi (no-fill)
  // sorunlu net anlasilir. Test edip sonuc netlesince production icin
  // tekrar 3'e (ya da istenen baska bir degere) dondurulmeli.
  const { maybeShow: maybeShowInterstitial } = useInterstitialAd(1);

  useEffect(() => {
    initAds();
    initNotifications();
    const interval = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const openDeal = (dealId: number) => {
    maybeShowInterstitial();
    setDetailDealId(dealId);
  };
  // Bildirime dokununca (uygulama kapaliyken/arka plandayken de calisir --
  // bkz. notifications.ts) ilgili urunun detayina goturur. Bildirim
  // gecisinde araya reklam girmesin diye maybeShowInterstitial'i atliyoruz.
  const handleNotificationTap = useCallback((data: Record<string, any>) => {
    const productId = Number(data?.productId);
    if (!Number.isNaN(productId) && productId > 0) {
      setShowAuth(false);
      setShowPreferences(false);
      setDetailDealId(productId);
    }
  }, []);
  useNotificationTapListener(handleNotificationTap);
  const closeDeal = () => setDetailDealId(null);
  const openAuth = () => setShowAuth(true);
  const closeAuth = () => setShowAuth(false);
  const handleAuthed = () => {
    closeAuth();
    // Yeni giris yapilan/olusturulan hesabin bilgisini (ve o hesaba
    // devredilen alarmlari) hemen goster.
    setRefreshTick((t) => t + 1);
  };
  const openPreferences = () => setShowPreferences(true);
  const closePreferences = () => {
    setShowPreferences(false);
    // Kaydedilen tercihleri (pazaryerleri, ilgi alanlari, bildirim) Profil
    // ekraninda hemen goster.
    setRefreshTick((t) => t + 1);
  };
  // Bir ekrandaki "ara" / "kategoriler" gibi kisayol butonlari ust sekmeyi
  // degistirmek icin bunu kullanir (ayni zamanda acik olan detay ekranini kapatir).
  const goToTab = (key: string) => {
    setDetailDealId(null);
    setShowAuth(false);
    setShowPreferences(false);
    setActive(key);
  };

  const Active = SCREENS.find((s) => s.key === active)!.Component;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.switcherBar}>
        {SCREENS.map((s) => (
          <Pressable
            key={s.key}
            onPress={() => goToTab(s.key)}
            style={[
              styles.tab,
              active === s.key && !detailDealId && !showAuth && !showPreferences && styles.activeTab,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                active === s.key && !detailDealId && !showAuth && !showPreferences && styles.activeTabText,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </SafeAreaView>
      <View style={styles.screenArea}>
        {showAuth ? (
          <AuthScreen onClose={closeAuth} onAuthed={handleAuthed} />
        ) : showPreferences ? (
          <PreferencesScreen onClose={closePreferences} />
        ) : detailDealId != null ? (
          <DealDetailScreen dealId={detailDealId} onBack={closeDeal} />
        ) : (
          <Active
            key={active}
            onOpenDeal={openDeal}
            onNavigateTab={goToTab}
            refreshSignal={refreshTick}
            onOpenAuth={openAuth}
            onOpenPreferences={openPreferences}
          />
        )}
      </View>
      {/* Ekranin en altinda sabit banner reklam -- tum sekmelerde ve urun
          detayinda ortak (tek yerden yonetildigi icin her ekrana ayri ayri
          eklemek gerekmiyor). Web'de hicbir sey render etmez. */}
      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  switcherBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#111318',
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    margin: 2,
  },
  activeTab: {
    backgroundColor: '#4f46e5',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#ffffff',
  },
  screenArea: {
    flex: 1,
  },
});
