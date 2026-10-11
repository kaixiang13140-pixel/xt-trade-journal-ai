import { cookies } from "next/headers";
import { handler, bad, ok } from "@/server/api";
import { customerMode } from "@/server/tenant";
import {
  authLimit,
  customerBody,
  CUSTOMER_COOKIE,
  createCustomerSession,
  customerCookieOptions,
  registerCustomer,
  requireSameOrigin,
  verifyRegistrationCode,
} from "@/server/customers";

export const POST = handler(
  async (request: Request) => {
    if (!customerMode()) return bad("Customer accounts are disabled.", 404);
    requireSameOrigin(request);
    authLimit("register-global", 10, 600);
    const body = await customerBody(request);
    verifyRegistrationCode(body?.invitationCode);
    const user = await registerCustomer(body ?? {});
    (await cookies()).set(
      CUSTOMER_COOKIE,
      createCustomerSession(user.id),
      customerCookieOptions(request.url),
    );
    return ok({ user }, { status: 201 });
  },
  { public: true },
);
