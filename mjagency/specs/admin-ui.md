specs/admin-ui.md - MJAgency Admin Panel UI Spec

All admin panels powered by Payload CMS 3.82.1.
Embedded in each agency's Next.js app (not a separate service).
Three admin contexts: super_admin (global), admin (per-agency), editor (CMS only).

==============================================================
ADMIN ACCESS POINTS
==============================================================
Main brand admin:   brand.com/admin         (super_admin only)
Agency admin:       ecommerce.brand.com/admin  (admin for that agency)
                    growth.brand.com/admin
                    etc. (one per agency)

URL: /admin (Payload default, not /dashboard or /cms)
Not linked from public site. IP-whitelisted via Cloudflare WAF.
X-Robots-Tag: noindex on all /admin routes.

==============================================================
ADMIN NAVIGATION STRUCTURE
==============================================================
Payload admin sidebar (left, collapsible):

MAIN BRAND ADMIN (super_admin sees all):
  ─── Platform ───
    Dashboard          (platform overview: all 12 agencies)
    All Agencies       (manage all agency configs)
    Platform Settings  (global secrets, feature flags)
    Cost Overview      (per-agency cost dashboard)

  ─── Content ───
    Pages              (all pages, all agencies)
    Posts              (all blog posts, all agencies)
    Authors            (all authors, all agencies)
    Categories         (all categories, all agencies)
    Media Library      (global DAM - all assets, all agencies)

  ─── System ───
    Audit Log          (hash-chained, read-only)
    Migration Manager  (run/rollback migrations per agency)
    Seed Manager       (re-seed or update seed data)
    Backup Status      (last backup timestamp per agency)

PER-AGENCY ADMIN (admin sees own agency only):
  ─── Dashboard ───
    Overview           (traffic, leads, revenue snapshot)
    Analytics          (GA4 + RUM dashboard embed)
    Content Audit      (coverage %, SEO scores, stale content)

  ─── Content ───
    Pages              (all pages for this agency)
    Blog Posts         (all posts for this agency)
    Authors            (this agency's authors)
    Categories         (this agency's categories)
    Media Library      (this agency's assets only)
    Content Templates  (reusable content blocks)
    Redirects          (301/302 + broken link checker)
    Global Blocks      (edit once, all instances updated)

  ─── Tools ───
    Tool Pages         (3 tools for this agency)
    Benchmark Manager  (update benchmark data per tool)
    Tool Analytics     (completions, email captures, conversions)

  ─── CRM ───
    Contacts           (all contacts)
    Accounts           (all companies)
    Deals              (pipeline kanban)
    Tasks              (task board)
    Sequences          (sequence builder)
    Templates          (email + SMS templates)
    Forms              (form definitions + submissions)
    CRM Analytics      (lead volume, conversion, SLA)

  ─── Bookings ───
    Meetings           (upcoming + past)
    Meeting Types      (Cal.com config)
    Availability       (Cal.com schedule config)

  ─── Revenue ───
    Proposals          (all proposals + e-sign status)
    Invoices           (all invoices + payment status)
    E-sign Vault       (signed PDFs + audit trail)
    Client Portal      (manage client access)

  ─── Settings ───
    Brand Setup Wizard (6-step wizard, only for new setup)
    Brand Identity     (name, tagline, mission)
    Theme             (token editor, theme preview)
    SEO Defaults       (global SEO settings for agency)
    Email Settings     (DKIM/SPF/DMARC status, warm-up status)
    Integration Keys   (Stripe, Cal.com, Twilio, GSC)
    Team              (admin users for this agency)
    Usage & Billing    (storage, AI, bandwidth costs)

EDITOR ADMIN (scoped to their grants only):
  ─── Content (scoped) ───
    Pages              (only pages in editor_grants)
    Blog Posts         (only posts in editor_grants)
    Media Library      (pick-only, no delete)
  No access to: CRM, Revenue, Settings, Analytics, Tools

==============================================================
PAYLOAD ADMIN DASHBOARD (CUSTOM)
==============================================================
Payload's default dashboard replaced with custom dashboard view.
Each agency has its own dashboard component.

SUPER_ADMIN DASHBOARD (brand.com/admin):
  Header metrics (4 cards):
    Total active agencies (12)
    Platform monthly visitors (sum of all agencies)
    Platform monthly leads (sum of all agencies)
    Platform monthly revenue (sum of invoices paid)

  Agency health grid (12 cards, one per agency):
    Agency name + subdomain
    Traffic (7d) with trend arrow
    Leads (7d) with trend arrow
    Content coverage %
    Last deploy date
    Health status badge (green/amber/red)
    Quick link: "Open admin →"

  Alerts panel:
    Failed backups
    Expired permissions
    Stale benchmarks (tool data >12 months)
    Agencies with <50% content coverage

PER-AGENCY DASHBOARD:
  Row 1: Quick stats (4 cards)
    Visitors this month (vs last month %)
    Leads this month (vs last month %)
    Proposals sent (this month)
    Revenue this month ($)

  Row 2: Content status
    Pages: X published / Y draft / Z review
    Posts: X published / Y draft
    Coverage %: progress bar to 100%
    Next stale review: date

  Row 3: CRM snapshot
    New leads (today)
    SLA at risk (leads >3h without response)
    Open deals count + pipeline value
    Meetings today (Cal.com)

  Row 4: Quick actions
    "New post" button
    "New page" button
    "View leads" button
    "Check analytics" link

==============================================================
CONTENT ADMIN UI (PAGES + POSTS)
==============================================================
List view (all pages or posts):
  Table columns: Title / Status badge / Last modified / Author / Word count / SEO score
  Sort: by date / title / status / SEO score
  Filter: by status / category / author / date range
  Bulk actions: publish / unpublish / delete / tag
  Quick-edit: inline title edit without opening full editor
  Search: full-text across titles + content
  New button: prominent top-right

Edit view (single page/post):
  Layout: Main editor (70%) + Sidebar (30%)
  Main: Title field (large) → Slug (auto-generated, editable) → Body (Lexical)
  Sidebar: Status / Publish / Author / Categories / Tags / Featured image /
           SEO panel / Revisions / Meta panel
  Save: auto-save every 30s + manual "Save draft" button
  Publish: "Publish" button → confirmation modal if significant changes
  Preview: "Preview" button → opens new tab with signed preview URL

Revisions (right sidebar panel):
  Shows 20 most recent saves
  Each entry: timestamp + who saved + word count
  Click: shows diff (added green, removed red)
  Restore: button to restore to that version (creates new save, not destructive)

Global blocks UI:
  Edit modal: warns "This will update ALL pages using this block"
  Requires typing "CONFIRM" to save
  Shows: list of pages using this block

==============================================================
MEDIA LIBRARY (DAM) ADMIN UI
==============================================================
Three views (toggle in top bar):
  Grid view (default): thumbnail grid, hover shows metadata
  List view: sortable table with all metadata columns
  Folder view: taxonomy-based browsing

Upload area:
  Drag-and-drop zone (full browser if no file dragged)
  Multi-file upload
  Progress bars per file
  Validation: format / size / resolution / SVG sanitization
  After upload: metadata form slides in (alt text required, tags optional)

Asset detail panel (slides in from right on click):
  Full-size preview (video: player)
  Metadata:
    Alt text (editable, required badge)
    Caption (editable)
    Tags (multi-select)
    Categories (taxonomy)
    Permissions (linked permission file)
    Permission expiry (date + status badge)
  Technical:
    Dimensions, file size, format
    Dominant color swatch + palette
    BlurHash preview
  Usage:
    Pages using this asset (list with links)
    Usage count
    Fatigue score
  Actions:
    Download original
    Replace (keeps same URL, updates asset)
    Archive
    Delete (disabled if used on published page)

Search bar (top of DAM):
  Text search: filename + alt text + tags
  Semantic search: toggle (slower, but finds conceptually similar)
  Color search: color picker → finds similar palette
  Filters: category / type / status / date / agency (super_admin only)

Smart collections (saved searches):
  "Needs alt text" (auto-query)
  "Expiring permissions 30d" (auto-query)
  "Orphan assets" (unused >90 days)
  Admin can save any search as named collection

==============================================================
CRM ADMIN UI
==============================================================
(Detailed CRM admin UI documented in specs/crm.md)
Summary of key views:

Contacts list: searchable table, filters, bulk actions, Cmd+K search
Contact detail: timeline, deals, tasks, sequences, custom fields
Pipeline kanban: drag-drop deal cards between stages
Deal detail: full history, proposal link, invoice link, e-sign status
Task board: by due date / priority / assignee
Sequence builder: step-by-step visual editor (delay + email + SMS)
Template editor: rich text with merge tags, send test button
Form builder: drag-drop field order, spam settings, routing
CRM analytics: lead volume chart / conversion funnel / SLA compliance

==============================================================
TOOL ADMIN UI
==============================================================
Tool list: all 3 agency tools in a simple table
  Status badge / Last benchmark update / Completions (30d) / Email captures

Tool editor:
  Tool name + slug (locked after publish)
  Calculator config: input field definitions + calculation formula
  Benchmark data: JSON editor OR structured form
  Benchmark source: URL + date (validated)
  Benchmark expiry: auto-calculated, shows warning at 30d
  Result copy: 3 score bands (low/mid/high) + copy per band
  PDF template: select template + preview
  CRM hook: sequence to enroll + tag to apply
  Publish button: validates all fields before allowing publish

Benchmark manager:
  Shows all tools across all agencies (super_admin) or own agency (admin)
  Color-coded: Green (fresh) / Yellow (expiring 30d) / Red (expired)
  Update button per tool: opens benchmark data editor
  Bulk update: import new benchmark JSON

==============================================================
PROPOSAL + INVOICE ADMIN UI
==============================================================
Proposals list: table with status / viewed / signed / expiry date
  Filter: draft / sent / viewed / signed / expired
  Click to view: opens proposal preview + management panel

Proposal detail view:
  Left: proposal preview (same as client sees)
  Right panel:
    Status badge + timeline
    View tracking: "Opened X times, last at [time]"
    Time on page: "Total 4m 32s across X views"
    Send/resend button
    Change expiry date
    Download PDF
    Mark won/lost

Invoice list: all invoices, status, amounts, due dates
Invoice detail:
  Preview of invoice
  Payment history
  Stripe payment link
  Refund button (owner only, requires confirmation)
  Chargeback evidence packet (auto-compiled PDF download)

E-sign vault:
  All signed documents
  Filter by deal / date / signer
  Download signed PDF
  View audit trail (signer name, email, IP, timestamp)

==============================================================
BOOKING ADMIN UI (Cal.com INTEGRATION)
==============================================================
Meetings list: upcoming / past / cancelled / no-show
  Each: time / contact / meeting type / status badge / outcome field

Meeting detail:
  Contact link (goes to CRM contact)
  Deal link (goes to CRM deal)
  Video link (Zoom/Meet/Cal Video)
  Notes field (visible to owner, not client)
  Outcome: Qualified / Not qualified / Follow-up needed / Won
  Add task: create follow-up task from meeting

Meeting types (Cal.com config in admin):
  Manage all 6 meeting types
  Name / Duration / Location / Description
  Availability rules: min notice / max advance / daily limit
  Payment: optional Stripe deposit
  Reminder settings: email 24h + SMS 1h

==============================================================
SETTINGS ADMIN UI
==============================================================
Brand Setup Wizard (first-run only):
  Step indicator: 6 dots at top
  Step 1: Upload logo (drag-drop, min 400x400px, SVG or PNG)
  Step 2: Brand color (color picker + ΔE check preview)
  Step 3: Identity (Agency name, tagline, mission, tone)
  Step 4: API keys (Stripe, Cal.com, email provider, Twilio)
  Step 5: DNS setup (guided instructions + copy CNAME record)
  Step 6: Email warm-up (start button + 35-day countdown)

Brand Identity settings:
  Agency name + tagline
  Mission statement
  Brand voice tone descriptors (multi-select chips)
  Glossary (custom terms)
  Banned phrases (won't appear in AI-generated content)

Theme editor:
  Live preview (iframe of agency site)
  Token editor: color / typography / spacing / component tokens
  Preset themes (niche default + 3-4 alternatives)
  Custom upload: theme.zip
  A/B test: enable variant + traffic split slider
  Rollback: revert to previous version button

SEO defaults:
  Site-wide title template: "[Page Title] | [Agency Name]"
  Default meta description template
  Default OG image
  Google Search Console property ID
  robots.txt editor

Email settings:
  DKIM / SPF / DMARC status (green/red checks)
  Sending domain
  Warm-up status: days completed / days remaining / current daily limit
  Activate sequences button (appears after 35d warm-up)
  Email reputation score (Postmark/SendGrid health API)

Integration keys:
  Each key: masked display + show button + test button + update button
  Status indicator: connected (green) / needs attention (red)
  Keys: Stripe / Cal.com / Email provider / Twilio / Meta Pixel / GSC / Slack

Usage & Billing:
  Current month usage:
    Storage: X GB used / X GB included
    Bandwidth: X GB
    AI tokens: X tokens / $X cost
    Email sends: X emails / $X cost
  Trend chart: last 6 months per metric
  Budget alert: set threshold for AI cost

==============================================================
ADMIN UI ADVANCED FEATURES
==============================================================
Global search (Cmd+K):
  Opens search modal
  Searches: pages / posts / contacts / deals / media assets
  Results grouped by type with icon
  Arrow keys to navigate, Enter to open
  Fuzzy matching

Activity log (admin sidebar bottom):
  Last 5 actions in this session
  "Your recent activity" expandable panel

Notifications bell (top-right in admin):
  SLA breach alerts (lead not contacted in 4h)
  Permission expiry alerts (30d warning)
  Benchmark expiry alerts
  Backup failure alerts
  Deal stage changes (optional)
  Mark as read / clear all

Keyboard shortcuts:
  Cmd+K: global search
  Cmd+N: new content (page/post, context-aware)
  Cmd+S: save draft
  Cmd+Shift+P: publish
  Cmd+P: preview
  Esc: close any modal/drawer

Admin dark mode:
  Payload admin inherits system dark mode
  Toggle in admin top bar
  Persisted per browser

Admin performance:
  Payload admin: target <1.5s initial load
  List views: server-side pagination (50 rows default)
  Search: debounced 300ms
  Large media lists: virtual scrolling (react-virtual)

Mobile admin:
  Payload admin: responsive but optimized for tablet+ (768px+)
  CRM: full feature parity on mobile (see crm.md)
  DAM: upload works on mobile (file picker)
  Not recommended: writing long-form content on mobile (full editor)

==============================================================
ADMIN ONBOARDING (FIRST LOGIN)
==============================================================
On first admin login (new agency, post-generate):
  1. Welcome modal: "Welcome to [Agency Name] admin"
  2. Brand Setup Wizard launch prompt: "Complete your setup in 6 steps"
  3. If wizard skipped: persistent banner "Complete your brand setup →"
  4. Dashboard shows "Setup completion" progress bar until 100%

Wizard completion unlocks:
  - Logo renders correctly throughout site
  - Brand colors apply to theme tokens
  - Email sequences can be activated
  - Stripe invoicing is live
  - Cal.com booking is live

==============================================================
ADMIN AUDIT TRAIL
==============================================================
Every admin action logged:
  Who: actor email + role
  What: action type + resource type + resource ID
  When: timestamp (UTC)
  Where: IP address + user agent
  Change: previous value + new value (for edits)

Accessible at: super_admin only at /admin/audit-log
Immutable: no delete, no edit (hash-chained)
Exportable: CSV download with date range
Retention: 7 years
