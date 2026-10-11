import { cookies } from "next/headers";
import { handler, ok } from "@/server/api";
import { customerMode } from "@/server/tenant";
import { CUSTOMER_COOKIE, requireSameOrigin, revokeCustomerSession } from "@/server/customers";

export const POST = handler(
  async (request: Request) => {
    requireSameOrigin(request);
    const jar = await cookies();
    if (customerMode()) revokeCustomerSession(jar.get(CUSTOMER_COOKIE)?.value);
    jar.delete(CUSTOMER_COOKIE);
    return ok({ signedOut: true });
  },
  { public: true },
);
