const { withProjectBuildGradle } = require('@expo/config-plugins');

// firsatradar: react-native-google-mobile-ads'in getirdigi play-services-ads /
// kotlin-stdlib jar'lari Kotlin 2.1.0 metadata'siyla derlenmis, ama proje
// Kotlin 1.9.25 derleyicisi kullaniyor. Gradle bagimlilik cozumlemesi
// kotlin-stdlib:2.1.0'i TUM alt projelerin (dahil :app) classpath'ine
// tasiyor, bu da MainActivity.kt/MainApplication.kt derlemesini de
// bozuyor. Bu plugin, Kotlin'in kendi hata mesajinda onerdigi
// "-Xskip-metadata-version-check" bayragini TUM alt projelerin Kotlin
// derleme gorevlerine ekliyor (sadece react-native-google-mobile-ads
// modulune degil). `expo prebuild --clean` her calistiginda root
// android/build.gradle yeniden uretildigi icin bu ayar dogrudan orada
// elle tutulamiyor -- bu yuzden bir config plugin mod'u olarak
// uygulaniyor ki her prebuild'de otomatik olarak yeniden eklensin.

const MARKER = '// firsatradar: skip-metadata-version-check (kotlin-stdlib 2.1.0 vs compiler 1.9.x)';

module.exports = function withKotlinMetadataSkip(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withKotlinMetadataSkip: sadece Groovy android/build.gradle destekleniyor (bu proje Kotlin DSL kullanmiyor).'
      );
    }

    if (config.modResults.contents.includes(MARKER)) {
      return config;
    }

    config.modResults.contents += `
${MARKER}
allprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      freeCompilerArgs += ["-Xskip-metadata-version-check"]
    }
  }
}
`;

    return config;
  });
};
