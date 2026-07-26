// Round-trip proof for the Zod -> Dart contract-generation pipeline
// (packages/contracts/scripts/generate-dart-models.mjs): fixtures below are
// shaped exactly like real /api/v1 responses (see packages/contracts/src for
// the source schemas). If a contract changes and regeneration is skipped,
// this is the test that catches the drift.
import 'package:flutter_test/flutter_test.dart';
import 'package:lifeos/src/generated/generated.dart';

void main() {
  test('WalletResponse round-trips SyncFields + a signed money field', () {
    final json = {
      'id': '11111111-1111-4111-8111-111111111111',
      'createdAt': '2026-07-01T00:00:00.000Z',
      'updatedAt': '2026-07-20T00:00:00.000Z',
      'deletedAt': null,
      'version': 3,
      'userId': '22222222-2222-4222-8222-222222222222',
      'name': 'Bank Melli',
      'currency': 'IRR',
      'balance': '-150000',
    };

    final wallet = WalletResponse.fromJson(json);

    expect(wallet.balance, '-150000');
    expect(wallet.currency, Currency.IRR);
    expect(wallet.deletedAt, isNull);
    expect(wallet.toJson(), json);
  });

  test('DashboardResponse round-trips nested anonymous array items', () {
    final json = {
      'jalaliYear': 1405,
      'jalaliMonth': 4,
      'totalBalance': '-25000',
      'wallets': [
        {'walletId': '11111111-1111-4111-8111-111111111111', 'name': 'Bank Melli', 'balance': '-25000'},
      ],
      'spendingByCategory': [
        {'categoryId': '33333333-3333-4333-8333-333333333333', 'categoryName': 'Groceries', 'spent': '80000'},
      ],
      'budgets': <Map<String, dynamic>>[],
    };

    final dashboard = DashboardResponse.fromJson(json);

    expect(dashboard.wallets, hasLength(1));
    expect(dashboard.wallets.first.name, 'Bank Melli');
    expect(dashboard.spendingByCategory.first.spent, '80000');
    expect(dashboard.toJson(), json);
  });

  test('CalendarItemResponse discriminated union dispatches on source', () {
    final eventJson = {
      'source': 'event',
      'title': 'Team sync',
      'start': '2026-07-25T06:00:00.000Z',
      'end': '2026-07-25T07:00:00.000Z',
      'allDay': false,
      'eventId': '44444444-4444-4444-8444-444444444444',
      'isRecurring': true,
    };
    final taskJson = {
      'source': 'task',
      'title': 'Ship the mobile app',
      'start': '2026-07-25T06:00:00.000Z',
      'end': '2026-07-25T06:00:00.000Z',
      'allDay': true,
      'taskId': '55555555-5555-4555-8555-555555555555',
      'status': 'IN_PROGRESS',
      'priority': 'URGENT',
    };

    final event = CalendarItemResponse.fromJson(eventJson);
    final task = CalendarItemResponse.fromJson(taskJson);

    expect(event, isA<CalendarEventItemResponse>());
    expect((event as CalendarEventItemResponse).isRecurring, isTrue);
    expect(event.toJson(), eventJson);

    expect(task, isA<CalendarTaskItemResponse>());
    final taskItem = task as CalendarTaskItemResponse;
    expect(taskItem.status, TaskStatus.IN_PROGRESS);
    expect(taskItem.priority, TaskPriority.URGENT);
    expect(task.toJson(), taskJson);
  });
}
