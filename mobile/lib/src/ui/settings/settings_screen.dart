import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../generated/generated.dart';
import '../../providers.dart';
import '../../shared/open_privacy_policy.dart';
import '../../theme/tokens/spacing.dart';
import '../widgets/widgets.dart';

final _meProvider = FutureProvider.autoDispose<MeResponse>(
  (ref) => ref.read(authRepositoryProvider).me(),
);

/// Profile + preferences, the mobile half of Phase 6's account work.
///
/// `PATCH /api/v1/me` has existed since the auth module shipped and had no
/// UI on any client until now; the theme control moved here from AppShell's
/// overflow menu, where Phase 4 had parked it for lack of a settings screen
/// to put it in.
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _name = TextEditingController();
  CalendarPreference? _calendarPreference;
  bool _saving = false;
  bool _deleting = false;
  // Tracks which profile the form fields were seeded from, so a rebuild
  // (or a background refetch returning an equal-but-new object) never
  // re-seeds over what the user has already typed — the same rule
  // CLAUDE.md documents for the web's dialog reset effects.
  String? _seededFor;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _seed(MeResponse me) {
    if (_seededFor == me.id) return;
    _seededFor = me.id;
    _name.text = me.name ?? '';
    _calendarPreference = me.calendarPreference;
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final trimmed = _name.text.trim();
      await ref
          .read(authRepositoryProvider)
          .updateProfile(
            UpdateProfileInput(
              // Empty clears the name rather than being skipped —
              // UpdateProfileInput.name is .nullable().optional() precisely so
              // "remove my name" is expressible on the wire.
              name: trimmed.isEmpty ? null : trimmed,
              calendarPreference: _calendarPreference,
            ),
          );
      ref.invalidate(_meProvider);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('ذخیره شد')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Two-step confirmation, deliberately heavier than the shared
  /// [confirmDestructive] helper used for a wallet or a task. Those delete
  /// one recreatable row; this destroys the account and everything in it,
  /// permanently. The second step requires typing the word, so the action
  /// cannot be reached by two taps in the same place.
  Future<void> _confirmDeleteAccount() async {
    final controller = TextEditingController();
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('حساب کاربری برای همیشه حذف شود؟'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'همه داده‌های شما بلافاصله و برای همیشه پاک می‌شود. '
                'راهی برای بازگرداندن آن‌ها وجود ندارد.',
              ),
              const SizedBox(height: Spacing.md),
              const Text('برای تأیید، عبارت «حذف» را بنویسید:'),
              const SizedBox(height: Spacing.sm),
              TextField(
                controller: controller,
                autofocus: true,
                decoration: const InputDecoration(border: OutlineInputBorder()),
                // Rebuilds the dialog so the confirm button enables as soon
                // as the word matches, rather than only on submit.
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('انصراف'),
            ),
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, _) => TextButton(
                onPressed: value.text.trim() == 'حذف'
                    ? () => Navigator.of(context).pop(true)
                    : null,
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
                child: const Text('حذف برای همیشه'),
              ),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
      await _deleteAccount();
    } finally {
      controller.dispose();
    }
  }

  Future<void> _deleteAccount() async {
    setState(() => _deleting = true);
    try {
      await ref.read(authRepositoryProvider).deleteAccount();
      // Tokens now point at a user row that no longer exists. markLoggedOut
      // clears them and flips auth state, which the router redirects on —
      // the same path a 401-after-failed-refresh already takes.
      ref.read(authControllerProvider.notifier).markLoggedOut();
    } catch (e) {
      if (mounted) {
        setState(() => _deleting = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(friendlyErrorMessage(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(_meProvider);
    final themeMode = ref.watch(themeModeProvider);
    final telemetryEnabled = ref.watch(telemetryEnabledProvider);

    return Scaffold(
      // Pushed route with its own AppBar/back button, same as Sessions and
      // Notifications — AppScaffold has no appBar slot.
      appBar: AppBar(title: const Text('تنظیمات')),
      body: AsyncValueView(
        value: me,
        onRetry: () => ref.invalidate(_meProvider),
        skeleton: (context) => const SkeletonList(),
        data: (context, profile) {
          _seed(profile);
          return ListView(
            padding: const EdgeInsets.all(Spacing.lg),
            children: [
              const SectionHeader('حساب کاربری'),
              const SizedBox(height: Spacing.sm),
              TextField(
                controller: _name,
                maxLength: 80,
                decoration: const InputDecoration(
                  labelText: 'نام نمایشی',
                  hintText: 'وارد نشده',
                ),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('شماره موبایل'),
                trailing: Text(profile.phone ?? 'ثبت نشده'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                title: const Text('ایمیل'),
                trailing: Text(profile.email ?? 'ثبت نشده'),
              ),

              const SizedBox(height: Spacing.lg),
              const SectionHeader('ترجیحات'),
              const SizedBox(height: Spacing.sm),
              // The timezone dropdown that used to sit here has been removed,
              // not hidden. User.timezone is stored and returned by the API,
              // but nothing reads it: every Jalali day boundary in
              // packages/core comes from a hardcoded +03:30 Tehran offset
              // (shared/jalali.ts). The control changed a column and changed
              // nothing the user could observe, while implying their "today"
              // would move with it. It returns when the boundary helpers
              // actually take a timezone.
              DropdownButtonFormField<CalendarPreference>(
                initialValue: _calendarPreference,
                decoration: const InputDecoration(labelText: 'تقویم'),
                items: const [
                  DropdownMenuItem(
                    value: CalendarPreference.JALALI,
                    child: Text('شمسی'),
                  ),
                  DropdownMenuItem(
                    value: CalendarPreference.GREGORIAN,
                    child: Text('میلادی'),
                  ),
                ],
                onChanged: (v) => setState(() => _calendarPreference = v),
              ),
              const SizedBox(height: Spacing.md),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('ذخیره'),
              ),

              const SizedBox(height: Spacing.lg),
              const SectionHeader('نمایش'),
              const SizedBox(height: Spacing.sm),
              SegmentedButton<ThemeMode>(
                segments: const [
                  ButtonSegment(value: ThemeMode.system, label: Text('سیستم')),
                  ButtonSegment(value: ThemeMode.light, label: Text('روشن')),
                  ButtonSegment(value: ThemeMode.dark, label: Text('تیره')),
                ],
                selected: {themeMode},
                onSelectionChanged: (s) =>
                    ref.read(themeModeProvider.notifier).setThemeMode(s.first),
              ),

              const SizedBox(height: Spacing.lg),
              const SectionHeader('حساب و حریم خصوصی'),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: telemetryEnabled,
                onChanged: (v) =>
                    ref.read(telemetryEnabledProvider.notifier).setEnabled(v),
                title: const Text('ارسال گزارش خطا و آمار استفاده'),
                subtitle: const Text(
                  'برای رفع اشکال‌ها به سرور خودمان ارسال می‌شود. هیچ ابزار تحلیلی شخص ثالثی در کار نیست.',
                ),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.devices_outlined),
                title: const Text('دستگاه‌های فعال'),
                trailing: const Icon(Icons.chevron_left),
                onTap: () => context.push('/sessions'),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.privacy_tip_outlined),
                title: const Text('سیاست حریم خصوصی'),
                trailing: const Icon(Icons.open_in_new),
                onTap: () => openPrivacyPolicy(context),
              ),

              // Last on the screen and visually separated — the only control
              // here whose effect cannot be undone.
              const SizedBox(height: Spacing.lg),
              const SectionHeader('حذف حساب'),
              const SizedBox(height: Spacing.sm),
              Text(
                'حساب شما و همه داده‌هایتان — تراکنش‌ها، کارها، عادت‌ها، رویدادها و یادداشت‌ها — '
                'برای همیشه پاک می‌شود. این کار قابل بازگشت نیست.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: Spacing.sm),
              OutlinedButton.icon(
                onPressed: _deleting ? null : _confirmDeleteAccount,
                icon: const Icon(Icons.delete_forever_outlined),
                label: const Text('حذف حساب کاربری'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                  side: BorderSide(color: Theme.of(context).colorScheme.error),
                ),
              ),
              const SizedBox(height: Spacing.lg),
            ],
          );
        },
      ),
    );
  }
}
