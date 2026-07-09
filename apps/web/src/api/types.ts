export type SectionType = "historia" | "descricao" | "analise" | "conclusao" | "custom";
export type ImagePlaceholderType = "vestigio" | "local_crime" | "custom";

export interface TemplateSection {
  id: string;
  type: SectionType;
  label: string;
  order: number;
  heading_text: string | null;
  is_ai_improvable: boolean;
  default_text: string | null;
}

export interface TemplateVariable {
  id: string;
  key: string;
  label: string;
  source_label_detected: string | null;
  source_value_detected: string | null;
  required: boolean;
  value_type: "text" | "date" | "number";
}

export interface TemplateImagePlaceholder {
  id: string;
  type: ImagePlaceholderType;
  label: string;
  order: number;
  max_count: number;
  page_hint: number | null;
  section_id?: string | null;
  preview_image_path?: string | null;
}

export interface Template {
  id: string;
  name: string;
  created_at: string;
  source_pdf_filename: string;
  status: "draft_parsed" | "confirmed";
  sections: TemplateSection[];
  variables: TemplateVariable[];
  image_placeholders: TemplateImagePlaceholder[];
  docx_skeleton_path: string | null;
  header_image_path: string | null;
  footer_image_path: string | null;
  expertise_type: string | null;
}

export interface Perito {
  id: string;
  nome: string;
  matricula: string;
  cargo: string;
}

export interface Delegacia {
  id: string;
  nome: string;
  municipio: string;
}

export interface ReportInputVariableValue {
  variable_id: string;
  value: string;
}

export interface ReportInputSectionText {
  section_id: string;
  text: string;
}

export interface ReportInputImage {
  placeholder_id: string;
  file_path: string;
  order: number;
}

export interface ReportInputCreate {
  template_id: string;
  batch_id?: string | null;
  row_label: string;
  variables: ReportInputVariableValue[];
  sections: ReportInputSectionText[];
  images: ReportInputImage[];
}

export interface GeneratedSection {
  section_id: string;
  original_text: string;
  ai_text: string | null;
  diff: unknown | null;
  accepted: boolean;
  ai_provider_used: string | null;
}

export interface GeneratedReport {
  id: string;
  batch_id: string;
  report_input_id: string;
  template_id: string;
  row_label: string | null;
  docx_path: string;
  sections: GeneratedSection[];
  status: "generated" | "ai_pending" | "ai_reviewed" | "exported";
  generated_at: string;
}

export interface GenerateBatchResponse {
  batch_id: string;
  reports: GeneratedReport[];
  errors: { row_label: string; error: string }[];
}

export interface AiProviderInfo {
  name: string;
  label: string;
  requires_key: boolean;
  available: boolean;
}

export interface DiffOp {
  op: "equal" | "insert" | "delete" | "replace";
  original: string;
  revised: string;
}

export interface ImproveResponse {
  report_id: string;
  section_id: string;
  ai_text: string;
  diff: DiffOp[];
}
