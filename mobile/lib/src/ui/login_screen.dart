import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../providers.dart';

enum Channel { phone, email }

/// OTP login — request a code for a phone/email, then verify it. No OTP logic
/// here; it just drives /api/v1/auth/request-otp and /verify-otp and hands the
/// resulting user to the AuthController.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  Channel _channel = Channel.phone;
  final _identifier = TextEditingController();
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _pending = false;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'خطای غیرمنتظره: $e');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  String? get _phone => _channel == Channel.phone ? _identifier.text.trim() : null;
  String? get _email => _channel == Channel.email ? _identifier.text.trim() : null;

  Future<void> _sendCode() => _run(() async {
    await ref.read(authRepositoryProvider).requestOtp(phone: _phone, email: _email);
    if (mounted) setState(() => _codeSent = true);
  });

  Future<void> _verify() => _run(() async {
    final user = await ref
        .read(authRepositoryProvider)
        .verifyOtp(phone: _phone, email: _email, code: _code.text.trim());
    ref.read(authControllerProvider.notifier).onLoggedIn(user);
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ورود به مال تو',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  SegmentedButton<Channel>(
                    segments: const [
                      ButtonSegment(value: Channel.phone, label: Text('موبایل')),
                      ButtonSegment(value: Channel.email, label: Text('ایمیل')),
                    ],
                    selected: {_channel},
                    onSelectionChanged: (_codeSent || _pending)
                        ? null
                        : (s) => setState(() => _channel = s.first),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _identifier,
                    enabled: !_codeSent && !_pending,
                    keyboardType: _channel == Channel.phone
                        ? TextInputType.phone
                        : TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: _channel == Channel.phone ? 'شماره موبایل' : 'ایمیل',
                      hintText: _channel == Channel.phone
                          ? '+989123456789'
                          : 'you@example.com',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: _code,
                      enabled: !_pending,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'کد تایید',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _pending ? null : (_codeSent ? _verify : _sendCode),
                    child: _pending
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_codeSent ? 'ورود' : 'دریافت کد'),
                  ),
                  if (_codeSent && !_pending) ...[
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: () => setState(() {
                        _codeSent = false;
                        _code.clear();
                        _error = null;
                      }),
                      child: const Text('تغییر شماره / ایمیل'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
