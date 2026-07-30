import { CategoryCreateInput, CategoryListResponse, CategoryResponse } from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute(
  { body: CategoryCreateInput, response: CategoryResponse },
  async ({ userId, body: input }) => {
    const category = await categoryService.createCategory(userId, input);
    return toResponse(category);
  },
);

export const GET = defineRoute({ response: CategoryListResponse }, async ({ userId }) => {
  const categories = await categoryService.listCategories(userId);
  return { categories: categories.map(toResponse) };
});
