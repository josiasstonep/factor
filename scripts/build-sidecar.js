#!/usr/bin/env node
// Cross-platform build script for the Python sidecar (PyInstaller).
// Works on Windows CMD, PowerShell, and bash alike.
const { spawnSync } = require("child_process");
const path = require("path");

const sidecarDir = path.join(__dirname, "..", "services", "sidecar");
const pythonExe =
  process.platform === "win32"
    ? path.join(sidecarDir, ".venv", "Scripts", "python.exe")
    : path.join(sidecarDir, ".venv", "bin", "python");

const result = spawnSync(
  pythonExe,
  [
    "-m", "PyInstaller",
    "build_sidecar.spec",
    "--distpath", "dist",
    "--workpath", path.join("build", "pyinstaller"),
    "--noconfirm",
  ],
  { cwd: sidecarDir, stdio: "inherit" },
);

process.exit(result.status ?? 1);
