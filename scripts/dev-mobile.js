import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDir = path.resolve(frontendDir, "..");
const backendDir = path.join(projectDir, "backend");
const backendEnvFile = path.join(backendDir, ".env");
const isWindows = process.platform === "win32";
const children = [];
let stopping = false;
let tunnelUrl = "";

function log(message = "") { console.log(message); }
function readEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 1) continue;
    values[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function commandExists(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", stdio: "ignore", shell: isWindows });
  return result.status === 0;
}
function checkPortFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") reject(new Error(`Port ${port} is already in use. Stop the existing frontend/backend terminal first.`));
      else reject(error);
    });
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
function spawnTracked(label, command, args, options = {}) {
  const child = spawn(command, args, { cwd: options.cwd || projectDir, env: options.env || process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, shell: false });
  child.label = label;
  children.push(child);
  const print = (chunk) => {
    const value = String(chunk).trimEnd();
    if (value) for (const line of value.split(/\r?\n/)) log(`[${label}] ${line}`);
  };
  child.stdout?.on("data", print);
  child.stderr?.on("data", print);
  child.on("error", (error) => {
    if (!stopping) {
      log(`[${label}] Could not start: ${error.message}`);
      void shutdown(1);
    }
  });
  child.on("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      log(`[${label}] stopped (code ${code ?? "unknown"}${signal ? `, signal ${signal}` : ""}).`);
      void shutdown(code || 1);
    }
  });
  return child;
}
async function fetchReady(url, label, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (stopping) throw new Error("Startup cancelled.");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2500), cache: "no-store" });
      if (response.ok) return await response.text();
    } catch { /* The process is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`${label} did not become ready at ${url}. Check the terminal output above.`);
}
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  log("\nStopping Atlas CRM mobile test servers and temporary HTTPS tunnel…");
  for (const child of [...children].reverse()) {
    try { if (child.exitCode == null && !child.killed) child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(code), 1200);
}
process.once("SIGINT", () => void shutdown(0));
process.once("SIGTERM", () => void shutdown(0));

async function main() {
  if (!fs.existsSync(backendEnvFile)) {
    log("Missing backend/.env. From the backend folder run: Copy-Item .env.example .env");
    process.exitCode = 1;
    return;
  }
  const config = readEnvFile(backendEnvFile);
  if (!config.MONGODB_URI) {
    log("MONGODB_URI is empty in backend/.env. Configure MongoDB before starting the mobile test.");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(path.join(frontendDir, "node_modules", "vite", "bin", "vite.js")) || !fs.existsSync(path.join(backendDir, "node_modules", "express", "package.json"))) {
    log("Dependencies appear to be missing. Install each project separately:");
    log("  cd frontend; npm.cmd install");
    log("  cd ../backend; npm.cmd install");
    process.exitCode = 1;
    return;
  }
  if (!commandExists("cloudflared")) {
    log("cloudflared is not installed or is not on PATH.");
    log("Install it once in Windows PowerShell:");
    log("  winget install -e --id Cloudflare.cloudflared");
    log("Then close and reopen the terminal and run: npm.cmd run dev:mobile");
    process.exitCode = 1;
    return;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  let accessEmail = "";
  try {
    accessEmail = (await rl.question("Email address you can access for the temporary HTTPS one-time PIN: ")).trim();
  } finally { rl.close(); }
  if (!validEmail(accessEmail)) {
    log("A valid inbox email is required so the temporary public test URL can be protected by an email PIN.");
    process.exitCode = 1;
    return;
  }

  const apiPort = Number(config.PORT || 5000);
  try {
    await checkPortFree(apiPort);
    await checkPortFree(5173);
  } catch (error) {
    log(error.message);
    log("Close the old API/Vite terminals with Ctrl+C, then run this command again.");
    process.exitCode = 1;
    return;
  }

  log("\nStarting the temporary HTTPS tunnel. It is restricted to the email you entered.");
  log("The tunnel will expose the frontend only; /api requests are proxied to Express on loopback.");
  const tunnel = spawnTracked("HTTPS TUNNEL", "cloudflared", ["tunnel", "--url", "http://127.0.0.1:5173", "--allowed-mail", accessEmail], { cwd: projectDir, env: { ...process.env } });
  let collected = "";
  const captureTunnel = (chunk) => {
    collected += String(chunk);
    const match = collected.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !tunnelUrl) tunnelUrl = match[0].replace(/[.,;]+$/, "");
  };
  tunnel.stdout?.on("data", captureTunnel);
  tunnel.stderr?.on("data", captureTunnel);
  const tunnelStart = Date.now();
  while (!tunnelUrl && Date.now() - tunnelStart < 60_000 && tunnel.exitCode == null && !stopping) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!tunnelUrl) {
    log("Cloudflare did not provide a trycloudflare.com URL in 60 seconds. Review the tunnel output above.");
    await shutdown(1);
    return;
  }
  const parsedUrl = new URL(tunnelUrl);
  const tunnelHost = parsedUrl.hostname;
  const sharedEnv = {
    ...process.env,
    CRM_ENABLE_QUICK_TUNNEL: "1",
    CRM_TUNNEL_ORIGIN: tunnelUrl,
    PHARMA_TUNNEL_HOST: tunnelHost,
  };

  log("\nStarting Express API and the Vite frontend…");
  spawnTracked("API", process.execPath, [path.join(backendDir, "src", "server.js")], { cwd: backendDir, env: sharedEnv });
  try {
    const healthText = await fetchReady(`http://127.0.0.1:${apiPort}/api/health`, "Express API");
    const health = JSON.parse(healthText);
    if (health?.data?.database !== "connected") throw new Error("Express is reachable, but MongoDB is not connected. Check MONGODB_URI and Atlas IP access list.");
  } catch (error) {
    log(error.message);
    await shutdown(1);
    return;
  }

  spawnTracked("VITE", process.execPath, [path.join(frontendDir, "node_modules", "vite", "bin", "vite.js")], { cwd: frontendDir, env: sharedEnv });
  try {
    await fetchReady("http://127.0.0.1:5173/", "Vite frontend");
  } catch (error) {
    log(error.message);
    await shutdown(1);
    return;
  }

  log("\n========================================================");
  log("Atlas CRM is ready for mobile + desktop testing.");
  log(`HTTPS URL: ${tunnelUrl}`);
  log(`Email gate: ${accessEmail}`);
  log(`Local PC URL: http://localhost:5173 (use the HTTPS URL on both devices for one shared test session)`);
  log("On the phone: open the HTTPS URL → enter email OTP → sign into Atlas CRM → allow Camera and Location.");
  log("Camera/GPS use browser permission. This URL is temporary and stops when you press Ctrl+C.");
  log("For PC browser camera/GPS, use the same HTTPS URL; localhost works for local-only testing.");
  log("Press Ctrl+C here to stop API, Vite, and the public tunnel.");
  log("========================================================\n");

  // Keep process alive while all services run.
  await new Promise((resolve) => {
    const check = setInterval(() => {
      if (stopping || children.some((child) => child.exitCode !== null)) { clearInterval(check); resolve(); }
    }, 1000);
  });
}

main().catch(async (error) => {
  log(`Mobile test startup failed: ${error?.message || error}`);
  await shutdown(1);
});
