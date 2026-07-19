import type { PrismaClient, IdempotencyKey } from "../../generated/prisma/index";

// Thrown when an insert into IdempotencyKey hits the (userId, key) unique
// constraint — translated from Prisma's P2002 so packages/core never has
// to know about Prisma-specific error codes. See
// FinanceTransactionRepository.createWithIdempotency/updateWithIdempotency
// for where this gets thrown, inside a rolled-back $transaction.
export class IdempotencyKeyRaceError extends Error {
  constructor() {
    super("Idempotency key already claimed by a concurrent request");
    this.name = "IdempotencyKeyRaceError";
  }
}

export interface IIdempotencyKeyRepository {
  findByUserAndKey(userId: string, key: string): Promise<IdempotencyKey | null>;
}

export class IdempotencyKeyRepository implements IIdempotencyKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByUserAndKey(userId: string, key: string) {
    return this.prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
  }
}
