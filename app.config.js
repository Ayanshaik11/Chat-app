const app = require('./app.json');

module.exports = ({ config }) => ({
  ...config,
  ...app.expo,
  android: {
    ...config.android,
    ...app.expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      app.expo.android.googleServicesFile,
  },
});
