import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../generated/generated.dart';
import '../providers.dart';
import '../shared/open_privacy_policy.dart';
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
///
/// A brand-new account gets one extra step afterwards (name). The server
/// decides who is new via verify-otp's `isNewUser` (ADR-0018) — this screen
/// never infers it, since "has no name" is equally true of a returning user
/// who skipped the step.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  Channel _channel = Channel.phone;
  final _identifier = TextEditingController();
  final _code = TextEditingController();
  final _name = TextEditingController();
  bool _codeSent = false;
  bool _pending = false;
  Object? _error;

  // Non-null only while the name step is showing. The account exists and
  // its tokens are already stored by this point, so the user is held back
  // from AuthController deliberately rather than logged in and then
  // interrupted — the router would otherwise swap the app shell in
  // underneath this step.
  MeResponse? _newUser;

  @override
  void dispose() {
    _identifier.dispose();
    _code.dispose();
    _name.dispose();
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
    final result = await ref
        .read(authRepositoryProvider)
        .verifyOtp(phone: _phone, email: _email, code: _code.text.trim());
    if (result.isNewUser) {
      if (mounted) setState(() => _newUser = result.user);
      return;
    }
    ref.read(authControllerProvider.notifier).onLoggedIn(result.user);
  });

  Future<void> _saveName() => _run(() async {
    final updated = await ref
        .read(authRepositoryProvider)
        .updateProfile(UpdateProfileInput(name: _name.text.trim()));
    // isNewUser: only this path and _skipName are reached by a brand-new
    // account, so this is where SIGNUP_COMPLETED (not LOGIN_COMPLETED) is
    // the truthful event.
    ref
        .read(authControllerProvider.notifier)
        .onLoggedIn(updated, isNewUser: true);
  });

  // Skipping is a first-class outcome, not a dead end — User.name is
  // nullable precisely so this button can exist. No PATCH at all.
  void _skipName() => ref
      .read(authControllerProvider.notifier)
      .onLoggedIn(_newUser!, isNewUser: true);

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
                children: _newUser != null
                    ? _nameStep(context)
                    : _identifierStep(context),
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _nameStep(BuildContext context) => [
    Text(
      'به مال تو خوش آمدید',
      style: Theme.of(context).textTheme.headlineSmall,
      textAlign: TextAlign.center,
    ),
    const SizedBox(height: Spacing.md),
    Text(
      'برای شخصی‌سازی، نام خود را وارد کنید. می‌توانید بعداً هم این کار را انجام دهید.',
      style: Theme.of(context).textTheme.bodyMedium,
      textAlign: TextAlign.center,
    ),
    const SizedBox(height: Spacing.xl),
    TextField(
      controller: _name,
      enabled: !_pending,
      textInputAction: TextInputAction.done,
      maxLength: 80,
      decoration: const InputDecoration(
        labelText: 'نام شما',
        hintText: 'مثلاً پویا',
      ),
    ),
    if (_error != null) ...[
      const SizedBox(height: Spacing.md),
      Text(
        _describeError(_error!),
        style: TextStyle(color: Theme.of(context).colorScheme.error),
        textAlign: TextAlign.center,
      ),
    ],
    const SizedBox(height: Spacing.lg),
    FilledButton(
      onPressed: _pending ? null : _saveName,
      child: _pending
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Text('ادامه'),
    ),
    const SizedBox(height: Spacing.sm),
    TextButton(
      onPressed: _pending ? null : _skipName,
      child: const Text('بعداً'),
    ),
  ];

  List<Widget> _identifierStep(BuildContext context) => [
    Text(
      'ورود به مال تو',
      style: Theme.of(context).textTheme.headlineSmall,
      textAlign: TextAlign.center,
    ),
    const SizedBox(height: Spacing.xl),
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
    const SizedBox(height: Spacing.lg),
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
        style: TextStyle(color: Theme.of(context).colorScheme.error),
        textAlign: TextAlign.center,
      ),
    ],
    const SizedBox(height: Spacing.lg),
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
    // Notice has to precede account creation, which happens the moment the
    // code is verified — so it belongs on this step, not the name step.
    const SizedBox(height: Spacing.lg),
    Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text('با ادامه، با ', style: Theme.of(context).textTheme.bodySmall),
        InkWell(
          onTap: () => openPrivacyPolicy(context),
          child: Text(
            'سیاست حریم خصوصی',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              decoration: TextDecoration.underline,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ),
        Text(' موافقت می‌کنید.', style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  ];
}
