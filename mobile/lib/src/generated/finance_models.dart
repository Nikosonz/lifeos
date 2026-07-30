// GENERATED CODE - DO NOT EDIT BY HAND.
// Regenerate with: npm run generate:dart -w @lifeos/contracts
// Source of truth: packages/contracts/src/**/schemas.ts (Zod).
// ignore_for_file: constant_identifier_names
// (enum members are named to match the wire values exactly, e.g. TaskStatus.IN_PROGRESS,
// so .name round-trips through toJson/fromJson without a lookup table.)

class BudgetCreateInput {
  final String categoryId;
  final int jalaliYear;
  final int jalaliMonth;
  final String limitAmount;
  final Currency currency;

  const BudgetCreateInput({
    required this.categoryId,
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.limitAmount,
    required this.currency,
  });

  factory BudgetCreateInput.fromJson(Map<String, dynamic> json) =>
      BudgetCreateInput(
        categoryId: json['categoryId'] as String,
        jalaliYear: json['jalaliYear'] as int,
        jalaliMonth: json['jalaliMonth'] as int,
        limitAmount: json['limitAmount'] as String,
        currency: Currency.values.byName(json['currency'] as String),
      );

  Map<String, dynamic> toJson() => {
    'categoryId': categoryId,
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'limitAmount': limitAmount,
    'currency': currency.name,
  };
}

class BudgetListResponse {
  final List<BudgetResponse> budgets;

  const BudgetListResponse({required this.budgets});

  factory BudgetListResponse.fromJson(Map<String, dynamic> json) =>
      BudgetListResponse(
        budgets: (json['budgets'] as List<dynamic>)
            .map((e) => BudgetResponse.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'budgets': budgets.map((e) => e.toJson()).toList(),
  };
}

class BudgetResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String categoryId;
  final int jalaliYear;
  final int jalaliMonth;
  final String limitAmount;
  final Currency currency;
  final String spent;
  final String remaining;

  const BudgetResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.categoryId,
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.limitAmount,
    required this.currency,
    required this.spent,
    required this.remaining,
  });

  factory BudgetResponse.fromJson(Map<String, dynamic> json) => BudgetResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null
        ? null
        : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    categoryId: json['categoryId'] as String,
    jalaliYear: json['jalaliYear'] as int,
    jalaliMonth: json['jalaliMonth'] as int,
    limitAmount: json['limitAmount'] as String,
    currency: Currency.values.byName(json['currency'] as String),
    spent: json['spent'] as String,
    remaining: json['remaining'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'categoryId': categoryId,
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'limitAmount': limitAmount,
    'currency': currency.name,
    'spent': spent,
    'remaining': remaining,
  };
}

class BudgetUpdateInput {
  final String? limitAmount;
  final int? expectedVersion;

  const BudgetUpdateInput({this.limitAmount, this.expectedVersion});

  factory BudgetUpdateInput.fromJson(Map<String, dynamic> json) =>
      BudgetUpdateInput(
        limitAmount: json['limitAmount'] as String?,
        expectedVersion: json['expectedVersion'] as int?,
      );

  Map<String, dynamic> toJson() => {
    if (limitAmount != null) 'limitAmount': limitAmount,
    if (expectedVersion != null) 'expectedVersion': expectedVersion,
  };
}

class CategoryCreateInput {
  final String name;
  final CategoryType type;

  const CategoryCreateInput({required this.name, required this.type});

  factory CategoryCreateInput.fromJson(Map<String, dynamic> json) =>
      CategoryCreateInput(
        name: json['name'] as String,
        type: CategoryType.values.byName(json['type'] as String),
      );

  Map<String, dynamic> toJson() => {'name': name, 'type': type.name};
}

class CategoryListResponse {
  final List<CategoryResponse> categories;

  const CategoryListResponse({required this.categories});

  factory CategoryListResponse.fromJson(Map<String, dynamic> json) =>
      CategoryListResponse(
        categories: (json['categories'] as List<dynamic>)
            .map((e) => CategoryResponse.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'categories': categories.map((e) => e.toJson()).toList(),
  };
}

class CategoryResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String name;
  final CategoryType type;

  const CategoryResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.name,
    required this.type,
  });

  factory CategoryResponse.fromJson(Map<String, dynamic> json) =>
      CategoryResponse(
        id: json['id'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        version: json['version'] as int,
        userId: json['userId'] as String,
        name: json['name'] as String,
        type: CategoryType.values.byName(json['type'] as String),
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'name': name,
    'type': type.name,
  };
}

enum CategoryType { INCOME, EXPENSE }

class CategoryUpdateInput {
  final String? name;
  final int? expectedVersion;

  const CategoryUpdateInput({this.name, this.expectedVersion});

  factory CategoryUpdateInput.fromJson(Map<String, dynamic> json) =>
      CategoryUpdateInput(
        name: json['name'] as String?,
        expectedVersion: json['expectedVersion'] as int?,
      );

  Map<String, dynamic> toJson() => {
    if (name != null) 'name': name,
    if (expectedVersion != null) 'expectedVersion': expectedVersion,
  };
}

enum Currency { IRR }

class DashboardResponseWalletsItem {
  final String walletId;
  final String name;
  final String balance;

  const DashboardResponseWalletsItem({
    required this.walletId,
    required this.name,
    required this.balance,
  });

  factory DashboardResponseWalletsItem.fromJson(Map<String, dynamic> json) =>
      DashboardResponseWalletsItem(
        walletId: json['walletId'] as String,
        name: json['name'] as String,
        balance: json['balance'] as String,
      );

  Map<String, dynamic> toJson() => {
    'walletId': walletId,
    'name': name,
    'balance': balance,
  };
}

class DashboardResponseSpendingByCategoryItem {
  final String categoryId;
  final String categoryName;
  final String spent;

  const DashboardResponseSpendingByCategoryItem({
    required this.categoryId,
    required this.categoryName,
    required this.spent,
  });

  factory DashboardResponseSpendingByCategoryItem.fromJson(
    Map<String, dynamic> json,
  ) => DashboardResponseSpendingByCategoryItem(
    categoryId: json['categoryId'] as String,
    categoryName: json['categoryName'] as String,
    spent: json['spent'] as String,
  );

  Map<String, dynamic> toJson() => {
    'categoryId': categoryId,
    'categoryName': categoryName,
    'spent': spent,
  };
}

class DashboardResponseBudgetsItem {
  final String categoryId;
  final String categoryName;
  final String limitAmount;
  final String spent;
  final String remaining;

  const DashboardResponseBudgetsItem({
    required this.categoryId,
    required this.categoryName,
    required this.limitAmount,
    required this.spent,
    required this.remaining,
  });

  factory DashboardResponseBudgetsItem.fromJson(Map<String, dynamic> json) =>
      DashboardResponseBudgetsItem(
        categoryId: json['categoryId'] as String,
        categoryName: json['categoryName'] as String,
        limitAmount: json['limitAmount'] as String,
        spent: json['spent'] as String,
        remaining: json['remaining'] as String,
      );

  Map<String, dynamic> toJson() => {
    'categoryId': categoryId,
    'categoryName': categoryName,
    'limitAmount': limitAmount,
    'spent': spent,
    'remaining': remaining,
  };
}

class DashboardResponse {
  final int jalaliYear;
  final int jalaliMonth;
  final String totalBalance;
  final List<DashboardResponseWalletsItem> wallets;
  final List<DashboardResponseSpendingByCategoryItem> spendingByCategory;
  final List<DashboardResponseBudgetsItem> budgets;

  const DashboardResponse({
    required this.jalaliYear,
    required this.jalaliMonth,
    required this.totalBalance,
    required this.wallets,
    required this.spendingByCategory,
    required this.budgets,
  });

  factory DashboardResponse.fromJson(
    Map<String, dynamic> json,
  ) => DashboardResponse(
    jalaliYear: json['jalaliYear'] as int,
    jalaliMonth: json['jalaliMonth'] as int,
    totalBalance: json['totalBalance'] as String,
    wallets: (json['wallets'] as List<dynamic>)
        .map(
          (e) =>
              DashboardResponseWalletsItem.fromJson(e as Map<String, dynamic>),
        )
        .toList(),
    spendingByCategory: (json['spendingByCategory'] as List<dynamic>)
        .map(
          (e) => DashboardResponseSpendingByCategoryItem.fromJson(
            e as Map<String, dynamic>,
          ),
        )
        .toList(),
    budgets: (json['budgets'] as List<dynamic>)
        .map(
          (e) =>
              DashboardResponseBudgetsItem.fromJson(e as Map<String, dynamic>),
        )
        .toList(),
  );

  Map<String, dynamic> toJson() => {
    'jalaliYear': jalaliYear,
    'jalaliMonth': jalaliMonth,
    'totalBalance': totalBalance,
    'wallets': wallets.map((e) => e.toJson()).toList(),
    'spendingByCategory': spendingByCategory.map((e) => e.toJson()).toList(),
    'budgets': budgets.map((e) => e.toJson()).toList(),
  };
}

class TransactionCreateInput {
  final String walletId;
  final String categoryId;
  final TransactionType type;
  final String amount;
  final Currency currency;
  final DateTime occurredAt;
  final String? note;

  const TransactionCreateInput({
    required this.walletId,
    required this.categoryId,
    required this.type,
    required this.amount,
    required this.currency,
    required this.occurredAt,
    this.note,
  });

  factory TransactionCreateInput.fromJson(Map<String, dynamic> json) =>
      TransactionCreateInput(
        walletId: json['walletId'] as String,
        categoryId: json['categoryId'] as String,
        type: TransactionType.values.byName(json['type'] as String),
        amount: json['amount'] as String,
        currency: Currency.values.byName(json['currency'] as String),
        occurredAt: DateTime.parse(json['occurredAt'] as String),
        note: json['note'] as String?,
      );

  Map<String, dynamic> toJson() => {
    'walletId': walletId,
    'categoryId': categoryId,
    'type': type.name,
    'amount': amount,
    'currency': currency.name,
    'occurredAt': occurredAt.toIso8601String(),
    if (note != null) 'note': note,
  };
}

class TransactionListResponse {
  final List<TransactionResponse> items;
  final DateTime? nextCursor;

  const TransactionListResponse({required this.items, this.nextCursor});

  factory TransactionListResponse.fromJson(Map<String, dynamic> json) =>
      TransactionListResponse(
        items: (json['items'] as List<dynamic>)
            .map((e) => TransactionResponse.fromJson(e as Map<String, dynamic>))
            .toList(),
        nextCursor: json['nextCursor'] == null
            ? null
            : DateTime.parse(json['nextCursor'] as String),
      );

  Map<String, dynamic> toJson() => {
    'items': items.map((e) => e.toJson()).toList(),
    'nextCursor': nextCursor?.toIso8601String(),
  };
}

class TransactionResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String walletId;
  final String categoryId;
  final TransactionType type;
  final String amount;
  final Currency currency;
  final DateTime occurredAt;
  final String? note;

  const TransactionResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.walletId,
    required this.categoryId,
    required this.type,
    required this.amount,
    required this.currency,
    required this.occurredAt,
    this.note,
  });

  factory TransactionResponse.fromJson(Map<String, dynamic> json) =>
      TransactionResponse(
        id: json['id'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        updatedAt: DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
        version: json['version'] as int,
        userId: json['userId'] as String,
        walletId: json['walletId'] as String,
        categoryId: json['categoryId'] as String,
        type: TransactionType.values.byName(json['type'] as String),
        amount: json['amount'] as String,
        currency: Currency.values.byName(json['currency'] as String),
        occurredAt: DateTime.parse(json['occurredAt'] as String),
        note: json['note'] as String?,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'walletId': walletId,
    'categoryId': categoryId,
    'type': type.name,
    'amount': amount,
    'currency': currency.name,
    'occurredAt': occurredAt.toIso8601String(),
    'note': note,
  };
}

enum TransactionType { INCOME, EXPENSE }

class TransactionUpdateInput {
  final String? walletId;
  final String? categoryId;
  final TransactionType? type;
  final String? amount;
  final Currency? currency;
  final DateTime? occurredAt;
  final String? note;

  const TransactionUpdateInput({
    this.walletId,
    this.categoryId,
    this.type,
    this.amount,
    this.currency,
    this.occurredAt,
    this.note,
  });

  factory TransactionUpdateInput.fromJson(Map<String, dynamic> json) =>
      TransactionUpdateInput(
        walletId: json['walletId'] as String?,
        categoryId: json['categoryId'] as String?,
        type: json['type'] == null
            ? null
            : TransactionType.values.byName(json['type'] as String),
        amount: json['amount'] as String?,
        currency: json['currency'] == null
            ? null
            : Currency.values.byName(json['currency'] as String),
        occurredAt: json['occurredAt'] == null
            ? null
            : DateTime.parse(json['occurredAt'] as String),
        note: json['note'] as String?,
      );

  Map<String, dynamic> toJson() => {
    if (walletId != null) 'walletId': walletId,
    if (categoryId != null) 'categoryId': categoryId,
    if (type != null) 'type': type?.name,
    if (amount != null) 'amount': amount,
    if (currency != null) 'currency': currency?.name,
    if (occurredAt != null) 'occurredAt': occurredAt?.toIso8601String(),
    if (note != null) 'note': note,
  };
}

class WalletCreateInput {
  final String name;
  final Currency currency;

  const WalletCreateInput({required this.name, required this.currency});

  factory WalletCreateInput.fromJson(Map<String, dynamic> json) =>
      WalletCreateInput(
        name: json['name'] as String,
        currency: Currency.values.byName(json['currency'] as String),
      );

  Map<String, dynamic> toJson() => {'name': name, 'currency': currency.name};
}

class WalletListResponse {
  final List<WalletResponse> wallets;

  const WalletListResponse({required this.wallets});

  factory WalletListResponse.fromJson(Map<String, dynamic> json) =>
      WalletListResponse(
        wallets: (json['wallets'] as List<dynamic>)
            .map((e) => WalletResponse.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
    'wallets': wallets.map((e) => e.toJson()).toList(),
  };
}

class WalletResponse {
  final String id;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? deletedAt;
  final int version;
  final String userId;
  final String name;
  final Currency currency;
  final String balance;

  const WalletResponse({
    required this.id,
    required this.createdAt,
    required this.updatedAt,
    this.deletedAt,
    required this.version,
    required this.userId,
    required this.name,
    required this.currency,
    required this.balance,
  });

  factory WalletResponse.fromJson(Map<String, dynamic> json) => WalletResponse(
    id: json['id'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    updatedAt: DateTime.parse(json['updatedAt'] as String),
    deletedAt: json['deletedAt'] == null
        ? null
        : DateTime.parse(json['deletedAt'] as String),
    version: json['version'] as int,
    userId: json['userId'] as String,
    name: json['name'] as String,
    currency: Currency.values.byName(json['currency'] as String),
    balance: json['balance'] as String,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'deletedAt': deletedAt?.toIso8601String(),
    'version': version,
    'userId': userId,
    'name': name,
    'currency': currency.name,
    'balance': balance,
  };
}

class WalletUpdateInput {
  final String? name;
  final int? expectedVersion;

  const WalletUpdateInput({this.name, this.expectedVersion});

  factory WalletUpdateInput.fromJson(Map<String, dynamic> json) =>
      WalletUpdateInput(
        name: json['name'] as String?,
        expectedVersion: json['expectedVersion'] as int?,
      );

  Map<String, dynamic> toJson() => {
    if (name != null) 'name': name,
    if (expectedVersion != null) 'expectedVersion': expectedVersion,
  };
}
