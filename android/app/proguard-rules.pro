# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

###############################
# Capacitor/Plugins – KEEP RULES
###############################

# Preserve all runtime annotations so Capacitor can read @CapacitorPlugin,
# @Permission and @PluginMethod metadata at runtime (fixes NPE in release).
-keepattributes *Annotation*
-keepattributes InnerClasses,EnclosingMethod

# Keep classes from Capacitor core and official plugins
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }

# Keep our custom background uploader plugin
-keep class ai.paraspot.backgrounduploader.** { *; }

# Ensure methods annotated with @PermissionCallback are not stripped
-keepclassmembers class * {
    @com.getcapacitor.annotation.PermissionCallback <methods>;
}

# (Optional) Silence warnings for obfuscated plugin packages
-dontwarn com.getcapacitor.**
-dontwarn com.capacitorjs.plugins.**
-dontwarn ai.paraspot.backgrounduploader.**

