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
      // The front-of-house lead is a named `daily_close.signer_role_codes`
      // signatory and owns channels, but every daily-close route is
      // `MANAGE_OPS`-gated — without this grant a named signer 403s at the
      // controller before the signer check in the service ever runs (P6).
      Permission.MANAGE_OPS,
      // The same role runs the till: POS order-taking, order lifecycle and
      // refunds are all MANAGE_POS-gated, and its module grant exposes those
      // screens (found writing the team walkthroughs).
      Permission.MANAGE_POS,
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
      // The kitchen lead's whole module group (KDS, prep batches, waste,
      // supply usage) is MANAGE_KITCHEN-gated — without it the nav renders
      // but every action 403s (found writing the team walkthroughs).
      Permission.MANAGE_KITCHEN,
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
      // Vendor and vendor-price writes are MANAGE_OPS-gated; the role that
      // owns "Vendors, sourcing" must be able to create both (found writing
      // the team walkthroughs).
      Permission.MANAGE_OPS,
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
      // The role that runs onboarding/training must drive the mission loop,
      // and the seeded `hiring` approval policy names TALENT_LEAD as a
      // required approver — a required approver must hold APPROVE_EVIDENCE
      // (found writing the team walkthroughs).
      Permission.CREATE_TASK,
      Permission.CREATE_QUEST,
      Permission.APPROVE_EVIDENCE,
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
      // This role's entire module grant (catalog, experiences, brands,
      // assets, promotions) is MANAGE_OPS-gated — without it Experiences and
      // Promotions do not even load (found writing the team walkthroughs).
      Permission.MANAGE_OPS,
    ],
    functionDomain: 'design',
    userName: 'Advitha',
    userEmail: 'advitha@konma.store',
  },
];
