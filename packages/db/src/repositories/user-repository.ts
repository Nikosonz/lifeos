import type { PrismaClient, User, CalendarPreference } from "../../generated/prisma/index";

export interface IUserRepository {
  findByPhone(phone: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(phone: string): Promise<User>;
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

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(phone: string) {
    return this.prisma.user.create({ data: { phone } });
  }

  update(id: string, data: { timezone?: string; calendarPreference?: CalendarPreference }) {
    return this.prisma.user.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
  }
}
