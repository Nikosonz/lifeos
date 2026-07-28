import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/env.dart';

/// Opens the web-served privacy policy in the system browser.
///
/// Deliberately not a native Dart screen duplicating the text: Cafe Bazaar
/// and Myket both require a publicly-fetchable policy URL for a store
/// listing, so `apps/web`'s `/<locale>/privacy` page has to exist anyway —
/// a second copy in Dart would only drift out of sync with it.
///
/// Built off [Env.apiBaseUrl] rather than a separate constant because the
/// policy is served by the same Next.js app as `/api/v1`; in dev that is
/// the emulator's `10.0.2.2` host-loopback, in production the real domain,
/// and both resolve correctly in the device browser.
Future<void> openPrivacyPolicy(BuildContext context) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final uri = Uri.parse('${Env.apiBaseUrl}/fa/privacy');
  final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
  // A device with no browser at all is rare but not impossible (bare
  // emulator images ship without one) — failing silently there would look
  // like a broken button, so surface it rather than swallowing it.
  if (!launched && messenger != null) {
    messenger.showSnackBar(
      const SnackBar(content: Text('باز کردن مرورگر ممکن نشد.')),
    );
  }
}
