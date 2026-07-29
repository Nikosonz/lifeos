import type { PrismaClient, User, CalendarPreference } from "../../generated/prisma/index";

export interface IUserRepository {
  findByPhone(phone: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  createWithPhone(phone: string): Promise<User>;
  createWithEmail(email: string): Promise<User>;
  update(
    id: string,
    data: { name?: string | null; timezone?: string; calendarPreference?: CalendarPreference },
  ): Promise<User>;
  /**
   * Irreversibly deletes the user row. Every child relation in the schema
   * declares `onDelete: Cascade`, so Postgres removes the account's
   * wallets, transactions, budgets, tasks, subtasks, projects, labels,
   * events, habits, check-ins, notifications, sessions and telemetry in the
   * same statement.
   *
   * A HARD delete, not a soft one, and that is the whole point. `User` does
   * carry a `deletedAt` column, but nothing in the codebase reads it —
   * `findById` (the query behind every authenticated request) does not
   * filter on it — so setting it would leave the account fully usable while
   * claiming to be deleted. The privacy policy promises «حذف کامل حساب و
   * داده‌هایتان»; only this delivers it.
   *
   * `audit_logs` deliberately survives: it has no foreign key to `users`,
   * so the record that a deletion happened outlives the account. That is
   * why the identifier stored there is masked at write time.
   */
  hardDelete(id: string): Promise<void>;
}

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createWithPhone(phone: string) {
    return this.prisma.user.create({ data: { phone } });
  }

  createWithEmail(email: string) {
    return this.prisma.user.create({ data: { email } });
  }

  update(
    id: string,
    data: { name?: string | null; timezone?: string; calendarPreference?: CalendarPreference },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }
}
