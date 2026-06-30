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
