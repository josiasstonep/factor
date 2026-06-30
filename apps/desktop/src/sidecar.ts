import { ChildProcess, spawn } from "child_process";
import path from "path";
import { app } from "electron";

const DEV_PORT = 8731;

let sidecarProcess: ChildProcess | null = null;
let sidecarPort = DEV_PORT;

export function getSidecarPort(): number {
  return sidecarPort;
}

async function waitForHealth(port: number, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {
      // sidecar not up yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

export async function ensureSidecar(): Promise<void> {
  if (!app.isPackaged) {
    // Dev mode: the sidecar is started separately by `npm run dev` (root)
    // via `dev:sidecar`, so we just wait for it to come up.
    const healthy = await waitForHealth(DEV_PORT);
    if (!healthy) {
      throw new Error(
        `Sidecar Python não respondeu em http://127.0.0.1:${DEV_PORT}/health. ` +
          "Rode 'npm run dev' na raiz do projeto (ele sobe o sidecar junto).",
      );
    }
    return;
  }

  sidecarPort = DEV_PORT;
  const exePath = path.join(process.resourcesPath, "sidecar", "sidecar.exe");
  sidecarProcess = spawn(exePath, ["--port", String(sidecarPort)], { stdio: "ignore" });

  const healthy = await waitForHealth(sidecarPort);
  if (!healthy) {
    throw new Error("Não foi possível iniciar o backend Python (sidecar).");
  }
}

export function stopSidecar(): void {
  sidecarProcess?.kill();
  sidecarProcess = null;
}
