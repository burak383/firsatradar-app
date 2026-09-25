// ads.web.tsx
// -----------------------------------------------------------------------
// `react-native-google-mobile-ads` native-only bir kutuphanedir, web
// derlemesinde hic bulunmaz. Metro bundler "./ads" import edildiginde web
// platformu icin bu dosyayi (".web.tsx" uzantisi sayesinde) otomatik
// olarak `ads.tsx` yerine secer -- boylece `npx expo start --web`
// bozulmaz, sadece web'de reklam gosterilmez (hicbir sey render edilmez/
// hicbir sey yapilmaz).
import { ViewStyle } from 'react-native';

export const USE_TEST_ADS = true;

export function initAds() {
  // Web'de AdMob altyapisi yok, yapilacak bir sey yok.
}

export function AdBanner(_props: { style?: ViewStyle }) {
  return null;
}

export function useInterstitialAd(_showEveryNth = 3) {
  return { maybeShow: () => {} };
}
