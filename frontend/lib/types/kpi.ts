export type KpiStatus = 'on_track' | 'at_risk' | 'off_track';

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
};

export const KPI_DOMAINS = [
  'backend',
  'frontend',
  'procurement',
  'bi',
  'talent',
  'tech',
  'design',
  'food',
  'ops',
  'sales',
  'standardization',
] as const;

export type KpiDomain = (typeof KPI_DOMAINS)[number];

export const KPI_DOMAIN_LABELS: Record<string, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  procurement: 'Procurement',
  bi: 'Business Intelligence',
  talent: 'Talent',
  tech: 'Tech',
  design: 'Design/Outreach',
  food: 'Food',
  ops: 'Operations',
  sales: 'Sales',
  standardization: 'Standardization',
};

export interface Kpi {
  id: string;
  name: string;
  description: string;
  unit: string;
  target_value: number;
  current_value: number;
  status: KpiStatus;
  domain: string;
  updated_at: string;
  tasks: Array<{ id: string; title: string; valid: boolean }>;
}

export interface CreateKpiDto {
  name: string;
  description: string;
  unit: string;
  target_value: number;
  current_value?: number;
  status?: KpiStatus;
  domain: string;
  linked_task_ids?: string[];
}

export interface UpdateKpiDto {
  name?: string;
  description?: string;
  unit?: string;
  target_value?: number;
  current_value?: number;
  status?: KpiStatus;
  linked_task_ids?: string[];
}
