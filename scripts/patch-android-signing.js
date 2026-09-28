// GitHub Actions CI icin: `expo prebuild`in urettigi android/app/build.gradle
// dosyasi her seferinde sifirdan, sadece debug keystore'uyla gelir (bkz.
// android-release-aab.yml). Bu script, GitHub Secrets'tan okunan gercek
// (Play Store) imzalama bilgilerini kullanan bir "release" signingConfig
// ekleyip "release" buildType'i ona yonlendirir.
//
// Ayri bir .js dosyasi olarak tutuluyor (workflow YAML'inin icine gomulu
// degil) cunku YAML'in "run: |" blok skalasi, icindeki her satirin blogun
// KENDI girinti seviyesinden AZ girintili olmamasini sart kosuyor -- bu JS
// kodunun urettigi Gradle metni (signingConfigs { debug { ... biciminde,
// dort/sekiz boslukla) YAML blogunun girintisinden daha az oldugu icin
// blok erken kapaniyor ve "invalid yaml syntax" hatasi veriyordu. Ayri
// dosyada bu kisit hic yok.

const fs = require('fs');
const path = 'android/app/build.gradle';
let c = fs.readFileSync(path, 'utf8');

const oldSigningConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const newSigningConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }`;

if (!c.includes(oldSigningConfigs)) {
  console.error('HATA: signingConfigs blogu beklenen formatta degil, yama uygulanamadi.');
  process.exit(1);
}
c = c.replace(oldSigningConfigs, newSigningConfigs);

const oldReleaseSigning = 'signingConfig signingConfigs.debug\n            shrinkResources';
const newReleaseSigning = 'signingConfig signingConfigs.release\n            shrinkResources';
if (!c.includes(oldReleaseSigning)) {
  console.error('HATA: release buildType blogu beklenen formatta degil, yama uygulanamadi.');
  process.exit(1);
}
c = c.replace(oldReleaseSigning, newReleaseSigning);

fs.writeFileSync(path, c);
console.log('build.gradle basariyla guncellendi (release imzalama eklendi).');
