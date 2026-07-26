import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';
import '../../shared/format_money.dart';

class WalletsTab extends ConsumerWidget {
  const WalletsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallets = ref.watch(walletsProvider);
    return Scaffold(
      body: wallets.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('خطا: $e')),
        data: (list) {
          if (list.isEmpty) {
            return const Center(child: Text('هنوز کیف پولی نساخته‌اید.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(walletsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final w = list[i];
                final negative = w.balance.startsWith('-');
                return ListTile(
                  leading: const Icon(Icons.account_balance_wallet_outlined),
                  title: Text(w.name),
                  trailing: Text(
                    '${formatTomanFromRial(w.balance, fa: true)} تومان',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: negative ? Theme.of(context).colorScheme.error : null,
                    ),
                  ),
                  onLongPress: () => _confirmDelete(context, ref, w),
                );
              },
            ),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref, WalletResponse w) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('حذف «${w.name}»؟'),
        content: const Text('این عملیات قابل بازگشت نیست.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) {
      await ref.read(financeRepositoryProvider).deleteWallet(w.id);
      invalidateFinance(ref);
    }
  }

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('کیف پول جدید'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'نام', hintText: 'مثلاً بانک ملی'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('انصراف')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref.read(financeRepositoryProvider).createWallet(WalletCreateInput(name: name, currency: Currency.IRR));
      invalidateFinance(ref);
    }
  }
}
