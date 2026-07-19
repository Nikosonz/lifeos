import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { toErrorEnvelope } from "@lifeos/core";

type RouteResult = unknown | NextResponse;

// Every /api/v1 route handler is wrapped in this: generates a requestId,
// forwards it on the response, and turns whatever core throws into the
// same error envelope shape for every route — see @lifeos/core toErrorEnvelope.
// `Ctx` carries Next's second route-handler argument through for dynamic
// segments (e.g. `{ params: Promise<{ id: string }> }`). Defaults to the
// empty-params shape Next 16's build-time route validator expects on every
// handler, even non-dynamic ones — a literal `undefined` default fails
// `next build`'s generated type check.
export function runRoute<Ctx = { params: Promise<Record<string, never>> }>(
  handler: (req: NextRequest, requestId: string, ctx: Ctx) => Promise<RouteResult>,
) {
  return async (req: NextRequest, ctx: Ctx) => {
    const requestId = randomUUID();
    try {
      const result = await handler(req, requestId, ctx);
      if (result instanceof NextResponse) {
        result.headers.set("x-request-id", requestId);
        return result;
      }
      return NextResponse.json(result, { headers: { "x-request-id": requestId } });
    } catch (err) {
      const { status, body } = toErrorEnvelope(err, requestId);
      return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
    }
  };
}
