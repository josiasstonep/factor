import { ChildProcess, spawn } from "child_process";
import path from "path";
import { app } from "electron";

export const SIDECAR_PORT = 8731;

let sidecarProcess: ChildProcess | null = null;

async function waitForHealth(port: number, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

export async function ensureSidecar(): Promise<void> {
  if (!app.isPackaged) {
    const healthy = await waitForHealth(SIDECAR_PORT);
    if (!healthy) {
      throw new Error(
        `Sidecar Python não respondeu em http://127.0.0.1:${SIDECAR_PORT}/health. ` +
          "Rode 'npm run dev' na raiz do projeto (ele sobe o sidecar junto).",
      );
    }
    return;
  }

  const sidecarDir = path.join(process.resourcesPath, "sidecar");
  const exeName = process.platform === "win32" ? "sidecar.exe" : "sidecar";
  const exePath = path.join(sidecarDir, exeName);
  const dataDir = path.join(app.getPath("userData"), "factor-data");

  sidecarProcess = spawn(exePath, ["--port", String(SIDECAR_PORT)], {
    stdio: "ignore",
    env: { ...process.env, FACTOR_DATA_DIR: dataDir },
  });

  sidecarProcess.on("error", (err) => {
    console.error("Sidecar process error:", err);
  });

  const healthy = await waitForHealth(SIDECAR_PORT);
  if (!healthy) {
    throw new Error(
      "Não foi possível iniciar o backend Python (sidecar). " +
        `Executável esperado em: ${exePath}`,
    );
  }
}

export function stopSidecar(): void {
  sidecarProcess?.kill();
  sidecarProcess = null;
}
