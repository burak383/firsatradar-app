// Giris.tsx
// -----------------------------------------------------------------------
// E-posta + sifre ile giris/kayit ekrani. App.tsx'te Urun Detayi ile ayni
// "ust katman" (overlay) mantigiyla acilir -- Profil ekranindaki "Giriş
// yap" butonuna dokunulunca gosterilir, basariyla kapanir.
//
// Giris yapmadan da uygulama kullanilabilir (misafir/cihaz bazli alarmlar
// calismaya devam eder, bkz. api.ts) -- bu yuzden zorunlu bir "giris
// duvari" degil, istege bagli bir hesap secenegi.
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors, fonts } from './theme';
import { login, register, appleLogin, AuthUser } from './api';

type Mode = 'login' | 'register';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen({
  onClose,
  onAuthed,
}: {
  onClose: () => void;
  onAuthed: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const isRegister = mode === 'register';

  // "Sign in with Apple" sadece iOS'ta (ve gercekten destekleniyorsa)
  // gosterilir -- Android/web'de buton hic render edilmez.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const submitWithApple = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple kimlik jetonu alınamadı, tekrar dene.');
      }
      const { user } = await appleLogin(credential.identityToken);
      onAuthed(user);
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        // kullanici Apple dialogundan vazgecti -- sessizce devam
      } else {
        setError(e?.message || 'Apple ile giriş başarısız oldu, tekrar dene.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) return 'Geçerli bir e-posta adresi gir.';
    if (password.length < 6) return 'Şifre en az 6 karakter olmalı.';
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const { user } = isRegister
        ? await register(trimmedEmail, password)
        : await login(trimmedEmail, password);
      onAuthed(user);
    } catch (e: any) {
      setError(e?.message || 'Bir şeyler ters gitti, tekrar dene.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setError(null);
    setMode(isRegister ? 'login' : 'register');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable hitSlop={10} onPress={onClose} style={styles.backButton}>
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={styles.eyebrow}>FırsatRadar</Text>
          <Text style={styles.title}>{isRegister ? 'Hesap oluştur' : 'Giriş yap'}</Text>
          <Text style={styles.subtitle}>
            {isRegister
              ? 'Alarmların ve tercihlerin hesabına kaydedilsin, hangi cihazdan girersen gir seni bulsun.'
              : 'Tekrar hoş geldin — alarmlarına buradan devam et.'}
          </Text>

          {appleAvailable ? (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={14}
                style={styles.appleButton}
                onPress={submitWithApple}
              />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya e-posta ile</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@eposta.com"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!submitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isRegister ? 'newPassword' : 'password'}
              editable={!submitting}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitButtonText}>{isRegister ? 'Hesap oluştur' : 'Giriş yap'}</Text>
            )}
          </Pressable>

          <Pressable style={styles.switchModeButton} onPress={switchMode} disabled={submitting}>
            <Text style={styles.switchModeText}>
              {isRegister ? 'Zaten hesabın var mı? Giriş yap' : 'Hesabın yok mu? Hemen oluştur'}
            </Text>
          </Pressable>

          <Text style={styles.guestHint}>
            Giriş yapmadan da göz atabilirsin — bu durumda alarmların sadece bu cihazda saklanır.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 20, paddingTop: 8, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', marginBottom: 12 },
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
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 12,
  },
  title: {
    marginTop: 6,
    color: colors.foreground,
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 10,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  appleButton: {
    marginTop: 24,
    height: 52,
    width: '100%',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  field: { marginTop: 22 },
  label: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  error: {
    marginTop: 16,
    color: colors.destructive,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 24,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '700',
  },
  switchModeButton: { marginTop: 18, alignItems: 'center' },
  switchModeText: {
    color: colors.accent,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  guestHint: {
    marginTop: 28,
    color: colors.mutedForeground,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
