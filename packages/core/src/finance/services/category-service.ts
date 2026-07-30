import type {
  IFinanceCategoryRepository,
  IAuditLogRepository,
  FinanceCategory,
  FinanceCategoryType,
} from "@lifeos/db";
import { OwnedResourceCrud } from "../../shared/owned-resource-crud";

export class CategoryService {
  private readonly crud: OwnedResourceCrud<
    FinanceCategory,
    { userId: string; name: string; type: FinanceCategoryType },
    { name?: string }
  >;

  constructor(
    private readonly categoryRepository: IFinanceCategoryRepository,
    auditLogRepository: IAuditLogRepository,
  ) {
    this.crud = new OwnedResourceCrud(categoryRepository, auditLogRepository, {
      entityName: "Category",
      actionPrefix: "finance.category",
    });
  }

  createCategory(
    userId: string,
    data: { name: string; type: FinanceCategoryType },
  ): Promise<FinanceCategory> {
    return this.crud.create({ userId, ...data });
  }

  listCategories(userId: string): Promise<FinanceCategory[]> {
    return this.categoryRepository.findByUserId(userId);
  }

  updateCategory(
    id: string,
    userId: string,
    data: { name?: string },
    expectedVersion?: number,
  ): Promise<FinanceCategory> {
    return this.crud.update(id, userId, data, expectedVersion);
  }

  deleteCategory(id: string, userId: string, expectedVersion?: number): Promise<void> {
    return this.crud.delete(id, userId, expectedVersion);
  }
}
