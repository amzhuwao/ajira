# Ajira Android companion (native)

Flutter native app for [https://ajira.online](https://ajira.online) — not a WebView shell.

- **Package ID:** `online.ajira.app`
- **API:** `https://ajira.online/api/mobile/v1`
- **Min SDK:** 24 · **Target SDK:** 35

## Features (v2)

- Email/password auth with Bearer JWT
- Role home (buyer / seller / admin)
- Projects, bids, browse, messages, wallet
- Escrow funding via Paynow **in-app browser** (Custom Tabs) or Ecocash/OneMoney poll
- Notifications + profile entry points

## Local develop

```bash
cd android-app
flutter pub get
flutter run --dart-define=API_BASE=https://ajira.online
```

## Build on the droplet

```bash
./android-app/scripts/build-on-droplet.sh
```

Publishes: [https://ajira.online/app/ajira.apk](https://ajira.online/app/ajira.apk)
