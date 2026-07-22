import type {
  IFinanceWalletRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceWallet,
  FinanceTransactionType,
} from "@lifeos/db";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";
import { logger } from "../../logging/logger";

export interface WalletWithBalance extends FinanceWallet {
  balance: bigint;
}

function computeBalance(
  walletId: string,
  sums: Array<{ walletId: string; type: FinanceTransactionType; sum: bigint }>,
): bigint {
  return sums
    .filter((s) => s.walletId === walletId)
    .reduce((acc, s) => (s.type === "INCOME" ? acc + s.sum : acc - s.sum), 0n);
}

export class WalletService {
  private readonly crud: OwnedResourceCrud<
    FinanceWallet,
    { userId: string; name: string; currency: string },
    { name?: string }
  >;

  constructor(
    private readonly walletRepository: IFinanceWalletRepository,
    private readonly transactionRepository: IFinanceTransactionRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(walletRepository, auditLogRepository, {
      entityName: "Wallet",
      actionPrefix: "finance.wallet",
    });
  }

  async createWallet(
    userId: string,
    data: { name: string; currency: string },
  ): Promise<WalletWithBalance> {
    const wallet = await this.crud.create({ userId, ...data });
    logger.info({ event: "finance.wallet.created", userId, walletId: wallet.id }, "wallet created");
    return { ...wallet, balance: 0n };
  }

  async listWithBalances(userId: string): Promise<WalletWithBalance[]> {
    const wallets = await this.walletRepository.findByUserId(userId);
    const sums = await this.transactionRepository.sumByWallets(wallets.map((w) => w.id));
    return wallets.map((wallet) => ({ ...wallet, balance: computeBalance(wallet.id, sums) }));
  }

  async getWallet(id: string, userId: string): Promise<WalletWithBalance> {
    const wallet = await this.crud.getOwned(id, userId);
    const sums = await this.transactionRepository.sumByWallets([wallet.id]);
    return { ...wallet, balance: computeBalance(wallet.id, sums) };
  }

  async updateWallet(
    id: string,
    userId: string,
    data: { name?: string },
  ): Promise<WalletWithBalance> {
    const updated = await this.crud.update(id, userId, data);
    const sums = await this.transactionRepository.sumByWallets([updated.id]);
    return { ...updated, balance: computeBalance(updated.id, sums) };
  }

  async deleteWallet(id: string, userId: string): Promise<void> {
    await this.crud.delete(id, userId);
    logger.info({ event: "finance.wallet.deleted", userId, walletId: id }, "wallet deleted");
  }
}
