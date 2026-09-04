import type { CapacitorConfig } from "@capacitor/cli";

const liveUrl = process.env.TRUETURN_NATIVE_URL;

const config: CapacitorConfig = {
  appId: "com.backroadinc.trueturn",
  appName: "TrueTurn",
  webDir: "native/www",
  bundledWebRuntime: false,
  backgroundColor: "#090a0c",
  server: liveUrl
    ? { url: liveUrl, cleartext: false, androidScheme: "https" }
    : { androidScheme: "https" },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#090a0c",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#090a0c",
    },
    Keyboard: {
      resize: "body",
    },
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    scheme: "TrueTurn",
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#090a0c",
  },
};

export default config;
