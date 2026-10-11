import { cookies } from "next/headers";
import { handler, bad, ok } from "@/server/api";
import { customerMode } from "@/server/tenant";
import {
  authLimit,
  customerBody,
  CUSTOMER_COOKIE,
  customerCookieOptions,
  loginCustomer,
  requireSameOrigin,
} from "@/server/customers";

export const POST = handler(
  async (request: Request) => {
    if (!customerMode()) return bad("Customer accounts are disabled.", 404);
    requireSameOrigin(request);
    authLimit("login-global", 60, 60);
    const body = await customerBody(request);
    const { token, ...user } = await loginCustomer(body?.email, body?.password, true);
    (await cookies()).set(CUSTOMER_COOKIE, token!, customerCookieOptions(request.url));
    return ok({ user });
  },
  { public: true },
);
