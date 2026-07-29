import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../finance/finance_providers.dart';
import '../../providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_jalali.dart';
import '../../shared/format_money.dart';
import '../../theme/module_colors.dart';
import '../../theme/semantic_colors.dart';
import '../widgets/widgets.dart';

class TransactionsTab extends ConsumerWidget {
  const TransactionsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(transactionsProvider);
    final wallets = ref.watch(walletsProvider).value ?? const [];
    final categories = ref.watch(categoriesProvider).value ?? const [];
    final walletName = {for (final w in wallets) w.id: w.name};
    final categoryName = {for (final c in categories) c.id: c.name};

    return AppScaffold(
      onRefresh: () async => ref.invalidate(transactionsProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: wallets.isEmpty || categories.isEmpty
            ? () => ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('ابتدا یک کیف پول و دسته‌بندی بسازید.'),
                ),
              )
            : () => _showCreateDialog(context, ref, wallets, categories),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: page,
        onRetry: () => ref.invalidate(transactionsProvider),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (data) => data.items.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.receipt_long_outlined,
          module: ModuleKey.finance,
          message: 'هنوز تراکنشی ثبت نشده.',
          hint: 'هزینه‌ها و درآمدهای خود را از همین‌جا ثبت کنید.',
          actionLabel: wallets.isEmpty || categories.isEmpty
              ? null
              : 'ثبت تراکنش',
          onAction: wallets.isEmpty || categories.isEmpty
              ? null
              : () => _showCreateDialog(context, ref, wallets, categories),
        ),
        data: (context, data) => NotificationListener<ScrollEndNotification>(
          onNotification: (n) {
            if (n.metrics.extentAfter < 200) {
              ref.read(transactionsProvider.notifier).loadMore();
            }
            return false;
          },
          child: ListView.builder(
            itemCount: data.items.length,
            itemBuilder: (context, i) {
              final t = data.items[i];
              final income = t.type == TransactionType.INCOME;
              return AppListRow(
                leadingIcon: income ? Icons.arrow_downward : Icons.arrow_upward,
                accent: income ? context.colors.income : context.colors.expense,
                accentSubtle: income
                    ? context.incomeSubtle
                    : context.expenseSubtle,
                title: Text(categoryName[t.categoryId] ?? '—'),
                subtitle: Text(
                  '${walletName[t.walletId] ?? '—'} · ${formatJalaliDate(t.occurredAt, fa: true)}'
                  '${t.note != null ? '\n${t.note}' : ''}',
                ),
                // t.amount is a plain non-negative magnitude (direction
                // comes from `type`, not a '-' prefix — see MoneyText's
                // isNegative doc) — color-codes via the same MoneyText
                // convention every other money display in the app uses
                // (dashboard's wallet/budget rows), just told the sign
                // directly instead of inferring it from the string.
                trailing: MoneyText(
                  t.amount,
                  sign: MoneySign.signed,
                  isNegative: !income,
                  suffix: '',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                actions: [
                  RowAction(
                    label: 'حذف',
                    icon: Icons.delete_outline,
                    destructive: true,
                    onTap: () => _confirmDelete(context, ref, t.id),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    final ok = await confirmDestructive(context, title: 'حذف این تراکنش؟');
    if (ok) {
      await ref.read(financeRepositoryProvider).deleteTransaction(id);
      invalidateFinance(ref);
    }
  }

  Future<void> _showCreateDialog(
    BuildContext context,
    WidgetRef ref,
    List<WalletResponse> wallets,
    List<CategoryResponse> categories,
  ) async {
    final amountController = TextEditingController();
    final noteController = TextEditingController();
    var walletId = wallets.first.id;
    var type = TransactionType.EXPENSE;
    var filtered = categories.where((c) => c.type.name == type.name).toList();
    var categoryId = filtered.isNotEmpty ? filtered.first.id : null;
    var date = DateTime.now();

    final created = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) {
          filtered = categories.where((c) => c.type.name == type.name).toList();
          if (categoryId == null || !filtered.any((c) => c.id == categoryId)) {
            categoryId = filtered.isNotEmpty ? filtered.first.id : null;
          }
          return AlertDialog(
            title: const Text('تراکنش جدید'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SegmentedButton<TransactionType>(
                    segments: const [
                      ButtonSegment(
                        value: TransactionType.EXPENSE,
                        label: Text('هزینه'),
                      ),
                      ButtonSegment(
                        value: TransactionType.INCOME,
                        label: Text('درآمد'),
                      ),
                    ],
                    selected: {type},
                    onSelectionChanged: (s) => setState(() => type = s.first),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: walletId,
                    decoration: const InputDecoration(labelText: 'کیف پول'),
                    items: [
                      for (final w in wallets)
                        DropdownMenuItem(value: w.id, child: Text(w.name)),
                    ],
                    onChanged: (v) => setState(() => walletId = v!),
                  ),
                  const SizedBox(height: 12),
                  if (filtered.isEmpty)
                    const Text('برای این نوع، دسته‌بندی‌ای موجود نیست.')
                  else
                    DropdownButtonFormField<String>(
                      initialValue: categoryId,
                      decoration: const InputDecoration(labelText: 'دسته‌بندی'),
                      items: [
                        for (final c in filtered)
                          DropdownMenuItem(value: c.id, child: Text(c.name)),
                      ],
                      onChanged: (v) => setState(() => categoryId = v),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'مبلغ (تومان)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('تاریخ: ${formatJalaliDate(date, fa: true)}'),
                    trailing: const Icon(Icons.calendar_today, size: 18),
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: date,
                        firstDate: DateTime(2015),
                        lastDate: DateTime(2100),
                      );
                      if (picked != null) setState(() => date = picked);
                    },
                  ),
                  TextField(
                    controller: noteController,
                    decoration: const InputDecoration(
                      labelText: 'یادداشت (اختیاری)',
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('انصراف'),
              ),
              FilledButton(
                onPressed: categoryId == null
                    ? null
                    : () => Navigator.pop(context, true),
                child: const Text('ثبت'),
              ),
            ],
          );
        },
      ),
    );

    if (created == true && categoryId != null) {
      await ref
          .read(financeRepositoryProvider)
          .createTransaction(
            TransactionCreateInput(
              walletId: walletId,
              categoryId: categoryId!,
              type: type,
              amount: parseTomanInputToRial(amountController.text),
              currency: Currency.IRR,
              occurredAt: date.toUtc(),
              note: noteController.text.trim().isEmpty
                  ? null
                  : noteController.text.trim(),
            ),
          );
      unawaited(
        ref
            .read(telemetryControllerProvider)
            .track(TelemetryEventName.TRANSACTION_CREATED),
      );
      invalidateFinance(ref);
    }
  }
}
