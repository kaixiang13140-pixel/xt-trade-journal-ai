// @vitest-environment jsdom
import { expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { PasswordInput } from "../src/components/password-input";
import { LanguageProvider } from "../src/components/language";
it("reveals and masks a password without changing its value or submitting the form", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let submitted = 0;
  await act(async () =>
    root.render(
      createElement(LanguageProvider, {
        children: createElement(
          "form",
          {
            onSubmit: (e: Event) => {
              e.preventDefault();
              submitted++;
            },
          },
          createElement(PasswordInput, {
            id: "password",
            defaultValue: "test-password-123",
            autoComplete: "current-password",
          }),
        ),
      }),
    ),
  );
  const input = container.querySelector("input")!;
  const button = container.querySelector("button")!;
  expect(input.type).toBe("password");
  await act(async () => button.click());
  expect(input.type).toBe("text");
  expect(input.value).toBe("test-password-123");
  expect(button.getAttribute("aria-pressed")).toBe("true");
  expect(submitted).toBe(0);
  await act(async () => button.click());
  expect(input.type).toBe("password");
  expect(input.autocomplete).toBe("current-password");
  await act(async () => root.unmount());
  container.remove();
});
