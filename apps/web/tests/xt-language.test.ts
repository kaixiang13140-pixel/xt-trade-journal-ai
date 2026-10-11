import { expect, it } from "vitest";
import { translateUi } from "../src/lib/i18n/zh";

it("translates explicit interface labels while retaining numeric values and unknown customer text", () => {
  expect(translateUi("Dashboard", "zh")).toBe("总览");
  expect(translateUi(" Net P&L ", "zh")).toBe(" 净盈亏 ");
  expect(translateUi("+$6,150.78", "zh")).toBe("+$6,150.78");
  expect(translateUi("My private trading notes", "zh")).toBe("My private trading notes");
  expect(translateUi("Dashboard", "en")).toBe("Dashboard");
});
