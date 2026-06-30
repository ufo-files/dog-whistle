const { chromium } = require("@playwright/test");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "screenshots");
const VIEWPORT = { width: 1440, height: 1000 };

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function startServer(port) {
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  return server;
}

async function waitForServer(port) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const socket = net.connect(port, "127.0.0.1", () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error("Timed out waiting for screenshot server");
}

async function setVisualization(page, mode) {
  await page.selectOption("#visualization", mode);
  await page.waitForFunction((value) => document.querySelector("#visualization")?.value === value, mode);
  await page.waitForTimeout(mode === "sphere" ? 1800 : 700);
}

async function capture(page, name) {
  await page.evaluate(() => {
    if (!document.getElementById("screenshot-outline-style")) {
      const style = document.createElement("style");
      style.id = "screenshot-outline-style";
      style.textContent = `
        html.screenshot-outline::after {
          content: "";
          position: fixed;
          inset: 0;
          border: 1px solid #111;
          pointer-events: none;
          z-index: 2147483647;
        }
      `;
      document.head.appendChild(style);
    }
    document.documentElement.classList.add("screenshot-outline");
  });
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const port = await findOpenPort();
  const server = startServer(port);
  const baseUrl = `http://127.0.0.1:${port}/`;

  try {
    await waitForServer(port);
    const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector("#play", { timeout: 30000 });
    await page.click("#play");
    await page.waitForFunction(() => document.querySelector("#status")?.textContent?.includes("straight audio"));
    await page.waitForTimeout(1200);

    await setVisualization(page, "sphere");
    await capture(page, "dog-whistle-sphere");

    await setVisualization(page, "circle");
    await capture(page, "dog-whistle-circle");

    await setVisualization(page, "waveform");
    await capture(page, "dog-whistle-waveform");

    await browser.close();
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
