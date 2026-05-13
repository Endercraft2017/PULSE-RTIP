# PULSE-RTIP — Owner TODO

Things that need YOU (not me) to complete, because they require credentials,
assets, DNS, or accounts I can't create for you. None of these block the
rest of the app — every item below has a working default until you swap in
the real thing.

**Last updated:** 2026-04-25

---

## 1. Fill in the team roster

See [TEAM-ROSTER.md](./TEAM-ROSTER.md). Fill in the fields, save, and tell
me — I'll regenerate the JSON the About Us screen reads from.

**Until you do:** About Us shows "PULSE 911 team" as a placeholder.

---

## 2. Provide the app icon

The Android launcher icon lives at:

```
android/app/src/main/res/mipmap-mdpi/ic_launcher.png        48×48
android/app/src/main/res/mipmap-hdpi/ic_launcher.png        72×72
android/app/src/main/res/mipmap-xhdpi/ic_launcher.png       96×96
android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png      144×144
android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png     192×192
```

Plus the round / foreground variants in the same folders
(`ic_launcher_round.png`, `ic_launcher_foreground.png`).

Web/PWA icons:

```
src/frontend/public/assets/icons/favicon.ico
src/frontend/public/assets/icons/favicon-16.png
src/frontend/public/assets/icons/favicon-32.png
src/frontend/public/assets/icons/favicon-48.png
src/frontend/public/assets/icons/apple-touch-icon.png     180×180
src/frontend/public/assets/icons/icon-192.png             192×192  (PWA manifest)
src/frontend/public/assets/icons/icon-512.png             512×512  (PWA manifest)
```

### Easy way (recommended)

1. Give me a **single 1024×1024 PNG** of your final logo (transparent or solid bg — up to you).
2. I'll use **[@capacitor/assets](https://github.com/ionic-team/capacitor-assets)** to generate every size automatically and swap them in.
3. After that, the APK will need a rebuild (I'll do that too).

### Manual way (if you already have the sized PNGs)

1. Drop each PNG in the exact path + size listed above. Keep the filename the same.
2. Also replace the `favicon.ico` (can be generated from the 48px PNG at <https://favicon.io/favicon-converter/>).
3. Ping me — I'll rebuild the APK and re-sync the webroot.

**Until you do:** current icons stay in place.

---

## 3. Firebase Cloud Messaging (push notifications)

Push notifications require a Firebase project. Free tier is unlimited for
messaging. The code is already wired — it just needs your credentials.

### Steps (≈10 minutes)

1. Go to <https://console.firebase.google.com/> and sign in with a Google account.
2. Click **"Add project"**. Name it **PULSE 911** (or similar). Disable Google Analytics when it asks — not needed for FCM.
3. Once the project is created, click the **Android icon** to add an Android app:
   - Package name: `com.mdrrmo.pulse911` (must match `capacitor.config.ts` exactly)
   - App nickname: `PULSE 911`
   - SHA-1: skip for now
4. Firebase will give you a **`google-services.json`** file — **download it**.
5. Place the file here:

   ```
   android/app/google-services.json
   ```

6. Under Firebase Console → **Project settings (gear icon)** → **Cloud Messaging** tab → copy the **Server key** (aka FCM Legacy server key). You may need to enable Cloud Messaging API (Legacy) in the tab — follow the "Manage API" link.
7. Paste the server key into `/opt/PULSE-RTIP/.env` on the production server:

   ```env
   FCM_SERVER_KEY=AAAA...your_key_here
   ```

8. Ping me — I'll restart the backend and rebuild the APK so the new `google-services.json` is bundled.

**Until you do:** push notifications silently no-op. SMS alerts continue to work (they use TextBee, independently).

---

## 4. TextBee SMS — daily limit and SIM load

The TextBee free tier allows **50 SMS/day, 300/month**. As of 2026-04-22 we
used the full daily allocation during testing. Two actions you may want to take:

### (a) Keep the free tier (for thesis demo)

- Just mind the quota. Every send-OTP, forgot-password, approval, hazard broadcast, etc. counts.
- Daily cap resets at **00:00 UTC** (08:00 PH time).

### (b) Upgrade (for real MDRRMO deployment)

- Log into <https://textbee.dev> with the account that owns API key `41aa3301-51e1-46e2-a3c6-258edbdec9cd`.
- Pick a paid plan — their cheapest tier lifts the daily cap.
- No code change needed — same API key, same device ID.

### (c) Gateway SIM load

The gateway SIM is **09122078435 (TNT / Smart)** on the Infinix X687 at the MDRRMO office. If the SIM has no load or no active SMS promo, **every send counts as a successful API handoff but fails silently at the carrier**. If an admin is testing SMS delivery and nothing arrives:

1. Check the SIM balance: dial `*123#` on the gateway phone, or text `STATUS` to 214.
2. Activate an unli-SMS promo (e.g. `UTP10`, `AST15`, or any current Smart promo).
3. Verify the TextBee Android app is foregrounded and the phone is not in battery-saver mode.

---

## 5. Production outbound email (Brevo or similar)

Right now approval / rejection emails log to stdout on the server instead
of actually sending, because `SMTP_HOST` isn't set. SMS still goes through.

### Steps (≈30 min including DNS propagation)

1. Sign up at <https://www.brevo.com> (free tier, 300/day, no credit card).
2. **Domains** → **Authenticate domain** → enter `afkcube.com` → Brevo gives you 3 TXT records (SPF, DKIM, DMARC).
3. Add those TXT records at your DNS provider for `afkcube.com`. Propagation is usually 5–30 min.
4. **SMTP & API** → **SMTP** tab → click **"Generate a new SMTP key"** → copy the key.
5. On the production server, edit `/opt/PULSE-RTIP/.env` and add:

   ```env
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<your Brevo login email>
   SMTP_PASS=<the SMTP key you just generated>
   SMTP_FROM=PULSE 911 <noreply@afkcube.com>
   ```

6. Restart:

   ```bash
   ssh -i ~/kali_openclaw root@76.13.215.54 "pm2 restart pulse-rtip-api"
   ```

7. Test: approve or reject a pending signup from the admin panel. The user should receive a real email.

**Until you do:** emails are only logged to the pm2 log on the server. Approval flow still "works" — just no actual email is sent.

---

## 6. Barangay list for audience-scoped alerts

The signup form and hazard audience selector need the canonical list of
Morong, Rizal barangays. I've pre-populated it with the official list
(public data), but please confirm or correct it:

```
1.  Bombongan
2.  Caingin
3.  Can-Cal-Lay
4.  Cuasay
5.  Lagundi
6.  Maybancal
7.  Poblacion
8.  San Guillermo
9.  San Jose
10. San Juan
11. San Pedro
```

**If any are wrong or missing:** edit [`src/frontend/public/js/utils/barangays.js`](../src/frontend/public/js/utils/barangays.js) (the file I'll be creating). Also update `src/database/migrations/018_add_barangay_to_users.sql` if the allowed values need to change.

---

## 7. Deferred clarifications (medium priority)

These are open items from your instruction list that I'm leaving as-is
pending your guidance:

- **U-3 (post detail reason):** kept as "details" for now. When you clarify whether this should be a moderation reason, an incident reason, or something else, I'll wire it up.
- **Admin items 1–3:** were missing from the original instruction file. If you remember what they were, send them over.

---

## Status once everything above is done

- App icon replaced → APK rebuilt and deployed
- Firebase wired → push notifications actually fire
- Brevo wired → approval/rejection emails actually send
- Barangay list confirmed → signup + audience targeting working with real data
- Team roster filled → About Us shows real names

None of these are blockers for the thesis demo with placeholder data. Tackle
them at your own pace.
