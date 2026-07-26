import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'router.dart';
import 'theme/app_theme.dart';

/// Root of the app. Farsi-first, so the whole tree is forced RTL via the
/// MaterialApp builder (proper next-intl-style localization comes in Phase 2).
/// Navigation is owned by go_router (router.dart) — see its `redirect` for
/// the login/splash/authenticated-shell gating that used to live here as a
/// manual state switch (see git history for the pre-router _Root widget).
class LifeOsApp extends ConsumerWidget {
  const LifeOsApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'مال تو',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(brightness: Brightness.light),
      darkTheme: buildAppTheme(brightness: Brightness.dark),
      routerConfig: router,
      builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
    );
  }
}
