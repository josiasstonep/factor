import type { TemplateVariable } from "../api/types";

const STANDARD_FORENSIC_VARS: { key: string; label: string }[] = [
  { key: "modelo",             label: "Modelo" },
  { key: "imei1",              label: "IMEI 1" },
  { key: "imei2",              label: "IMEI 2" },
  { key: "nome_perito",        label: "Nome do Perito" },
  { key: "matricula_perito",   label: "Matrícula do Perito" },
  { key: "delegacia_requisitante", label: "Delegacia Requisitante" },
  { key: "trecho_solicitacao", label: "Trecho da Solicitação" },
];

// Stable IDs so BatchForm and BatchPreview refer to the same variable across renders.
// These never collide with real UUIDs (which contain hyphens in groups of 8-4-4-4-12).
function stableId(key: string): string {
  return `__std__${key}`;
}

export function mergeStandardVars(vars: TemplateVariable[]): TemplateVariable[] {
  const existingKeys = new Set(vars.map((v) => v.key));
  const extras = STANDARD_FORENSIC_VARS
    .filter((s) => !existingKeys.has(s.key))
    .map((s): TemplateVariable => ({
      id: stableId(s.key),
      key: s.key,
      label: s.label,
      source_label_detected: null,
      source_value_detected: null,
      required: true,
      value_type: "text",
    }));
  return [...vars, ...extras];
}
