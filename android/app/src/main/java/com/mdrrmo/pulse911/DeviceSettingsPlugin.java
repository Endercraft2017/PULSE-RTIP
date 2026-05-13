package com.mdrrmo.pulse911;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the JS layer to Android settings screens that are required for
 * reliable FCM delivery on aggressive OEM skins (chiefly MIUI/Xiaomi).
 *
 * Nothing here actually toggles a setting — Android does not expose APIs
 * for autostart or OEM background restrictions. We deep-link the user to
 * the right screen with one tap. The standard battery-optimization request
 * is the lone exception: it shows a real OS dialog with an "Allow" button.
 */
@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        Context ctx = getContext();
        JSObject ret = new JSObject();
        ret.put("manufacturer", String.valueOf(Build.MANUFACTURER).toLowerCase());
        ret.put("brand", String.valueOf(Build.BRAND).toLowerCase());
        ret.put("isMiui", isMiuiDevice());
        ret.put("isIgnoringBatteryOptimizations", isIgnoringBatteryOptimizations(ctx));
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    /**
     * Pops the standard system "Allow this app to ignore battery optimizations?"
     * dialog. This is the only setting we can request via a real OS prompt;
     * everything else is a deep link.
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        if (isIgnoringBatteryOptimizations(ctx)) {
            JSObject ret = new JSObject();
            ret.put("alreadyExempt", true);
            call.resolve(ret);
            return;
        }
        // Preferred: the per-app "Allow this app to ignore..." system dialog.
        // Needs the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS permission in the
        // manifest, otherwise some OEM skins (Infinix XOS, etc.) silently
        // refuse to launch the activity.
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
            return;
        } catch (Exception ignored) { /* try fallback below */ }

        // Fallback: the system battery-optimization LIST. User finds PULSE 911
        // in the list, taps it, and chooses "Don't optimize". One extra tap
        // but works without the permission.
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            JSObject ret = new JSObject();
            ret.put("fallback", "list");
            call.resolve(ret);
            return;
        } catch (Exception ignored) { /* fall through to app details */ }

        // Last resort: the app-info screen, where the user can find the
        // "Battery" → "Unrestricted" option.
        if (openAppDetailsFallback()) {
            JSObject ret = new JSObject();
            ret.put("fallback", "appDetails");
            call.resolve(ret);
            return;
        }
        call.reject("Failed to open any battery optimization screen");
    }

    /**
     * MIUI Autostart Manager. The component name is undocumented and Xiaomi
     * has shuffled it across MIUI versions, so we try the known variants in
     * order. Falls back to the app's generic Settings screen.
     */
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        if (tryStartMiuiComponent("com.miui.securitycenter",
                "com.miui.permcenter.autostart.AutoStartManagementActivity")) {
            call.resolve(); return;
        }
        if (tryStartComponent("com.letv.android.letvsafe",
                "com.letv.android.letvsafe.AutobootManageActivity")) {
            call.resolve(); return;
        }
        if (tryStartComponent("com.huawei.systemmanager",
                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity")) {
            call.resolve(); return;
        }
        if (tryStartComponent("com.coloros.safecenter",
                "com.coloros.safecenter.permission.startup.StartupAppListActivity")) {
            call.resolve(); return;
        }
        if (tryStartComponent("com.iqoo.secure",
                "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")) {
            call.resolve(); return;
        }
        // Last resort — the generic app-info screen, where the user can find
        // background-restriction toggles on most modern Android builds.
        if (openAppDetailsFallback()) {
            JSObject ret = new JSObject();
            ret.put("fallback", true);
            call.resolve(ret);
            return;
        }
        call.reject("No matching settings screen found");
    }

    /**
     * MIUI's per-app battery saver ("Background activity management") page.
     * Xiaomi has shuffled this across MIUI 12/13/14/HyperOS, so we try the
     * known component names in order. Each variant is launched with the
     * package_name + package_label extras MIUI expects — without them the
     * activity opens but may bounce straight back to caller.
     * Falls back to the app-details page on stock Android.
     */
    @PluginMethod
    public void openBatterySaverSettings(PluginCall call) {
        // MIUI 13+ / HyperOS — newer container activity.
        if (tryStartMiuiComponent("com.miui.powerkeeper",
                "com.miui.powerkeeper.ui.HiddenAppsContainerManagementActivity")) {
            call.resolve(); return;
        }
        // MIUI 11/12 — original config activity (still works on many MIUI 13 ROMs).
        if (tryStartMiuiComponent("com.miui.powerkeeper",
                "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")) {
            call.resolve(); return;
        }
        // Alternate path some MIUI builds expose.
        if (tryStartMiuiComponent("com.miui.powerkeeper",
                "com.miui.powerkeeper.ui.AppPowerManageActivity")) {
            call.resolve(); return;
        }
        if (openAppDetailsFallback()) {
            JSObject ret = new JSObject();
            ret.put("fallback", true);
            call.resolve(ret);
            return;
        }
        call.reject("No matching settings screen found");
    }

    /**
     * Per-app notification channel screen. Lets the user un-mute the
     * pulse-911-alerts channel if they tapped Block by mistake.
     */
    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent i = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                i.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
            } else {
                i.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                i.setData(Uri.parse("package:" + ctx.getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to open notification settings: " + e.getMessage());
        }
    }

    /* --- helpers --------------------------------------------------------- */

    private boolean isMiuiDevice() {
        // Xiaomi/Redmi/POCO all run MIUI/HyperOS and share the same
        // background-restriction quirks.
        String brand = String.valueOf(Build.BRAND).toLowerCase();
        String mfr = String.valueOf(Build.MANUFACTURER).toLowerCase();
        return brand.contains("xiaomi") || brand.contains("redmi") || brand.contains("poco")
                || mfr.contains("xiaomi");
    }

    private boolean isIgnoringBatteryOptimizations(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
    }

    private boolean tryStartComponent(String pkg, String cls) {
        try {
            Intent i = new Intent();
            i.setComponent(new ComponentName(pkg, cls));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    /**
     * Same as tryStartComponent but also passes the package_name + package_label
     * extras MIUI's PowerKeeper / SecurityCenter activities expect. Without them,
     * the activity may launch but immediately finish and bounce back to caller —
     * which is exactly the "open battery settings does nothing" symptom users
     * report on newer MIUI/HyperOS builds.
     */
    private boolean tryStartMiuiComponent(String pkg, String cls) {
        try {
            Context ctx = getContext();
            Intent i = new Intent();
            i.setComponent(new ComponentName(pkg, cls));
            i.putExtra("package_name", ctx.getPackageName());
            i.putExtra("package_label", "PULSE 911");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean openAppDetailsFallback() {
        try {
            Context ctx = getContext();
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.parse("package:" + ctx.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
