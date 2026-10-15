const { AndroidConfig, withAndroidColors, withAndroidColorsNight, withAndroidStyles } = require('expo/config-plugins');

/**
 * Android's own dialogs and pickers (Alert, the date and time pickers) take
 * their button and header colour from the app theme's accent. Left unset it
 * is Material teal; this makes it the Ronda blue, and the dark theme's blue
 * in dark mode (both from src/theme/tokens.ts).
 */
const LIGHT = '#0D729E';
const DARK = '#47B0DD';

function withBrandAccent(config) {
  config = withAndroidColors(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'colorAccent', value: LIGHT });
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'colorPrimary', value: LIGHT });
    return c;
  });
  config = withAndroidColorsNight(config, (c) => {
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'colorAccent', value: DARK });
    c.modResults = AndroidConfig.Colors.assignColorValue(c.modResults, { name: 'colorPrimary', value: DARK });
    return c;
  });
  config = withAndroidStyles(config, (c) => {
    c.modResults = AndroidConfig.Styles.assignStylesValue(c.modResults, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: 'colorAccent',
      value: '@color/colorAccent',
    });
    return c;
  });
  return config;
}

module.exports = withBrandAccent;
