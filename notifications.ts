// notifications.ts
// -----------------------------------------------------------------------
// Push bildirimleri (Expo push service). Profil ekranindaki "Anlık fırsat
// bildirimleri" anahtari acikken (bkz. Tercihler.tsx), backend fiyat
// alarmi hedefine ulasan veya tercih edilen magaza/kategoriden yeni urun
// eklenen durumlarda bu cihaza bildirim gonderir (bkz.
// backend/import_telegram_signals.js + backend/pushNotifications.js).
//
// KURULUM (bu dosyayi kullanabilmek icin):
//   npx expo install expo-notifications
// Native kod icerir -- Expo Go'da SINIRLI calisir (SDK 53+ Expo Go'da push
// bildirimleri tamamen kaldirildi), gercek cihazda/emulatorde test icin
// development build (`npx expo run:android` / EAS Build) gerekir.
//
// ONEMLI: getExpoPushTokenAsync bir EAS project ID gerektirir --
// app.json > extra.eas.projectId (EAS Build/`eas init` calistirildiginda
// otomatik yazilir). Bu alan yoksa jeton alinamaz, initNotifications()
// sessizce hicbir sey yapmadan cikar (uygulama cokmeden push'suz calismaya
// devam eder).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { registerPushToken } from './api';

// Uygulama on planda calisirken de bildirim gorunsun/ses calsin diye
// (varsayilanda sadece arka plandayken gosterilir). Modul yuklenir
// yuklenmez BIR KERE ayarlanmasi yeterli.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let initialized = false;

// App.tsx acilirken bir kere cagrilir (initAds() ile ayni desen -- bkz.
// ads.tsx). Izin ister, jetonu alir ve backend'e kaydeder. Herhangi bir
// adim basarisiz olursa (izin reddedildi, projectId yok, cihaz
// desteklemiyor, agdan istek atilamadi vb.) sessizce vazgecer.
export async function initNotifications() {
  if (initialized) return;
  initialized = true;
  if (Platform.OS === 'web') return; // web'de Expo push desteklenmiyor

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Fırsat bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return; // kullanici izin vermedi

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    if (!projectId) {
      console.warn('[notifications] app.json içinde extra.eas.projectId yok, push jetonu alınamadı.');
      return;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(tokenResponse.data);
  } catch {
    // Bildirim altyapisi basarisiz olursa uygulama sessizce push'suz devam
    // etmeli -- reklamlarda oldugu gibi (bkz. ads.tsx initAds()).
  }
}

// Tercihler.tsx'teki anahtar kapatilinca UI'da aninda tepki vermek icin
// (backend'e notificationsEnabled=false yazilir ama cihazdaki jeton izni
// geri alinmaz -- kullanici istediginde tekrar actiginda ayni jeton
// gecerliligini korur). Su an ekstra bir islem gerekmiyor, ama ileride
// "bildirimi kapatinca jetonu da sil" istenirse buraya eklenir.
export function useNotificationTapListener(onTap: (data: Record<string, any>) => void) {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      onTap(data as Record<string, any>);
    });
    return () => sub.remove();
  }, [onTap]);
}
