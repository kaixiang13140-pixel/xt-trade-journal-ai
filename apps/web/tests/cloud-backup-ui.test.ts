// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { CloudBackupForm } from "../src/components/cloud-backup-form";
afterEach(() => vi.unstubAllGlobals());
it("requires confirmation, locks credentials while uploading and clears the password after a failure", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let complete!: (value: Response) => void;
  const fetchMock = vi.fn(
    (_url: string, _init: RequestInit) =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await act(async () => root.render(createElement(CloudBackupForm)));
    const submit = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(submit.disabled).toBe(true);
    for (const [id, value] of [
      ["cloud-backup-email", "alice@example.test"],
      ["cloud-backup-password", "shortpw"],
    ]) {
      const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(submit.disabled).toBe(false);
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll("input:disabled")).toHaveLength(3);
    expect(submit.disabled).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
      email: "alice@example.test",
      password: "shortpw",
      confirmBackup: true,
    });
    await act(async () => {
      complete(new Response(JSON.stringify({ error: "Cloud write failed." }), { status: 502 }));
    });
    expect(host.querySelector<HTMLInputElement>("#cloud-backup-password")!.value).toBe("");
    expect(host.querySelectorAll("input:disabled")).toHaveLength(0);
    expect(host.textContent).toContain("Cloud write failed.");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
