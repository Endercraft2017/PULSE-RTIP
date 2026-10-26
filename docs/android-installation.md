# Android installation and map tiles

The application requires Android 7/API 24 or newer and targets Android 16/API 36.
Android 16 itself is supported. A blank installer window is different from an
installed app opening to a blank screen; collect the exact stage and Android
Package Installer/logcat error before declaring either fixed.

## Signing and updates

The earlier GitHub Actions builds generated a fresh debug certificate per run,
while retaining package `com.mdrrmo.pulse911` and version code 1. Certificates
from releases `f930d96`, `07a523e` and `05ae088` differ. Android cannot update an
installed package with an unrelated signer. A valid APK signature proves file
integrity, not compatibility with the certificate on a user's phone.

Do not uninstall an existing app with unsynced reports to work around this.
An in-place update requires its original signing key. Previously discarded CI
keys cannot be recovered from an APK or replaced by increasing versionCode.

The optional `-PpulseSideBySide=true` debug build installs as
`com.mdrrmo.pulse911.preview`, labelled **PULSE 911 Preview**, preserving the
original app. It needs a separate login and does not migrate unsynced data.
Firebase push is unavailable in Preview because the production Firebase Android
registration belongs to the original package; Preview skips native push setup.

Future automated builds require repository secret `ANDROID_DEBUG_KEYSTORE_BASE64`.
The keystore must contain alias `androiddebugkey`, with store and key passwords
`android`. This is a test signing identity, not a production signing setup.
Use the SAME privately retained key for subsequent builds. To retain compatibility
with a locally built Preview APK, use that build's original keystore rather than
generating another one. Keep an independent secure backup.

Configure it in GitHub → Settings → Secrets and variables → Actions → New
repository secret. Encode a keystore file on the owner's machine, without
posting its contents in chat or committing it:

```sh
base64 -w 0 debug.keystore > debug-keystore-base64.txt
gh secret set ANDROID_DEBUG_KEYSTORE_BASE64 --repo Endercraft2017/PULSE-RTIP < debug-keystore-base64.txt
```

The current integration returned HTTP 403 when accessing Actions secrets, so a
repository owner must perform this configuration. The build now stops instead
of silently publishing another random signer. `pulseVersionCode` allows CI to
increase Android version codes. A separate local build may pass
`-PpulseDebugKeystore=/private/path/debug.keystore`.

The publisher also accepts an optional `prebuilt_ref` pointing to an
`apk-staging-*` branch with only a signed `app-debug.apk` and `build-info.json`
(source commit and APK SHA-256). This publishes a locally signed build without
sending a private key to GitHub. Actions verifies its signature, checksum,
package ID and bundled frontend against the specified source commit. Delete the
temporary staging branch after publication. This does not configure the signing
secret needed for future builds on GitHub's runners.

## OpenStreetMap policy

The server previously emitted Helmet's default `Referrer-Policy: no-referrer`.
This violates the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
for websites and can cause HTTP 403 block tiles. Web pages, server headers and
individual tile images now use `strict-origin-when-cross-origin`. Cross-origin
requests identify the website origin without exposing incident paths, queries
or authorization headers. Native WebView requests append the honest application
identifier `PULSE911/1.0 (+https://pulse.afkcube.com)`.

No proxy, alternate hostname, cache-busting or provider rotation is used to
evade blocks. Attribution remains visible and normal browser caching remains
enabled. A sampled identified live tile request returned HTTP 200; that does not
prove a block on a particular user's network has already been lifted.

## Verification for the corrective build

57 Playwright checks and 35 backend checks passed. The browser suite captures
tile request headers and verifies the origin-only referrer and absence of auth
headers. A Preview native-bridge test verifies Firebase registration is skipped.
External tiles are stubbed in the regression suite; the separate real tile probe
is recorded in `/tmp/pulse-osm-real-tile-headers.txt`.

Startup shows a loading message and bounds saved-session restoration to eight
seconds. A stalled request proceeds to login while preserving the saved token;
a regression test holds the request open and verifies that behavior.

APK checks include signature/certificate comparison, Android manifest package and
SDK metadata, ZIP alignment for 16 KB pages, ARM64 ELF segment alignment and
bundled map assets. No physical Android 16 device is attached to this workspace;
these checks do not reproduce the phone's white screen or prove installation.
