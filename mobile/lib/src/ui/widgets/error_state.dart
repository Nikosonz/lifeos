import 'package:flutter/material.dart';

import '../../api/api_exception.dart';
import '../../theme/tokens/spacing.dart';

/// Human-readable Persian copy for the closed set of error codes
/// packages/core/src/errors/app-error.ts actually throws (VALIDATION_ERROR,
/// UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, RATE_LIMITED,
/// INTERNAL_ERROR) — never the raw exception string. A network failure
/// (no response reached) surfaces as ApiException('INTERNAL_ERROR', ...,
/// status: 0) per api_client.dart's _toApiException, which is what the
/// "no connection" copy below specifically targets.
///
/// Public (not just [ErrorState]-internal) so any screen showing an error
/// outside the loading/error/data shape [AsyncValueView] covers — e.g.
/// login_screen.dart's inline OTP-request/verify failures — reuses the
/// same mapping instead of a second one.
/// Whether [error] is specifically an optimistic-concurrency rejection
/// (ADR-0020) rather than one of the other conditions sharing the CONFLICT
/// code. `details.currentVersion` is the discriminator, which is the concrete
/// reason that payload exists at all rather than a bare 409.
bool isVersionConflict(Object error) {
  if (error is! ApiException || error.code != 'CONFLICT') return false;
  final details = error.details;
  return details is Map && details['currentVersion'] is int;
}

String friendlyErrorMessage(Object error) {
  if (error is ApiException) {
    if (error.status == 0) return 'اتصال برقرار نشد. اینترنت را بررسی کنید.';
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'نشست شما منقضی شده. دوباره وارد شوید.';
      case 'FORBIDDEN':
        return 'اجازه دسترسی به این بخش را ندارید.';
      case 'NOT_FOUND':
        return 'موردی یافت نشد.';
      case 'CONFLICT':
        // CONFLICT is three different server conditions, not one: an
        // optimistic-concurrency failure, an Idempotency-Key replayed with a
        // different body, and a duplicate label name. Only the first carries
        // `currentVersion` in details, and only the first is resolved by
        // "reload and try again" — saying that about a duplicate label name
        // would simply be false, so the others keep falling through to the
        // server's own message.
        return isVersionConflict(error)
            ? 'این مورد روی دستگاه دیگری تغییر کرده است. دوباره تلاش کنید.'
            : error.message;
      case 'RATE_LIMITED':
        return 'درخواست‌های زیاد. کمی صبر کنید و دوباره تلاش کنید.';
      case 'VALIDATION_ERROR':
        return error.message;
      default:
        return 'خطایی در ارتباط با سرور رخ داد.';
    }
  }
  return 'خطایی رخ داد. دوباره تلاش کنید.';
}

/// Replaces the audit's 13× `Center(child: Text('خطا: $e'))` — always
/// human copy, always a working retry, never the raw exception.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: 40,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: Spacing.md),
            Text(
              friendlyErrorMessage(error),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: Spacing.lg),
            FilledButton.tonal(
              onPressed: onRetry,
              child: const Text('تلاش دوباره'),
            ),
          ],
        ),
      ),
    );
  }
}
