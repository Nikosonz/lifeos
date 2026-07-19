import type {
  IFinanceWalletRepository,
  IFinanceTransactionRepository,
  IAuditLogRepository,
  FinanceWallet,
  FinanceTransactionType,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";
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
  constructor(
    private readonly walletRepository: IFinanceWalletRepository,
    private readonly transactionRepository: IFinanceTransactionRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createWallet(
    userId: string,
    data: { name: string; currency: string },
  ): Promise<WalletWithBalance> {
    const wallet = await this.walletRepository.create({ userId, ...data });
    await this.auditLogRepository.record({
      userId,
      action: "finance.wallet.created",
      metadata: { walletId: wallet.id },
    });
    logger.info({ event: "finance.wallet.created", userId, walletId: wallet.id }, "wallet created");
    return { ...wallet, balance: 0n };
  }

  async listWithBalances(userId: string): Promise<WalletWithBalance[]> {
    const wallets = await this.walletRepository.findByUserId(userId);
    const sums = await this.transactionRepository.sumByWallets(wallets.map((w) => w.id));
    return wallets.map((wallet) => ({ ...wallet, balance: computeBalance(wallet.id, sums) }));
  }

  async getWallet(id: string, userId: string): Promise<WalletWithBalance> {
    const wallet = await this.getOwned(id, userId);
    const sums = await this.transactionRepository.sumByWallets([wallet.id]);
    return { ...wallet, balance: computeBalance(wallet.id, sums) };
  }

  async updateWallet(
    id: string,
    userId: string,
    data: { name?: string },
  ): Promise<WalletWithBalance> {
    await this.getOwned(id, userId);
    const updated = await this.walletRepository.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "finance.wallet.updated",
      metadata: { walletId: id },
    });
    const sums = await this.transactionRepository.sumByWallets([updated.id]);
    return { ...updated, balance: computeBalance(updated.id, sums) };
  }

  async deleteWallet(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.walletRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "finance.wallet.deleted",
      metadata: { walletId: id },
    });
    logger.info({ event: "finance.wallet.deleted", userId, walletId: id }, "wallet deleted");
  }

  private async getOwned(id: string, userId: string): Promise<FinanceWallet> {
    const wallet = await this.walletRepository.findById(id);
    if (!wallet || wallet.userId !== userId || wallet.deletedAt) throw new NotFoundError("Wallet");
    return wallet;
  }
}
