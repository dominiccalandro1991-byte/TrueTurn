/** Native-shell bootstrap. No-ops in the browser preview. */
export async function bootstrapNative(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
      import("@capacitor/status-bar"),
      import("@capacitor/splash-screen"),
    ]);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#090a0c" });
    await SplashScreen.hide();
  } catch {
    // Web / preview: Capacitor is optional.
  }
}
