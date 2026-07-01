import { contextBridge } from "electron";
import { SIDECAR_PORT } from "./sidecar";

contextBridge.exposeInMainWorld("factor", {
  isElectron: true,
  sidecarPort: SIDECAR_PORT,
});
