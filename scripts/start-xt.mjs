import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const appPackage = new URL("../apps/web/package.json", import.meta.url);
const appUrl = "http://127.0.0.1:3000";
const environment = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };

function pnpm(argumentsList) {
  const { packageManager } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageManager)) {
    throw new Error("package.json must pin an exact pnpm version.");
  }
  const args = ["exec", "--yes", `--package=${packageManager}`, "--", "pnpm", ...argumentsList];
  // All command arguments here are fixed or constrained to an exact version.
  // Windows requires cmd.exe to invoke npm.cmd; cwd is passed separately.
  return process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`], {
        cwd: projectRoot,
        env: environment,
        stdio: "inherit",
      })
    : spawn("npm", args, { cwd: projectRoot, env: environment, stdio: "inherit" });
}

function finished(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Command stopped (${signal ?? code}). See the output above.`));
    });
  });
}

function checkPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () =>
      reject(new Error("Port 3000 is busy. Close the other local server and try again.")),
    );
    server.listen(3000, "127.0.0.1", () => server.close(resolve));
  });
}

function openBrowser() {
  if (process.env.XT_NO_BROWSER === "1") return;
  const command =
    process.platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", appUrl]]
      : process.platform === "darwin"
        ? ["open", [appUrl]]
        : ["xdg-open", [appUrl]];
  const browser = spawn(command[0], command[1], { stdio: "ignore" });
  browser.on("error", () => console.log(`Open ${appUrl} in your browser.`));
  browser.on("exit", (code) => {
    if (code) console.log(`Open ${appUrl} in your browser.`);
  });
}

function waitForPage() {
  let request;
  let timer;
  let cancelled = false;
  const deadline = Date.now() + 180_000;
  function retry() {
    if (cancelled) return;
    if (Date.now() > deadline) {
      console.log(`The first compile is taking longer than expected. Open ${appUrl} manually.`);
      return;
    }
    timer = setTimeout(poll, 1000);
  }
  function poll() {
    request = http.get(appUrl, (response) => {
      let content = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (content += chunk));
      response.on("end", () => {
        if (cancelled) return;
        const loginRedirect =
          response.statusCode === 307 &&
          ["/login", `${appUrl}/login`].includes(response.headers.location);
        if (
          (response.statusCode === 200 && content.includes("XT Trade Journal AI")) ||
          loginRedirect
        ) {
          console.log(`\nXT is ready: ${appUrl}`);
          openBrowser();
        } else retry();
      });
      response.on("error", retry);
    });
    request.setTimeout(15_000, () => request.destroy());
    request.on("error", retry);
  }
  poll();
  return () => {
    cancelled = true;
    clearTimeout(timer);
    request?.destroy();
  };
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 22) {
    throw new Error("Node.js 22+ is required. Install the LTS version from nodejs.org.");
  }
  await checkPort();
  console.log("\nXT Trade Journal AI - installing/checking project dependencies...");
  console.log("The first run needs an internet connection. Keep this window open.\n");
  await finished(pnpm(["install", "--frozen-lockfile"]));
  const require = createRequire(appPackage);
  try {
    const Database = require("better-sqlite3");
    const database = new Database(":memory:");
    database.close();
  } catch (cause) {
    throw new Error("The SQLite component could not load. See its installation output above.", {
      cause,
    });
  }
  // Installation can take minutes: verify the port again before starting.
  await checkPort();
  console.log("\nStarting XT. Your browser will open when the page is ready.");
  console.log("Keep this window open while using XT. Press Ctrl+C to stop.\n");
  const server = pnpm([
    "--filter",
    "web",
    "exec",
    "next",
    "dev",
    "--turbopack",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ]);
  const completion = finished(server);
  const stopPolling = waitForPage();
  try {
    await completion;
  } finally {
    stopPolling();
  }
}

main().catch((error) => {
  console.error(`\nXT could not start: ${error.message}`);
  process.exitCode = 1;
});
