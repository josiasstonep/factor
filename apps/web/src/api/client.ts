import type {
  GenerateBatchResponse,
  ReportInputCreate,
  Template,
  TemplateSection,
  TemplateVariable,
  TemplateImagePlaceholder,
} from "./types";

const SIDECAR_PORT = 8731;
const BASE_URL = `http://127.0.0.1:${SIDECAR_PORT}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
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
