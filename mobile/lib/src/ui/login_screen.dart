import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../providers.dart';
import '../theme/tokens/spacing.dart';
import 'widgets/widgets.dart';

enum Channel { phone, email }

// Narrower than Spacing.maxContentWidth (560, meant for list/content
// screens) — a short vertical auth form reads better as a compact centered
// card. No second consumer yet, so this stays a local constant rather than
// a new shared token (see Spacing's own "promote once a second screen
// needs it" precedent).
const _formMaxWidth = 420.0;

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
  Object? _error;

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
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  // UNAUTHORIZED from verify-otp always means "wrong code" on this screen —
  // there's no existing session for it to mean "expired" the way
  // friendlyErrorMessage's generic UNAUTHORIZED copy assumes for every
  // other (authenticated) screen it's shown on.
  String _describeError(Object error) {
    if (error is ApiException && error.code == 'UNAUTHORIZED') {
      return 'کد وارد شده نادرست است.';
    }
    return friendlyErrorMessage(error);
  }

  String? get _phone =>
      _channel == Channel.phone ? _identifier.text.trim() : null;
  String? get _email =>
      _channel == Channel.email ? _identifier.text.trim() : null;

  Future<void> _sendCode() => _run(() async {
    await ref
        .read(authRepositoryProvider)
        .requestOtp(phone: _phone, email: _email);
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
            constraints: const BoxConstraints(maxWidth: _formMaxWidth),
            child: Padding(
              padding: const EdgeInsets.all(Spacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ورود به مال تو',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: Spacing.xl),
                  SegmentedButton<Channel>(
                    segments: const [
                      ButtonSegment(
                        value: Channel.phone,
                        label: Text('موبایل'),
                      ),
                      ButtonSegment(value: Channel.email, label: Text('ایمیل')),
                    ],
                    selected: {_channel},
                    onSelectionChanged: (_codeSent || _pending)
                        ? null
                        : (s) => setState(() => _channel = s.first),
                  ),
                  const SizedBox(height: Spacing.lg),
                  TextField(
                    controller: _identifier,
                    enabled: !_codeSent && !_pending,
                    keyboardType: _channel == Channel.phone
                        ? TextInputType.phone
                        : TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: _channel == Channel.phone
                          ? 'شماره موبایل'
                          : 'ایمیل',
                      hintText: _channel == Channel.phone
                          ? '+989123456789'
                          : 'you@example.com',
                    ),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: Spacing.lg),
                    TextField(
                      controller: _code,
                      enabled: !_pending,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(labelText: 'کد تایید'),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: Spacing.md),
                    Text(
                      _describeError(_error!),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: Spacing.lg),
                  FilledButton(
                    onPressed: _pending
                        ? null
                        : (_codeSent ? _verify : _sendCode),
                    child: _pending
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_codeSent ? 'ورود' : 'دریافت کد'),
                  ),
                  if (_codeSent && !_pending) ...[
                    const SizedBox(height: Spacing.sm),
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
