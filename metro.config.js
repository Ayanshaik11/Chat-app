const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK needs .cjs support
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Termux/Android: reduce filesystem watcher pressure
config.resolver.blockList = [
  /node_modules\/.*\/android\/.*$/,
  /node_modules\/.*\/ios\/.*$/,
];

module.exports = config;