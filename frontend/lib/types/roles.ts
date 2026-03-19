export enum RoleCode {
  FOUNDER_ADMIN = 'FOUNDER_ADMIN',
  FRONTEND_LEAD = 'FRONTEND_LEAD',
  BACKEND_LEAD = 'BACKEND_LEAD',
  BI_LEAD = 'BI_LEAD',
  PROCUREMENT_LEAD = 'PROCUREMENT_LEAD',
  TALENT_LEAD = 'TALENT_LEAD',
  TECH_LEAD = 'TECH_LEAD',
  DESIGN_OUTREACH_LEAD = 'DESIGN_OUTREACH_LEAD',
}

export const ROLE_DISPLAY_NAMES: Record<RoleCode, string> = {
  [RoleCode.FOUNDER_ADMIN]: 'Founder/Admin',
  [RoleCode.FRONTEND_LEAD]: 'Frontend Lead',
  [RoleCode.BACKEND_LEAD]: 'Backend Lead',
  [RoleCode.BI_LEAD]: 'BI Lead',
  [RoleCode.PROCUREMENT_LEAD]: 'Procurement Lead',
  [RoleCode.TALENT_LEAD]: 'Talent Lead',
  [RoleCode.TECH_LEAD]: 'Tech Lead',
  [RoleCode.DESIGN_OUTREACH_LEAD]: 'Design/Outreach Lead',
};
