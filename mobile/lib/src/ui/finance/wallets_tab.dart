import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../finance/finance_providers.dart';
import '../../generated/generated.dart';
import '../../theme/module_colors.dart';
import '../widgets/widgets.dart';

class WalletsTab extends ConsumerWidget {
  const WalletsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallets = ref.watch(walletsProvider);
    return AppScaffold(
      onRefresh: () async => ref.invalidate(walletsProvider),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showCreateDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: AsyncValueView(
        value: wallets,
        onRetry: () => ref.invalidate(walletsProvider),
        skeleton: (context) => const SkeletonList(),
        isEmpty: (list) => list.isEmpty,
        empty: (context) => EmptyState(
          icon: Icons.account_balance_wallet_outlined,
          module: ModuleKey.finance,
          message: 'هنوز کیف پولی نساخته‌اید.',
          hint: 'برای ثبت تراکنش، ابتدا یک کیف پول بسازید.',
          actionLabel: 'ساخت کیف پول',
          onAction: () => _showCreateDialog(context, ref),
        ),
        data: (context, list) => ListView.builder(
          itemCount: list.length,
          itemBuilder: (context, i) {
            final w = list[i];
            return AppListRow(
              leadingIcon: Icons.account_balance_wallet_outlined,
              module: ModuleKey.finance,
              title: Text(w.name),
              trailing: MoneyText(
                w.balance,
                sign: MoneySign.signed,
                suffix: '',
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              actions: [
                RowAction(
                  label: 'حذف',
                  icon: Icons.delete_outline,
                  destructive: true,
                  onTap: () => _confirmDelete(context, ref, w),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    WalletResponse w,
  ) async {
    final ok = await confirmDestructive(context, title: 'حذف «${w.name}»؟');
    if (ok) {
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
          decoration: const InputDecoration(
            labelText: 'نام',
            hintText: 'مثلاً بانک ملی',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('ایجاد'),
          ),
        ],
      ),
    );
    if (name != null && name.isNotEmpty) {
      await ref
          .read(financeRepositoryProvider)
          .createWallet(WalletCreateInput(name: name, currency: Currency.IRR));
      invalidateFinance(ref);
    }
  }
}
