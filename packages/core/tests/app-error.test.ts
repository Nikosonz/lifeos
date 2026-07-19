import { test } from "node:test";
import assert from "node:assert/strict";
import { NotFoundError, ValidationError, AppError } from "../src/errors/app-error";

test("NotFoundError maps to 404 and NOT_FOUND code", () => {
  const err = new NotFoundError("User");
  assert.equal(err.httpStatus, 404);
  assert.equal(err.code, "NOT_FOUND");
  assert.equal(err.message, "User not found");
  assert.ok(err instanceof AppError);
});

test("ValidationError carries details through", () => {
  const err = new ValidationError("Invalid payload", { field: "email" });
  assert.equal(err.httpStatus, 400);
  assert.deepEqual(err.details, { field: "email" });
});
