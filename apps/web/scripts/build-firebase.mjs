import { spawnSync } from "node:child_process";
import process from "node:process";
import { loadEnv } from "vite";

const env = { ...loadEnv("production", process.cwd(), "VITE_"), ...process.env };

function requireHttpsUrl(name, value, expectedPath) {
  if (!value) {
    throw new Error(`Set ${name} in apps/web/.env.production before building for Firebase Hosting.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a full HTTPS URL.`);
  }

  if (
    url.protocol !== "https:"
    || url.hostname === "localhost"
    || url.hostname.includes("example")
    || url.hostname.startsWith("your-")
    || url.hostname.includes("placeholder")
  ) {
    throw new Error(`${name} must use the real HTTPS production service URL, not localhost or an example host.`);
  }
  if (expectedPath && url.pathname.replace(/\/+$/, "") !== expectedPath) {
    throw new Error(`${name} must end with ${expectedPath}.`);
  }
  if (expectedPath && (url.search || url.hash)) {
    throw new Error(`${name} must not include a query string or fragment.`);
  }
  if (!expectedPath && (url.pathname !== "/" || url.search || url.hash)) {
    throw new Error(`${name} must contain only the HTTPS service origin.`);
  }
}

requireHttpsUrl("VITE_API_URL", env.VITE_API_URL?.trim(), "/api");
if (env.VITE_SOCKET_URL?.trim()) {
  requireHttpsUrl("VITE_SOCKET_URL", env.VITE_SOCKET_URL.trim());
}

const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) {
  throw new Error("Run this command with npm run build:firebase --workspace @namsamart/web.");
}

const result = spawnSync(process.execPath, [npmCliPath, "run", "build"], {
  cwd: process.cwd(),
  stdio: "inherit"
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
