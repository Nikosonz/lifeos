import 'package:flutter/material.dart';

/// Shown only while AuthController restores a session from the token store
/// (a few milliseconds, or one /me round trip) — router.dart redirects away
/// from this the moment auth state resolves to logged in/out.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: CircularProgressIndicator()));
}
