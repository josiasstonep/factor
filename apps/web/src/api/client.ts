import type {
  AiProviderInfo,
  Delegacia,
  GenerateBatchResponse,
  ImproveResponse,
  ImproveTextResponse,
  Perito,
  ReportInputCreate,
  Template,
  TemplateImagePlaceholder,
  TemplateSection,
  TemplateVariable,
} from "./types";

const SIDECAR_PORT = 8731;
const BASE_URL = `http://127.0.0.1:${SIDECAR_PORT}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function parseTemplate(file: File): Promise<Template> {
  const form = new FormData();
  form.append("file", file);
  return request<Template>("/templates/parse", { method: "POST", body: form });
}

export async function listTemplates(): Promise<Template[]> {
  return request<Template[]>("/templates");
}

export async function getTemplate(id: string): Promise<Template> {
  return request<Template>(`/templates/${id}`);
}

export interface TemplateUpdatePayload {
  name: string;
  sections: TemplateSection[];
  variables: TemplateVariable[];
  image_placeholders: TemplateImagePlaceholder[];
  confirm: boolean;
  header_image_path: string | null;
  footer_image_path: string | null;
}

export async function updateTemplate(
  id: string,
  payload: TemplateUpdatePayload,
): Promise<Template> {
  return request<Template>(`/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function renameTemplate(id: string, name: string): Promise<Template> {
  return request<Template>(`/templates/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  await request<void>(`/templates/${id}`, { method: "DELETE" });
}

export async function listBuiltinTypes(): Promise<{ key: string; label: string }[]> {
  return request<{ key: string; label: string }[]>("/templates/builtin/types");
}

export async function createBuiltinTemplate(expertiseType: string): Promise<Template> {
  return request<Template>(`/templates/builtin/${encodeURIComponent(expertiseType)}`, { method: "POST" });
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<{ file_path: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ file_path: string }>("/uploads/image", {
    method: "POST",
    body: form,
  });
}

// ─── Report generation ───────────────────────────────────────────────────────

export async function generateBatch(
  templateId: string,
  batchName: string,
  rows: ReportInputCreate[],
): Promise<GenerateBatchResponse> {
  return request<GenerateBatchResponse>("/reports/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId, batch_name: batchName, rows }),
  });
}

export function reportDocxUrl(reportId: string): string {
  return `${BASE_URL}/reports/${reportId}/docx`;
}

export function batchZipUrl(batchId: string): string {
  return `${BASE_URL}/reports/batch/${batchId}/zip`;
}

// ─── AI improvement ───────────────────────────────────────────────────────────

export async function listAiProviders(): Promise<AiProviderInfo[]> {
  return request<AiProviderInfo[]>("/ai/providers");
}

export async function improveSection(
  reportId: string,
  sectionId: string,
  provider: string,
  apiKey: string | null,
  model: string | null,
): Promise<ImproveResponse> {
  return request<ImproveResponse>("/ai/improve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      report_id: reportId,
      section_id: sectionId,
      provider,
      api_key: apiKey,
      model,
    }),
  });
}

export async function improveRawText(
  text: string,
  templateId: string,
  sectionId: string,
  provider: string,
  apiKey: string | null,
  model: string | null,
  caseContext: string | null = null,
  variableValues: Record<string, string> | null = null,
): Promise<ImproveTextResponse> {
  return request<ImproveTextResponse>("/ai/improve-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      template_id: templateId,
      section_id: sectionId,
      provider,
      api_key: apiKey,
      model,
      case_context: caseContext,
      variable_values: variableValues,
    }),
  });
}

export async function acceptSection(
  reportId: string,
  sectionId: string,
  accept: boolean,
): Promise<void> {
  await request("/ai/accept", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_id: reportId, section_id: sectionId, accept }),
  });
}

// ─── Peritos ─────────────────────────────────────────────────────────────────

export async function listPeritos(): Promise<Perito[]> {
  return request<Perito[]>("/peritos");
}

export async function createPerito(data: { nome: string; matricula: string; cargo?: string }): Promise<Perito> {
  return request<Perito>("/peritos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updatePerito(id: string, data: { nome: string; matricula: string; cargo?: string }): Promise<Perito> {
  return request<Perito>(`/peritos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deletePerito(id: string): Promise<void> {
  await request<void>(`/peritos/${id}`, { method: "DELETE" });
}

// ─── Delegacias ───────────────────────────────────────────────────────────────

export async function listDelegacias(): Promise<Delegacia[]> {
  return request<Delegacia[]>("/delegacias");
}

export async function createDelegacia(data: { nome: string; municipio?: string }): Promise<Delegacia> {
  return request<Delegacia>("/delegacias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateDelegacia(id: string, data: { nome: string; municipio?: string }): Promise<Delegacia> {
  return request<Delegacia>(`/delegacias/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteDelegacia(id: string): Promise<void> {
  await request<void>(`/delegacias/${id}`, { method: "DELETE" });
}

// ─── Config (API keys) ────────────────────────────────────────────────────────

export interface KeysStatus {
  groq: boolean;
  openai: boolean;
  claude: boolean;
  gemini: boolean;
}

export async function getKeysStatus(): Promise<KeysStatus> {
  return request<KeysStatus>("/config/keys");
}

export async function saveKeys(keys: Partial<Record<"groq" | "openai" | "claude" | "gemini", string>>): Promise<void> {
  await request("/config/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(keys),
  });
}
