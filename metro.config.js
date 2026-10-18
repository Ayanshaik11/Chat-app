const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK needs .cjs support
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Exclude native source trees and backend dependencies from resolution
config.resolver.blockList = [
  /node_modules\/.*\/android\/.*$/,
  /node_modules\/.*\/ios\/.*$/,
  /node_modules\/.*\/ReactAndroid\/.*$/,
  new RegExp(
    path.join(__dirname, 'Proxy-API', 'node_modules')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      + '[/\\\\].*'
  ),
];

module.exports = config;
