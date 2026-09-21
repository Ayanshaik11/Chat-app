const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Firebase JS SDK needs .cjs support on Metro
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
