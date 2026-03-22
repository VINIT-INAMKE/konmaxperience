/** Shallow page data included in section list response (no content field) */
export interface GuideSectionPage {
  id: string;
  title: string;
  slug: string;
  sort_order: number;
  status: 'draft' | 'published';
  summary: string | null;
  estimated_read_time: number | null;
}

/** Section with embedded page list from GET /guide/sections */
export interface GuideSection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  accent_color: string | null;
  sort_order: number;
  role_codes: string[];
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  pages: GuideSectionPage[];
}

/** Full page data from GET /guide/pages/:id (includes content) */
export interface GuidePage {
  id: string;
  section_id: string;
  title: string;
  slug: string;
  sort_order: number;
  content: string;
  summary: string | null;
  estimated_read_time: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  section: {
    role_codes: string[];
    status: string;
  };
}
