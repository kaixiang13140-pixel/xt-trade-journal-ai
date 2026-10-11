import { cookies } from "next/headers";
import { handler, ok } from "@/server/api";
import { currentCustomer } from "@/server/tenant";
import {
  changeCustomerPassword,
  customerBody,
  CUSTOMER_COOKIE,
  createCustomerSession,
  customerCookieOptions,
} from "@/server/customers";

export const POST = handler(async (request: Request) => {
  const userId = currentCustomer();
  if (!userId) return new Response(null, { status: 404 });
  const body = await customerBody(request);
  await changeCustomerPassword(userId, body.currentPassword, body.newPassword);
  (await cookies()).set(
    CUSTOMER_COOKIE,
    createCustomerSession(userId),
    customerCookieOptions(request.url),
  );
  return ok({ changed: true });
});
