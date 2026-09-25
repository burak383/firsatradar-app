// api.ts
// FırsatRadar backend'i (bkz. backend/) icin kucuk bir fetch istemcisi.
//
// ONEMLI (cihaz/emulator agi): "localhost" sadece web/iOS simulator'de
// calisir. Android emulator'de 10.0.2.2, gercek cihazda ise bilgisayarinizin
// yerel agdaki IP adresini (ornek: 192.168.1.23) kullanmaniz gerekir.
// Expo icin en kolayi: `.env` yerine asagidaki degeri ortama gore elle
// degistirmek, ya da app.config.js uzerinden process.env.EXPO_PUBLIC_API_URL
// gecirmek.
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL =
  (typeof process !== 'undefined' && (process as any)?.env?.EXPO_PUBLIC_API_URL) ||
  'https://firsatradar-render.onrender.com/api';

export type Deal = {
  id: number;
  title: string;
  brand: string | null;
  category: string;
  store: string;
  storeLabel: string;
  storeLetter: string;
  storeUrl: string;
  imageUrl: string | null;
  currentPrice: number;
  oldPrice: number | null;
  currency: string;
  discountPercent: number | null;
  stockStatus: 'in_stock' | 'limited' | 'out_of_stock';
  isFlashDeal: boolean;
  flashDealEndsAt: string | null;
  isLowest30d: boolean;
  followCount: number;
  verifiedMinutesAgo: number | null;
};

export type DealDetail = Deal & {
  couponCode: string | null;
  priceHistory: { price: number; checkedAt: string }[];
  activeAlarmCount: number;
};

export type Category = {
  slug: string;
  title: string;
  icon: string;
  count: number;
};

export type Alarm = {
  id: number;
  productId: number;
  targetPrice: number | null;
  active: boolean;
  createdAt: string;
  deal: Deal | null;
  dropText: string | null;
};

export type SearchResult = {
  query: string;
  resultCount: number;
  primary: DealDetail | null;
  comparisons: Deal[];
};

export type AuthUser = {
  id: number;
  email: string;
};

export type Preferences = {
  stores: string[];
  categories: string[];
  notificationsEnabled: boolean;
};

// Cihaza ozgu, kalici bir kimlik: alarmlarin HERKESTE degil sadece bu
// kurulumda gorunmesi icin gerekli. Onceden butun istekler sabit
// 'demo-device' degeriyle gidiyordu -- yani uygulamayi kuran HERKES ayni
// alarm listesini paylasiyor, birbirinin alarmini gorup silebiliyordu.
// Burada ilk acilista rastgele bir id uretilip cihazda (AsyncStorage)
// saklaniyor; sonraki tum istekler bunu kullanir.
const DEVICE_ID_KEY = 'fr_device_id';
let cachedDeviceId: string | null = null;

function generateDeviceId(): string {
  const rand = () => Math.random().toString(16).slice(2);
  return `dev-${Date.now().toString(16)}-${rand()}-${rand()}`;
}

async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      cachedDeviceId = stored;
      return stored;
    }
    const fresh = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cachedDeviceId = fresh;
    return fresh;
  } catch {
    // AsyncStorage cok nadir bir durumda basarisiz olursa bile uygulama
    // 'demo-device' gibi HERKESTE ortak bir id'ye dusmesin diye en azindan
    // bu oturum icin rastgele bir id kullanmaya devam eder.
    if (!cachedDeviceId) cachedDeviceId = generateDeviceId();
    return cachedDeviceId;
  }
}

// Giris/kayit sonrasi alinan JWT ve kullanici bilgisi cihazda saklanir --
// boylece uygulama her acildiginda tekrar giris istemez. `request()`
// asagida bunu her istege otomatik olarak Authorization basligi olarak
// ekler (varsa); Giris.tsx ya da api.ts disinda hicbir ekranin bu detayi
// bilmesine gerek yok.
const AUTH_TOKEN_KEY = 'fr_auth_token';
const AUTH_USER_KEY = 'fr_auth_user';

let cachedAuthToken: string | null | undefined; // undefined = henuz yuklenmedi
let cachedAuthUser: AuthUser | null = null;

async function loadAuthFromStorage(): Promise<void> {
  if (cachedAuthToken !== undefined) return;
  try {
    const [token, userJson] = await Promise.all([
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_USER_KEY),
    ]);
    cachedAuthToken = token;
    cachedAuthUser = userJson ? JSON.parse(userJson) : null;
  } catch {
    cachedAuthToken = null;
    cachedAuthUser = null;
  }
}

async function persistAuth(token: string, user: AuthUser): Promise<void> {
  cachedAuthToken = token;
  cachedAuthUser = user;
  try {
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, token],
      [AUTH_USER_KEY, JSON.stringify(user)],
    ]);
  } catch {
    // Saklama basarisiz olsa bile bu oturum icin bellekte tutmaya devam
    // ediyoruz -- kullanici uygulamayi kapatip acana kadar giris kalir.
  }
}

// GET /api/auth/me ile sunucudan dogrulanmis, guncel kullanici bilgisi.
export function getCurrentUser(): Promise<AuthUser | null> {
  return loadAuthFromStorage().then(() => cachedAuthUser);
}

export async function logout(): Promise<void> {
  cachedAuthToken = null;
  cachedAuthUser = null;
  try {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  } catch {
    // yerel saklamadan silinemese bile bellekteki oturum zaten temizlendi
  }
}

export async function register(email: string, password: string): Promise<{ user: AuthUser }> {
  const deviceId = await getDeviceId();
  const result = await request<{ token: string; user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, deviceId }),
  });
  await persistAuth(result.token, result.user);
  return { user: result.user };
}

export async function login(email: string, password: string): Promise<{ user: AuthUser }> {
  const deviceId = await getDeviceId();
  const result = await request<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, deviceId }),
  });
  await persistAuth(result.token, result.user);
  return { user: result.user };
}

// Apple ile giris: expo-apple-authentication'dan gelen "identityToken"
// (imzali JWT) sunucuya gonderilir, sunucu Apple'in genel anahtarlariyla
// dogrular (bkz. backend/routes/auth.js, POST /auth/apple). Burada
// istemci tarafinda ekstra bir dogrulama YOK -- guven sunucu tarafinda.
export async function appleLogin(identityToken: string): Promise<{ user: AuthUser }> {
  const deviceId = await getDeviceId();
  const result = await request<{ token: string; user: AuthUser }>('/auth/apple', {
    method: 'POST',
    body: JSON.stringify({ identityToken, deviceId }),
  });
  await persistAuth(result.token, result.user);
  return { user: result.user };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  await loadAuthFromStorage();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cachedAuthToken) headers.Authorization = `Bearer ${cachedAuthToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...((options?.headers as Record<string, string>) || {}) },
  });
  if (!res.ok) {
    let message = `İstek başarısız oldu (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // yanit govdesi yoksa/JSON degilse varsayilan mesaji kullan
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getDeals(params?: {
  category?: string;
  store?: string;
  sort?: 'discount' | 'price-asc' | 'price-desc' | 'newest' | 'followers';
  limit?: number;
}): Promise<{ deals: Deal[]; totalScanned: number }> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.store) qs.set('store', params.store);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request(`/deals${suffix}`);
}

export function getFeaturedDeal(): Promise<{ deal: DealDetail | null }> {
  return request('/deals/featured');
}

export function getFlashDeal(): Promise<{ deal: DealDetail | null }> {
  return request('/deals/flash');
}

export function getDealDetail(id: number): Promise<{ deal: DealDetail }> {
  return request(`/deals/${id}`);
}

export function getCategories(): Promise<{ categories: Category[] }> {
  return request('/categories');
}

export function search(query: string): Promise<SearchResult> {
  return request(`/search?q=${encodeURIComponent(query)}`);
}

export async function getAlarms(): Promise<{
  alarms: Alarm[];
  summary: { trackedCount: number; potentialSavings: number };
}> {
  const deviceId = await getDeviceId();
  return request(`/alarms?device=${encodeURIComponent(deviceId)}`);
}

export async function createAlarm(input: {
  productId: number;
  targetPrice?: number;
}): Promise<{ alarm: Alarm }> {
  const deviceId = await getDeviceId();
  return request('/alarms', { method: 'POST', body: JSON.stringify({ ...input, deviceId }) });
}

export function updateAlarm(
  id: number,
  patch: { active?: boolean; targetPrice?: number }
): Promise<{ alarm: Alarm }> {
  return request(`/alarms/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function deleteAlarm(id: number): Promise<void> {
  return request(`/alarms/${id}`, { method: 'DELETE' });
}

// Profil ekranindaki "Tercihler": takip edilen pazaryerleri, ilgi alani
// kategorileri, anlik bildirim tercihi (bkz. backend/routes/preferences.js,
// Tercihler.tsx). Giris yapmamis kullanicida cihaz bazli, giris yapmista
// hesaba bagli calisir -- alarms.js ile ayni desen (bkz. request()'in
// otomatik Authorization basligi eklemesi).
export async function getPreferences(): Promise<Preferences> {
  const deviceId = await getDeviceId();
  const { preferences } = await request<{ preferences: Preferences }>(
    `/preferences?device=${encodeURIComponent(deviceId)}`
  );
  return preferences;
}

export async function updatePreferences(
  patch: Partial<Preferences>
): Promise<Preferences> {
  const deviceId = await getDeviceId();
  const { preferences } = await request<{ preferences: Preferences }>('/preferences', {
    method: 'PUT',
    body: JSON.stringify({ ...patch, deviceId }),
  });
  return preferences;
}

// Push bildirim jetonunu (Expo push token) backend'e kaydeder -- bkz.
// notifications.ts (initNotifications) ve backend/routes/push-tokens.js.
// Giris yapmissa jeton otomatik olarak hesaba (user_id), yapmamissa cihaza
// (device_id) baglanir -- request()'in ekledigi Authorization basligi
// uzerinden backend bunu kendisi ayirt eder.
export async function registerPushToken(token: string): Promise<void> {
  const deviceId = await getDeviceId();
  await request<void>('/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, deviceId }),
  });
}

// --- Bicimlendirme yardimcilari -------------------------------------------

export function formatPrice(amount: number | null | undefined, currency = 'TRY'): string {
  if (amount == null) return '—';
  const symbol = currency === 'TRY' ? '₺' : currency;
  return `${symbol}${Math.round(amount).toLocaleString('tr-TR')}`;
}

export function formatDiscount(percent: number | null | undefined): string {
  if (percent == null) return '';
  return `-%${percent}`;
}

export function msUntil(isoString: string | null | undefined): number {
  if (!isoString) return 0;
  return Math.max(0, new Date(isoString).getTime() - Date.now());
}

export function formatCountdown(ms: number): { hh: string; mm: string; ss: string } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { hh: pad(hh), mm: pad(mm), ss: pad(ss) };
}
