import type {
  IFinanceCategoryRepository,
  IAuditLogRepository,
  FinanceCategory,
  FinanceCategoryType,
} from "@lifeos/db";
import { NotFoundError } from "../../errors/app-error";

export class CategoryService {
  constructor(
    private readonly categoryRepository: IFinanceCategoryRepository,
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async createCategory(
    userId: string,
    data: { name: string; type: FinanceCategoryType },
  ): Promise<FinanceCategory> {
    const category = await this.categoryRepository.create({ userId, ...data });
    await this.auditLogRepository.record({
      userId,
      action: "finance.category.created",
      metadata: { categoryId: category.id },
    });
    return category;
  }

  listCategories(userId: string): Promise<FinanceCategory[]> {
    return this.categoryRepository.findByUserId(userId);
  }

  async updateCategory(
    id: string,
    userId: string,
    data: { name?: string },
  ): Promise<FinanceCategory> {
    await this.getOwned(id, userId);
    const updated = await this.categoryRepository.update(id, data);
    await this.auditLogRepository.record({
      userId,
      action: "finance.category.updated",
      metadata: { categoryId: id },
    });
    return updated;
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.categoryRepository.softDelete(id);
    await this.auditLogRepository.record({
      userId,
      action: "finance.category.deleted",
      metadata: { categoryId: id },
    });
  }

  private async getOwned(id: string, userId: string): Promise<FinanceCategory> {
    const category = await this.categoryRepository.findById(id);
    if (!category || category.userId !== userId || category.deletedAt) {
      throw new NotFoundError("Category");
    }
    return category;
  }
}
