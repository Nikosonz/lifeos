import type { PrismaClient, User, CalendarPreference } from "../../generated/prisma/index";

export interface IUserRepository {
  findByPhone(phone: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  createWithPhone(phone: string): Promise<User>;
  createWithEmail(email: string): Promise<User>;
  update(
    id: string,
    data: { timezone?: string; calendarPreference?: CalendarPreference },
  ): Promise<User>;
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

  update(id: string, data: { timezone?: string; calendarPreference?: CalendarPreference }) {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }
}
