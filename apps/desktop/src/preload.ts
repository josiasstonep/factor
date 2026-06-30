import { contextBridge } from "electron";

// Reserved for OS-native concerns (native dialogs, secret storage for AI
// provider API keys in M3+). The renderer talks to the Python sidecar
// directly over HTTP, not through this bridge.
contextBridge.exposeInMainWorld("factor", {
  isElectron: true,
});
