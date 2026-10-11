import { cookies } from "next/headers";
import { AUTH_COOKIE, passwordConfigured, sessionToken, verifyPassword } from "@/server/auth";
import { bad, handler, ok } from "@/server/api";
import { customerMode } from "@/server/tenant";

export const POST = handler(
  async (request: Request) => {
    if (customerMode()) return bad("Use the customer sign-in page.", 403);
    if (!passwordConfigured()) return ok({ authenticated: true });
    const { password } = (await request.json()) as { password?: string };
    if (typeof password !== "string" || !password || !verifyPassword(password))
      return bad("Wrong password", 401);
    const jar = await cookies();
    jar.set(AUTH_COOKIE, sessionToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return ok({ authenticated: true });
  },
  { public: true },
);
