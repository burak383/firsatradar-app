// withPodsDeploymentTarget.js
//
// Yeni Xcode surumleri iOS 15'ten dusuk IPHONEOS_DEPLOYMENT_TARGET'a sahip Pod
// hedeflerini (ör. Google-Mobile-Ads-SDK resource bundle: 12.0,
// RNCAsyncStorage resource bundle: 13.4) hata olarak reddediyor
// ("range of supported deployment target versions is 15.0 to ...").
//
// Bu plugin, `expo prebuild` sirasinda uretilen Podfile'in post_install
// blogunun BASINA, hedefi 15.0'dan dusuk olan tum Pod hedeflerini 15.1'e
// yukselten bir dongu ekler. Tekrar calistirilsa da cift eklemez.
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [withPodsDeploymentTarget]';
const MIN_TARGET = '15.1';

const SNIPPET = `
    ${MARKER} dusuk deployment target'li Pod hedeflerini yukselt
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < 15.0
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
        end
      end
    end
`;

module.exports = function withPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (podfile.includes(MARKER)) return cfg;

      const re = /post_install do \|installer\|\s*\n/;
      if (!re.test(podfile)) {
        console.warn('[withPodsDeploymentTarget] Podfile icinde post_install bulunamadi, atlandi.');
        return cfg;
      }
      podfile = podfile.replace(re, (m) => m + SNIPPET);
      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
