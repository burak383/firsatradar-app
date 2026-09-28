// ads.ts
// -----------------------------------------------------------------------
// Google AdMob entegrasyonu (native derleme -- iOS/Android). Web derlemesi
// bu dosyayi DEGIL, `ads.web.tsx` dosyasini kullanir -- Metro bundler,
// "./ads" import edildiginde platforma gore otomatik olarak dogru dosyayi
// secer (".web.tsx" uzantisi sayesinde), boylece `npx expo start --web`
// bu native-only kutuphaneyi hic yuklemeye calismaz.
//
// DURUM: Hem Android hem iOS icin GERCEK AdMob ID'leri girildi (Banner +
// Gecis). USE_TEST_ADS = false, yani her iki platformda da artik gercek
// reklamlar gosterilir. pickAdUnitId() yine de bir guvenlik agi olarak
// duruyor -- ileride bir platformun ID'si bosaltilir/placeholder'a
// donerse otomatik test ID'sine duser, cokmez.
//
// KURULUM (bu dosyayi kullanabilmek icin):
//   npx expo install react-native-google-mobile-ads
// Bu kutuphane native kod icerir -- Expo Go'da CALISMAZ. Gercek cihazda/
// emulatorde test etmek icin `npx expo run:android` veya
// `npx expo run:ios` (ya da EAS Build) ile bir "development build"
// olusturman gerekir. `npx expo start --web` her zaman oldugu gibi
// calismaya devam eder (asagidaki web stub'i sayesinde).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export const USE_TEST_ADS = false;

// FirsatRadar AdMob hesabindaki gercek reklam birimi ID'leri. "ios" dali
// hala doldurulmadiysa (placeholder icerdigi surece) asagidaki
// pickAdUnitId() otomatik olarak test ID'sine duser.
const REAL_AD_UNIT_IDS = {
  banner: Platform.select({
    android: 'ca-app-pub-9017194698663463/9286555930',
    ios: 'ca-app-pub-9017194698663463/2509394596',
    default: '',
  })!,
  interstitial: Platform.select({
    android: 'ca-app-pub-9017194698663463/1724680551',
    ios: 'ca-app-pub-9017194698663463/3995709961',
    default: '',
  })!,
};

// USE_TEST_ADS true ise ya da bu platform icin gercek ID henuz
// girilmediyse (hala 'XXXX' placeholder'i iceriyorsa) guvenli sekilde
// test ID'sine duser -- boylece bos/placeholder bir ID'yle reklam
// istegi atip cokme riski olmaz.
function pickAdUnitId(real: string, testId: string): string {
  if (USE_TEST_ADS || !real || real.includes('XXXX')) return testId;
  return real;
}

const bannerAdUnitId = pickAdUnitId(REAL_AD_UNIT_IDS.banner, TestIds.BANNER);
const interstitialAdUnitId = pickAdUnitId(REAL_AD_UNIT_IDS.interstitial, TestIds.INTERSTITIAL);

let initialized = false;

// App.tsx acilirken bir kere cagrilir. AdMob SDK'sini baslatir; bu
// tamamlanmadan reklam istekleri guvenilir calismayabilir.
export function initAds() {
  if (initialized) return;
  initialized = true;
  mobileAds()
    .initialize()
    .then((adapterStatuses) => console.log('[AdMob] SDK baslatildi:', adapterStatuses))
    .catch((error) => {
      // Reklam altyapisi yuklenemezse (ornegin cihazda Google Play
      // Services yoksa) sessizce vazgec -- uygulamanin geri kalani
      // reklamsiz calismaya devam etmeli, hicbir sekilde kilitlenmemeli.
      // Ama tanı icin hatayi yine de logluyoruz.
      console.warn('[AdMob] SDK baslatilamadi:', error);
    });
}

// Ekranlarin icine serpistirilen / ekran altina sabitlenen banner reklam.
// KVKK/Google politikasi geregi kisisellestirilmemis reklam istiyoruz
// (requestNonPersonalizedAdsOnly) -- boylece ek bir "izin/onay" akisi
// (App Tracking Transparency vb.) kurmadan da politika uyumlu kalinir.
export function AdBanner({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.bannerWrap, style]}>
      <BannerAd
        unitId={bannerAdUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        // GECICI TANI LOGLARI: reklam hic gorunmuyor sikayeti icin eklendi.
        // BannerAd'in kendisi hata durumunda hicbir sey render etmiyor
        // (bos alan kalir), yani "neden gorunmuyor"u anlamak icin
        // AdMob'un dondurdugu GERCEK hata kodunu logcat'e yazdiriyoruz.
        // adb logcat *:S ReactNativeJS:V ile bu loglari canli takip edebilirsin
        // (en sik gorulecek kod 3/"no-fill" -- AdMob hesabi/uygulamasi henuz
        // onaylanmadiysa veya envanter bulunamadiysa budur, kod hatasi degildir).
        onAdLoaded={() => console.log('[AdMob] Banner yuklendi ve gosteriliyor')}
        onAdFailedToLoad={(error) =>
          console.warn('[AdMob] Banner YUKLENEMEDI:', error?.code, error?.message)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
});

// Gecis (interstitial) reklami: HER urun detayinda degil, belirli
// araliklarla (varsayilan: her 3 acilista bir) gostermek icin sayac
// tutan basit bir hook. maybeShow() senkron doner ve navigasyonu asla
// bloklamaz -- reklam yuklenmemisse veya sira gelmemisse sessizce
// hicbir sey yapmaz, kullanici urun detayina direkt gecer.
export function useInterstitialAd(showEveryNth = 3) {
  const adRef = useRef<InterstitialAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const countRef = useRef(0);

  const load = useCallback(() => {
    const ad = InterstitialAd.createForAdRequest(interstitialAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => setLoaded(true));
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      load(); // kapanir kapanmaz bir sonraki gosterim icin yenisini yukle
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      setLoaded(false);
      console.warn('[AdMob] Gecis reklami YUKLENEMEDI:', (error as any)?.code, (error as any)?.message);
    });
    ad.load();
    adRef.current = ad;
    return () => {
      unsubLoaded();
      unsubClosed();
      unsubError();
    };
  }, []);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maybeShow = useCallback(() => {
    countRef.current += 1;
    if (countRef.current % showEveryNth === 0 && loaded && adRef.current) {
      adRef.current.show();
    }
  }, [loaded, showEveryNth]);

  return { maybeShow };
}
