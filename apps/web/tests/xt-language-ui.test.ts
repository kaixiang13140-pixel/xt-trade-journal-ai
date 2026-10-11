// @vitest-environment jsdom
import { expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { I18nText, LanguageProvider, LanguageToggle } from "../src/components/language";

it("switches interface language, remembers it, and leaves customer inputs unchanged", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.setItem("xt-language", "en");
  const container = document.createElement("div");
  document.body.append(container);
  let root = createRoot(container);
  const view = () =>
    createElement(LanguageProvider, {
      children: [
        createElement(I18nText, { key: "title", text: "Dashboard" }),
        createElement(LanguageToggle, { key: "switch", compact: true }),
        createElement("input", { key: "note", defaultValue: "Dashboard is my own note" }),
      ],
    });
  try {
    await act(async () => root.render(view()));
    expect(container.textContent).toContain("Dashboard");
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("总览");
    expect(document.documentElement.lang).toBe("zh-Hans");
    expect(localStorage.getItem("xt-language")).toBe("zh");
    expect(container.querySelector("input")!.value).toBe("Dashboard is my own note");
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(view()));
    expect(container.textContent).toContain("总览");
    await act(async () => container.querySelector("button")!.click());
    expect(container.textContent).toContain("Dashboard");
    expect(document.documentElement.lang).toBe("en");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.removeItem("xt-language");
  }
});
