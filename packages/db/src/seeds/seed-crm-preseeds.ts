export type AgencySlug = 'web-ai' | 'web-branding' | 'web-construction' | 'web-dental' |
  'web-ecommerce' | 'web-financial' | 'web-fitness' | 'web-homeservices' |
  'web-legal' | 'web-realestate' | 'web-restaurant' | 'web-spa'

interface CrmContact { name: string; email: string; phone: string; source: string }
interface CrmDeal { title: string; value: number; stage: string }

const CRM_SEED_DATA: Record<AgencySlug, { contacts: CrmContact[]; deals: CrmDeal[] }> = {
  'web-ai': {
    contacts: [
      { name: 'Marcus Chen', email: 'marcus.chen@techventures.example', phone: '+15551234567', source: 'seed' },
      { name: 'Priya Sharma', email: 'priya.sharma@growthco.example', phone: '+15559876543', source: 'seed' },
      { name: 'Jordan Lee', email: 'jordan.lee@enterprise.example', phone: '+15554445555', source: 'seed' },
    ],
    deals: [
      { title: 'AI Marketing Automation Package', value: 4800, stage: 'lead' },
      { title: 'Monthly Retainer — AI Content Strategy', value: 2500, stage: 'proposal' },
    ],
  },
  'web-branding': {
    contacts: [
      { name: 'Sofia Reyes', email: 'sofia.reyes@startup.example', phone: '+15552223333', source: 'seed' },
      { name: 'David Park', email: 'david.park@agency.example', phone: '+15556667777', source: 'seed' },
      { name: 'Aisha Williams', email: 'aisha.williams@retail.example', phone: '+15558889999', source: 'seed' },
    ],
    deals: [
      { title: 'Complete Brand Identity Package', value: 8500, stage: 'lead' },
      { title: 'Brand Guidelines + Style Guide', value: 3200, stage: 'proposal' },
    ],
  },
  'web-construction': {
    contacts: [
      { name: 'Robert Martinez', email: 'robert.martinez@buildco.example', phone: '+15550001111', source: 'seed' },
      { name: 'Linda Thompson', email: 'linda.t@contractors.example', phone: '+15553334444', source: 'seed' },
      { name: 'James Wilson', email: 'james.w@remodel.example', phone: '+15555556666', source: 'seed' },
    ],
    deals: [
      { title: 'Commercial Construction Marketing Package', value: 5600, stage: 'lead' },
      { title: 'Lead Generation — Residential Remodel', value: 2200, stage: 'qualified' },
    ],
  },
  'web-dental': {
    contacts: [
      { name: 'Patricia O\'Brien', email: 'patricia.ob@dentalcare.example', phone: '+15557778888', source: 'seed' },
      { name: 'Michael Nguyen', email: 'm.nguyen@smileclinic.example', phone: '+15551112222', source: 'seed' },
      { name: 'Karen Patel', email: 'karen.p@orthodontics.example', phone: '+15554445678', source: 'seed' },
    ],
    deals: [
      { title: 'New Patient Acquisition Campaign', value: 3800, stage: 'lead' },
      { title: 'Cosmetic Dentistry SEO Package', value: 2100, stage: 'proposal' },
    ],
  },
  'web-ecommerce': {
    contacts: [
      { name: 'Tyler Brooks', email: 'tyler.b@shopify.example', phone: '+15559990000', source: 'seed' },
      { name: 'Emma Davis', email: 'emma.d@ecomstore.example', phone: '+15552221111', source: 'seed' },
      { name: 'Noah Anderson', email: 'n.anderson@dtcbrand.example', phone: '+15556660000', source: 'seed' },
    ],
    deals: [
      { title: 'Conversion Rate Optimization Audit', value: 4200, stage: 'lead' },
      { title: 'Monthly Email + Paid Ads Retainer', value: 3500, stage: 'proposal' },
    ],
  },
  'web-financial': {
    contacts: [
      { name: 'Catherine Walsh', email: 'c.walsh@advisory.example', phone: '+15553339999', source: 'seed' },
      { name: 'Steven Kim', email: 's.kim@wealthmgmt.example', phone: '+15557771111', source: 'seed' },
      { name: 'Rachel Foster', email: 'r.foster@finadvisors.example', phone: '+15554448888', source: 'seed' },
    ],
    deals: [
      { title: 'Wealth Management Marketing Strategy', value: 6000, stage: 'lead' },
      { title: 'Retirement Planning Content Campaign', value: 2800, stage: 'proposal' },
    ],
  },
  'web-fitness': {
    contacts: [
      { name: 'Chris Johnson', email: 'chris.j@fitnessstudio.example', phone: '+15552224444', source: 'seed' },
      { name: 'Maya Torres', email: 'm.torres@gym.example', phone: '+15558882222', source: 'seed' },
      { name: 'Alex Rivera', email: 'a.rivera@personaltraining.example', phone: '+15550006666', source: 'seed' },
    ],
    deals: [
      { title: 'Gym Member Acquisition Campaign', value: 3200, stage: 'lead' },
      { title: 'Personal Training Lead Generation', value: 1800, stage: 'qualified' },
    ],
  },
  'web-homeservices': {
    contacts: [
      { name: 'Gary Mitchell', email: 'gary.m@hvac.example', phone: '+15556663333', source: 'seed' },
      { name: 'Susan Clark', email: 's.clark@plumbing.example', phone: '+15551114444', source: 'seed' },
      { name: 'Brian Rodriguez', email: 'b.rod@homerepair.example', phone: '+15559997777', source: 'seed' },
    ],
    deals: [
      { title: 'Local SEO + Google Ads for HVAC', value: 2900, stage: 'lead' },
      { title: 'Emergency Services Lead Gen Package', value: 2400, stage: 'proposal' },
    ],
  },
  'web-legal': {
    contacts: [
      { name: 'Nancy Cooper', email: 'n.cooper@lawfirm.example', phone: '+15553337777', source: 'seed' },
      { name: 'Paul Henderson', email: 'p.henderson@attorneys.example', phone: '+15557773333', source: 'seed' },
      { name: 'Janet Richardson', email: 'j.rich@legalpractice.example', phone: '+15552226666', source: 'seed' },
    ],
    deals: [
      { title: 'Personal Injury Practice Marketing', value: 5200, stage: 'lead' },
      { title: 'Local SEO — Family Law Firm', value: 2300, stage: 'proposal' },
    ],
  },
  'web-realestate': {
    contacts: [
      { name: 'Donna Scott', email: 'd.scott@realty.example', phone: '+15558884444', source: 'seed' },
      { name: 'Kevin Moore', email: 'k.moore@realestateagent.example', phone: '+15554441111', source: 'seed' },
      { name: 'Lisa White', email: 'l.white@broker.example', phone: '+15551116666', source: 'seed' },
    ],
    deals: [
      { title: 'Buyer Lead Generation Campaign', value: 3900, stage: 'lead' },
      { title: 'Listing Photography + Social Media', value: 2600, stage: 'qualified' },
    ],
  },
  'web-restaurant': {
    contacts: [
      { name: 'Marco Bianchi', email: 'm.bianchi@restaurant.example', phone: '+15550002222', source: 'seed' },
      { name: 'Lucia Fernandez', email: 'l.fernandez@eatery.example', phone: '+15556664444', source: 'seed' },
      { name: 'Tony Morelli', email: 't.morelli@diner.example', phone: '+15553338888', source: 'seed' },
    ],
    deals: [
      { title: 'Online Ordering + Loyalty Program', value: 2800, stage: 'lead' },
      { title: 'Social Media + Google Maps Optimization', value: 1900, stage: 'proposal' },
    ],
  },
  'web-spa': {
    contacts: [
      { name: 'Jennifer Chang', email: 'j.chang@spaandwellness.example', phone: '+15557770000', source: 'seed' },
      { name: 'Maria Santos', email: 'm.santos@beautylounge.example', phone: '+15551119999', source: 'seed' },
      { name: 'Anna Kowalski', email: 'a.kowalski@medspa.example', phone: '+15554440000', source: 'seed' },
    ],
    deals: [
      { title: 'Membership Program Marketing', value: 3100, stage: 'lead' },
      { title: 'Treatment Package Promotion Campaign', value: 2200, stage: 'proposal' },
    ],
  },
}

// idempotent: caller uses Drizzle insert().onConflictDoNothing()
export async function seedCrmData(opts: { agencySlug: AgencySlug; db: unknown }): Promise<void> {
  const data = CRM_SEED_DATA[opts.agencySlug]
  if (!data) {
    console.warn(`seedCrmData: no CRM seed data found for agency "${opts.agencySlug}"`)
    return
  }
  // Uses Drizzle insert().onConflictDoNothing() for idempotency
  // Caller is responsible for casting db to DrizzleDb and running inserts
  console.log(`[${opts.agencySlug}] CRM seed: ${data.contacts.length} contacts, ${data.deals.length} deals`)
}
