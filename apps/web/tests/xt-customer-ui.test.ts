// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LanguageProvider } from "../src/components/language";
import { CustomerSettings } from "../src/components/customer-settings";
import { CustomerSession } from "../src/components/customer-session";
import HelpPage from "../src/app/help/page";

const state = vi.hoisted(() => ({ post: vi.fn(), customerMode: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));
vi.mock("@/lib/use-api", () => ({
  useApi: () => ({
    data: {
      customerMode: state.customerMode,
      user: { email: "private@example.test", name: "Private customer" },
    },
  }),
  postJson: (...args: unknown[]) => state.post(...args),
}));
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.setItem("xt-language", "zh");
  state.customerMode = true;
  state.post.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});
const render = async (component: React.ComponentType) => {
  await act(async () =>
    root.render(createElement(LanguageProvider, { children: createElement(component) })),
  );
};
it("shows a Chinese security form without changing the customer's email, and hides it in personal mode", async () => {
  await render(CustomerSettings);
  expect(container.textContent).toContain("账户安全");
  expect(container.textContent).toContain("private@example.test");
  expect(container.querySelector('input[autocomplete="current-password"]')).not.toBeNull();
  expect(container.querySelectorAll('input[autocomplete="new-password"]')).toHaveLength(2);
  expect(container.textContent).toContain("其他设备会退出登录");
  state.customerMode = false;
  await render(CustomerSettings);
  expect(container.textContent).toBe("");
});
it("reports a failed sign-out and permits a retry instead of leaving an unhandled rejection", async () => {
  state.post.mockRejectedValue(new Error("Offline"));
  await render(CustomerSession);
  const button = container.querySelector("button")!;
  await act(async () => button.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("退出登录失败");
  expect(button.disabled).toBe(false);
  await act(async () => button.click());
  expect(state.post).toHaveBeenCalledTimes(2);
});
it("provides Chinese getting-started links and accurately describes MT5 and hosted-device access", async () => {
  await render(HelpPage);
  expect(container.querySelector("h1")?.textContent).toBe("开始使用");
  expect(container.querySelector('a[href="/settings#general"]')).not.toBeNull();
  expect(container.querySelector('a[href="/import"]')).not.toBeNull();
  expect(container.textContent).toContain("尚未支持自动同步");
  expect(container.textContent).toContain("本机电脑地址不是公网网址");
});
