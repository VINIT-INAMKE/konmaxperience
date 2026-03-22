# Requirements: Konma Xperience OS

**Defined:** 2026-03-22
**Core Value:** Every piece of work must be evidence-backed, approved, and validated before it counts — turning real execution into measurable readiness and progress across the entire operation.

## v1.1 Requirements

Requirements for milestone v1.1 — User Guide System. Each maps to roadmap phases.

### Guide Infrastructure

- [ ] **GUIDE-01**: Admin can create, edit, and delete guide sections (top-level categories like Kitchen, POS, Inventory)
- [ ] **GUIDE-02**: Admin can create, edit, and delete guide pages within sections
- [ ] **GUIDE-03**: Admin can assign roles to sections — mapped roles see the section, unmapped don't
- [ ] **GUIDE-04**: Admin can set page status to draft or published — drafts visible only to admin/tech
- [ ] **GUIDE-05**: Admin can reorder sections and pages via sort position

### Rich Text Editor

- [ ] **EDIT-01**: Admin can edit page content with Tiptap rich text editor (headings, lists, bold/italic/underline, links)
- [ ] **EDIT-02**: Admin can upload and embed images inline via R2 presigned URLs
- [ ] **EDIT-03**: Admin can insert styled callout blocks (tip, warning, info) within page content
- [ ] **EDIT-04**: Content is sanitized server-side on save (DOMPurify) to prevent XSS

### Reader Experience

- [ ] **READ-01**: User sees only guide sections assigned to their role on the guide index page
- [ ] **READ-02**: User can read guide pages in a polished, styled view with MagicUI components
- [ ] **READ-03**: User can search across all visible guide pages via full-text search
- [ ] **READ-04**: Admin/tech can preview the guide as any role to verify content visibility
- [ ] **READ-05**: Guide pages render with section sidebar navigation for easy browsing

### Content Seeding

- [ ] **SEED-01**: System ships with pre-written guide sections for all major feature areas (Kitchen, POS, Inventory, Recipes, Missions, Evidence, etc.)
- [ ] **SEED-02**: Each section contains step-by-step workflow walkthroughs generated from actual codebase
- [ ] **SEED-03**: Sections are pre-mapped to the correct roles based on existing RBAC permissions
- [ ] **SEED-04**: All seeded content is editable by admin post-deployment

## Future Requirements

### Guide Enhancements

- **GUIDE-06**: Version history with single-step undo for guide pages
- **GUIDE-07**: PDF/print export of guide pages
- **GUIDE-08**: Contextual "?" help links in app headers linking to relevant guide section

## Out of Scope

| Feature | Reason |
|---------|--------|
| Interactive onboarding wizards | High complexity, walkthroughs are sufficient for 8-person team |
| Video embeds in guides | Storage/bandwidth cost, screenshots + text covers the use case |
| User comments/feedback on guide pages | Overengineering for internal team docs |
| Code blocks in editor | Not needed for operational user guides |
| Multi-language/i18n guides | English-only team, no translation needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GUIDE-01 | — | Pending |
| GUIDE-02 | — | Pending |
| GUIDE-03 | — | Pending |
| GUIDE-04 | — | Pending |
| GUIDE-05 | — | Pending |
| EDIT-01 | — | Pending |
| EDIT-02 | — | Pending |
| EDIT-03 | — | Pending |
| EDIT-04 | — | Pending |
| READ-01 | — | Pending |
| READ-02 | — | Pending |
| READ-03 | — | Pending |
| READ-04 | — | Pending |
| READ-05 | — | Pending |
| SEED-01 | — | Pending |
| SEED-02 | — | Pending |
| SEED-03 | — | Pending |
| SEED-04 | — | Pending |

**Coverage:**
- v1.1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 ⚠️

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
