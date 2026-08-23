/**
 * @deprecated Compatibility shim. The permission-derived sidebar was replaced by
 * the `ModuleAccess`-driven navigation spine (SPEC §6.2). Import
 * `SpineNav` from `@/components/ops/nav/SpineNav` instead; this file is deleted
 * once no importer remains (Task 19).
 */
export { SpineNav as Sidebar } from '@/components/ops/nav/SpineNav';
export type { SpineNavProps as SidebarProps } from '@/components/ops/nav/SpineNav';
