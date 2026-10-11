import { cookies } from "next/headers";
import { handler, ok } from "@/server/api";
import { CUSTOMER_COOKIE, customerForToken } from "@/server/customers";
import { customerMode } from "@/server/tenant";

export const GET = handler(
  async () => {
    const enabled = customerMode();
    const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
    return ok({
      customerMode: enabled,
      user: enabled ? customerForToken(token) : null,
      invitationRequired: enabled && Boolean(process.env.XT_REGISTRATION_CODE),
    });
  },
  { public: true },
);
