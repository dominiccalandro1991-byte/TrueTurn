# TrueTurn — store deploy pack

This folder is the paid-gate remaining work. The iOS and Android shells, bundle IDs, privacy policy, listing copy, and Capacitor sync scripts are already in the repo.

**You cannot submit until you pay:**

| Store | Account | Typical cost |
| --- | --- | --- |
| Apple App Store | Apple Developer Program | $99 / year |
| Google Play | Play Console | $25 one-time |

No code change is required for those accounts. When you have them:

1. Host the web API (Vercel / your domain). Set `TRUETURN_NATIVE_URL` to that HTTPS origin for live-server native builds, **or** run `npm run build && npm run native:sync` to bundle the last web build into the app.
2. Open Xcode: `npm run native:ios` — Team signing, archive, upload to App Store Connect using the copy in `store/ios/`.
3. Open Android Studio: `npm run native:android` — generate a Play upload key, build an AAB, upload using `store/android/`.
4. Attach `store/privacy-policy.md` as the public privacy URL (host it on your site first).

Bundle ID / application ID (locked): `com.backroadinc.trueturn`

Tokens and Diamonds stay **virtual club chips**. There is no cash-out, no real-money gambling, no IAP in this build.
