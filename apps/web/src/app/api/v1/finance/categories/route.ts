import { CategoryCreateInput } from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import { defineRoute } from "@/lib/route-handler";
import { toResponse } from "./to-response";

export const POST = defineRoute({ body: CategoryCreateInput }, async ({ userId, body: input }) => {
  const category = await categoryService.createCategory(userId, input);
  return toResponse(category);
});

export const GET = defineRoute({}, async ({ userId }) => {
  const categories = await categoryService.listCategories(userId);
  return { categories: categories.map(toResponse) };
});
