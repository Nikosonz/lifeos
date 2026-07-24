import { CategoryCreateInput } from "@lifeos/contracts";
import { categoryService } from "@lifeos/core";
import { runRoute } from "@/lib/route-handler";
import { requireUser } from "@/lib/auth-context";
import { toResponse } from "./to-response";

export const POST = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const input = CategoryCreateInput.parse(await req.json());
  const category = await categoryService.createCategory(userId, input);
  return toResponse(category);
});

export const GET = runRoute(async (req) => {
  const { userId } = await requireUser(req);
  const categories = await categoryService.listCategories(userId);
  return { categories: categories.map(toResponse) };
});
