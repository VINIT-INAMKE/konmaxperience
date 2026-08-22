import { RoleCode } from '../../src/types/roles';
import { Permission } from '../../src/types/permissions';

export interface RoleSeed {
  code: RoleCode;
  name: string;
  description: string;
  permissions: Permission[];
  functionDomain: string;
  userName: string;
  userEmail: string;
}

export const ROLE_SEEDS: RoleSeed[] = [
  {
    code: RoleCode.FOUNDER_ADMIN,
    name: 'Founder/Admin',
    description: 'Strategy, mission control, escalations, overrides. Full system access.',
    permissions: Object.values(Permission),
    functionDomain: 'operations',
    userName: 'Admin',
    userEmail: 'admin@konma.store',
  },
  {
    code: RoleCode.FRONTEND_LEAD,
    name: 'Frontend Lead',
    description: 'Customer flow, service, beverage, space interaction, channels.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Advitha2',
    userEmail: 'advitha2@konma.store',
  },
  {
    code: RoleCode.BACKEND_LEAD,
    name: 'Backend Lead',
    description: 'Food, production, R&D, standardization, quality.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'food',
    userName: 'Sadhana',
    userEmail: 'sadhana@konma.store',
  },
  {
    code: RoleCode.BI_LEAD,
    name: 'BI Lead',
    description: 'Costing, pricing, KPIs, performance analytics.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
      Permission.MANAGE_KPIS,
    ],
    functionDomain: 'bi',
    userName: 'Hasmitha',
    userEmail: 'hasmitha@konma.store',
  },
  {
    code: RoleCode.PROCUREMENT_LEAD,
    name: 'Procurement Lead',
    description: 'Vendors, sourcing, inventory management.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.APPROVE_EVIDENCE,
      Permission.VERIFY_TASK,
      Permission.MANAGE_INVENTORY,
      Permission.MANAGE_PROCUREMENT,
      Permission.MANAGE_KITCHEN,
    ],
    functionDomain: 'procurement',
    userName: 'Surya',
    userEmail: 'surya@konma.store',
  },
  {
    code: RoleCode.TALENT_LEAD,
    name: 'Talent Lead',
    description: 'Onboarding, training, hiring, team readiness.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
    ],
    functionDomain: 'talent',
    userName: 'Sathya',
    userEmail: 'sathya@konma.store',
  },
  {
    code: RoleCode.TECH_LEAD,
    name: 'Tech Lead',
    description: 'Dashboard, automations, integrations, system infrastructure.',
    permissions: Object.values(Permission),
    functionDomain: 'tech',
    userName: 'Vinit',
    userEmail: 'vinit@konma.store',
  },
  {
    code: RoleCode.DESIGN_OUTREACH_LEAD,
    name: 'Design/Outreach Lead',
    description: 'Design language, storytelling, experience design, partnerships.',
    permissions: [
      Permission.VIEW_ROLE_SCOPED,
      Permission.UPDATE_OWN_TASK,
      Permission.UPLOAD_EVIDENCE,
      Permission.CREATE_DECISION,
    ],
    functionDomain: 'design',
    userName: 'Advitha',
    userEmail: 'advitha@konma.store',
  },
];
