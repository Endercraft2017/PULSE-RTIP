/* ============================================================
   Device Readiness — MIUI/OEM Onboarding for Reliable Push
   ============================================================
   Why this exists:
     FCM acceptance ≠ phone delivery. On MIUI/Xiaomi, autostart
     is OFF by default and the OEM battery saver kills background
     services minutes after the screen locks. The user has to flip
     these manually — Android offers no API to toggle them.

   What we can do:
     1. Pop the standard Android battery-optimization dialog
        (real "Allow" button, not just a settings page)
     2. Deep-link the user to MIUI Autostart
     3. Deep-link the user to MIUI per-app battery saver
     4. Deep-link to the OS notification settings as a recovery path

   We ask once, after push permission is granted. Skip is permanent
   for that device unless the user manually re-runs the prompt from
   a future Settings menu.
   ============================================================ */

(function () {
    'use strict';

    const DONE_KEY = 'pulse_device_readiness_done';
    // Per-step "user opened this settings screen" flags. MIUI Autostart and
    // Battery Saver can't be queried via any Android API, so we treat "user
    // tapped the button and came back" as evidence the step was completed.
    const STEP_DONE_PREFIX = 'pulse_dr_step_';

    function markStepDone(action) {
        try { localStorage.setItem(STEP_DONE_PREFIX + action, '1'); } catch (_) {}
    }
    function isStepDone(action) {
        try { return localStorage.getItem(STEP_DONE_PREFIX + action) === '1'; } catch (_) { return false; }
    }

    function plugin() {
        return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceSettings) || null;
    }

    function isNative() {
        return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    }

    async function getInfo() {
        const p = plugin();
        if (!p) return null;
        try { return await p.getInfo(); } catch (_) { return null; }
    }

    function alreadyOnboarded() {
        try { return localStorage.getItem(DONE_KEY) === '1'; } catch (_) { return false; }
    }

    function markOnboarded() {
        try { localStorage.setItem(DONE_KEY, '1'); } catch (_) {}
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function buildModal(info) {
        const isMiui = !!(info && info.isMiui);
        const batteryOk = !!(info && info.isIgnoringBatteryOptimizations);
        const brand = escapeHtml((info && (info.brand || info.manufacturer)) || 'your device');

        const autostartDone = isStepDone('autostart');
        const saverDone = isStepDone('battery-saver');
        const doneBadge = '<span style="color: var(--color-primary, #16A34A); margin-left: 6px;">✓ Done</span>';

        const miuiSteps = isMiui ? `
            <div class="modal__section">
                <div class="modal__section-label">
                    Step 2 — MIUI autostart
                    ${autostartDone ? doneBadge : ''}
                </div>
                <div class="modal__section-text">
                    Xiaomi/Redmi blocks background apps by default.
                    Tap below, then enable <strong>PULSE 911</strong> in the autostart list.
                </div>
                <button type="button" class="btn btn--outline btn--block" data-action="autostart"
                        style="margin-top: 10px;">
                    ${autostartDone ? 'Re-open MIUI Autostart' : 'Open MIUI Autostart'}
                </button>
            </div>
            <div class="modal__section">
                <div class="modal__section-label">
                    Step 3 — MIUI battery saver
                    ${saverDone ? doneBadge : ''}
                </div>
                <div class="modal__section-text">
                    Set <strong>PULSE 911</strong> to <em>No restrictions</em> so it can wake up
                    when an alert arrives.
                </div>
                <button type="button" class="btn btn--outline btn--block" data-action="battery-saver"
                        style="margin-top: 10px;">
                    ${saverDone ? 'Re-open Battery Settings' : 'Open Battery Settings'}
                </button>
            </div>
        ` : '';

        return `
            <div class="modal-overlay modal-overlay--open" id="device-readiness-overlay" role="dialog" aria-modal="true">
                <div class="modal" style="max-width: 480px;">
                    <div class="modal__header">
                        <div>
                            <h2 class="modal__title">Stay ready for emergency alerts</h2>
                            <div class="modal__section-text" style="margin-top: 4px;">
                                ${isMiui
                                    ? `${brand} blocks notifications aggressively. A few quick taps keep them flowing.`
                                    : 'Allow PULSE 911 to deliver alerts even when the app is closed.'}
                            </div>
                        </div>
                        <button type="button" class="modal__close" data-action="skip" aria-label="Skip">
                            <svg viewBox="0 0 24 24"><path d="M6 6L18 18M18 6L6 18"></path></svg>
                        </button>
                    </div>
                    <div class="modal__body">
                        <div class="modal__section">
                            <div class="modal__section-label">
                                Step 1 — Battery optimization
                                ${batteryOk ? '<span style="color: var(--color-primary, #16A34A); margin-left: 6px;">✓ Done</span>' : ''}
                            </div>
                            <div class="modal__section-text">
                                ${batteryOk
                                    ? 'PULSE 911 is already exempt from Android battery optimization.'
                                    : 'Tap below and choose <strong>Allow</strong> on the system prompt.'}
                            </div>
                            ${batteryOk ? '' : `
                                <button type="button" class="btn btn--primary btn--block" data-action="battery-opt"
                                        style="margin-top: 10px;">
                                    Allow background activity
                                </button>
                            `}
                        </div>
                        ${miuiSteps}
                    </div>
                    <div class="modal__footer">
                        <button type="button" class="btn btn--outline" data-action="skip">Skip</button>
                        <button type="button" class="btn btn--primary" data-action="done">I'm done</button>
                    </div>
                </div>
            </div>
        `;
    }

    async function show(info) {
        let currentInfo = info;
        const host = document.createElement('div');
        host.innerHTML = buildModal(currentInfo);
        let overlay = host.firstElementChild;
        document.body.appendChild(overlay);

        const close = () => { try { overlay.remove(); } catch (_) {} };
        const rerender = () => {
            const next = document.createElement('div');
            next.innerHTML = buildModal(currentInfo);
            const newOverlay = next.firstElementChild;
            overlay.replaceWith(newOverlay);
            overlay = newOverlay;
        };

        // When the user returns from a settings screen, re-fetch the live
        // battery-optimization state (Step 1 is the only step Android lets
        // us actually verify) and re-render so all newly-completed steps
        // pick up their ✓ Done badges.
        const onVisible = async () => {
            if (document.visibilityState !== 'visible' || !document.body.contains(overlay)) return;
            const fresh = await getInfo();
            if (fresh) currentInfo = fresh;
            rerender();
        };
        document.addEventListener('visibilitychange', onVisible);
        const cleanup = () => document.removeEventListener('visibilitychange', onVisible);

        document.body.addEventListener('click', async function handler(ev) {
            if (!document.body.contains(overlay)) {
                document.body.removeEventListener('click', handler);
                cleanup();
                return;
            }
            const btn = ev.target.closest('[data-action]');
            if (!btn || !overlay.contains(btn)) return;
            const action = btn.dataset.action;
            const p = plugin();

            if (action === 'skip' || action === 'done') {
                markOnboarded();
                close();
                cleanup();
                document.body.removeEventListener('click', handler);
                return;
            }
            if (!p) return;

            try {
                if (action === 'battery-opt') {
                    await p.requestIgnoreBatteryOptimizations();
                } else if (action === 'autostart') {
                    await p.openAutostartSettings();
                    markStepDone('autostart');
                } else if (action === 'battery-saver') {
                    await p.openBatterySaverSettings();
                    markStepDone('battery-saver');
                } else if (action === 'notifications') {
                    await p.openAppNotificationSettings();
                }
                // Re-render in case the user comes right back without ever
                // backgrounding the app (visibilitychange wouldn't fire then).
                rerender();
            } catch (e) {
                console.warn('[device-readiness] action failed:', action, e && e.message);
            }
        });
    }

    const DeviceReadiness = {
        /**
         * Run after push permission is granted. No-op if:
         *  - not on a Capacitor native build
         *  - the user already completed/skipped onboarding
         *  - the native plugin isn't on the bridge (older APK)
         */
        async ensureOnce() {
            if (!isNative()) return;
            if (alreadyOnboarded()) return;
            const info = await getInfo();
            if (!info) return;

            // If everything's already optimal AND not on MIUI, no need to nag.
            if (info.isIgnoringBatteryOptimizations && !info.isMiui) {
                markOnboarded();
                return;
            }
            show(info);
        },

        /**
         * Force-show the modal — wire this from a future "push troubleshooting"
         * button in Settings without losing the onboarding logic.
         */
        async showNow() {
            if (!isNative()) return;
            const info = await getInfo();
            if (!info) return;
            show(info);
        },

        async openNotificationSettings() {
            const p = plugin();
            if (!p) return;
            try { await p.openAppNotificationSettings(); } catch (_) {}
        },
    };

    window.DeviceReadiness = DeviceReadiness;
})();
