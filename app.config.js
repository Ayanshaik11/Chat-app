const app = require('./app.json');

module.exports = ({ config }) => ({
  ...app.expo,
  android: {
    ...app.expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ||
      app.expo.android.googleServicesFile,
  },
});
