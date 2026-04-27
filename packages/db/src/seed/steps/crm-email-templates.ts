/**
 * packages/db/src/seed/steps/crm-email-templates.ts
 *
 * Seed step: pre-populate 5 professional email templates per agency.
 *
 * Categories: welcome, follow_up, proposal_sent, won, lost
 *
 * Idempotency: ON CONFLICT (agency_id, category) DO NOTHING — safe to run multiple times.
 *
 * Uses raw SQL because `email_templates` is a Payload-managed collection table —
 * no Drizzle schema binding is available for it in this package.
 *
 * REQ-111 (email templates), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { agencyUuid } from '../uuid.js'
import { sql } from 'drizzle-orm'

interface EmailTemplateSeed {
  subject: string
  category: string
  textBody: string
}

function getTemplates(slug: string): EmailTemplateSeed[] {
  switch (slug) {
    case 'ecommerce':
      return [
        {
          category: 'welcome',
          subject: 'Welcome — let\'s grow your DTC store',
          textBody: `Hi {{first_name}},

Thanks for reaching out. We work with DTC brands to increase average order value, reduce cart abandonment, and build retention systems that generate sustainable revenue.

Before our call, it would help to know:
- What platform are you on (Shopify, WooCommerce, other)?
- What's your current monthly revenue run rate?
- Where do you feel the most friction right now — acquisition, conversion, or retention?

Looking forward to learning more about {{company}}.

Best,
The Ecommerce Growth Team`,
        },
        {
          category: 'follow_up',
          subject: 'Following up on your DTC growth inquiry',
          textBody: `Hi {{first_name}},

I wanted to follow up on your inquiry from earlier this week. We've helped brands like yours increase repeat purchase rate by 30–45% through targeted post-purchase sequences and loyalty mechanics.

If you're still exploring options, I'd love to set aside 20 minutes to walk through what we're seeing work right now for stores in your category.

Would any of these times work for a quick call?
- [Time slot 1]
- [Time slot 2]
- [Time slot 3]

Best,
The Ecommerce Growth Team`,
        },
        {
          category: 'proposal_sent',
          subject: 'Your ecommerce growth proposal — next steps',
          textBody: `Hi {{first_name}},

I've sent over the proposal for your review. Here's a quick summary of what's included:

1. Storefront conversion audit (2 weeks)
2. Email and SMS retention build (4 weeks)
3. 90-day growth retainer with bi-weekly reporting

The proposal is valid for 14 days. If you have questions or want to adjust scope, just reply to this email and we'll make it work.

Looking forward to hearing your thoughts.

Best,
The Ecommerce Growth Team`,
        },
        {
          category: 'won',
          subject: 'Welcome to the team, {{first_name}}!',
          textBody: `Hi {{first_name}},

Excited to kick off the engagement with {{company}}. Here's what happens next:

- You'll receive a kickoff questionnaire in the next 24 hours
- Our onboarding specialist will schedule your kickoff call within 48 hours
- You'll have access to your client dashboard by end of week

If you have any questions before then, reply to this email or use the direct line in your welcome packet.

Let's build something great.

The Ecommerce Growth Team`,
        },
        {
          category: 'lost',
          subject: 'Staying in touch — {{company}}',
          textBody: `Hi {{first_name}},

Thanks for giving us the opportunity to put together a proposal for {{company}}. We understand the timing or fit wasn't right for now.

We publish a monthly digest with DTC growth case studies, benchmarks, and tactical breakdowns — happy to add you if that would be useful.

If your situation changes or you'd like a fresh conversation in a few months, don't hesitate to reach out.

Wishing you continued success.

Best,
The Ecommerce Growth Team`,
        },
      ]

    case 'finance':
      return [
        {
          category: 'welcome',
          subject: 'Welcome — fractional CFO and financial advisory',
          textBody: `Hi {{first_name}},

Thank you for reaching out. We provide fractional CFO services, financial systems overhaul, and cash flow advisory to founder-led and PE-backed businesses.

To make our first conversation as valuable as possible, a few questions:
- What stage is {{company}} at (bootstrapped, Series A/B, PE-backed)?
- What's the primary financial challenge right now — cash flow, reporting, fundraising prep?
- Do you have an internal finance function, or is this the first time you're bringing in outside expertise?

Looking forward to speaking with you.

Best,
The Finance Advisory Team`,
        },
        {
          category: 'follow_up',
          subject: 'Following up — CFO advisory for {{company}}',
          textBody: `Hi {{first_name}},

I'm following up on your recent inquiry. Many of our clients come to us at an inflection point — either needing to clean up their books before a raise, or requiring better financial visibility to make confident growth decisions.

We typically save clients significant time and reduce financial errors within the first 60 days.

Happy to set up a 30-minute discovery call this week. Which of these times works?
- [Time slot 1]
- [Time slot 2]

Best,
The Finance Advisory Team`,
        },
        {
          category: 'proposal_sent',
          subject: 'CFO advisory proposal for {{company}} — summary and next steps',
          textBody: `Hi {{first_name}},

The proposal for {{company}} is now in your inbox. In brief:

- Phase 1: Financial audit and systems assessment (3 weeks)
- Phase 2: Chart of accounts cleanup and reporting setup (4 weeks)
- Phase 3: Fractional CFO engagement (ongoing, 2 days/month)

Pricing and timeline are outlined on page 4. The proposal is valid for 21 days. I'm available for a walk-through call if that would help.

Best,
The Finance Advisory Team`,
        },
        {
          category: 'won',
          subject: 'Engagement confirmed — {{company}} onboarding',
          textBody: `Hi {{first_name}},

We're looking forward to working with {{company}}. Here's what to expect in the first week:

- Our lead advisor will send a secure document request for your current financial records
- We'll schedule a 90-minute kickoff call to align on priorities
- You'll receive access to our shared reporting workspace by Friday

If you need anything before the kickoff, I'm available at this email address.

Best,
The Finance Advisory Team`,
        },
        {
          category: 'lost',
          subject: 'Staying connected — {{company}}',
          textBody: `Hi {{first_name}},

Thank you for the time you invested in exploring a partnership with us. We understand the proposal wasn't the right fit at this stage.

We send a quarterly financial benchmarks report to finance leaders in your industry — happy to include you if it would be useful.

If your needs evolve, we're always happy to reconnect.

Best,
The Finance Advisory Team`,
        },
      ]

    case 'ai':
      return [
        {
          category: 'welcome',
          subject: 'Welcome — AI integration and LLM pipeline advisory',
          textBody: `Hi {{first_name}},

Thanks for getting in touch. We help engineering and product teams build production-ready AI systems — from RAG pipelines and fine-tuning to agent frameworks and inference optimization.

A few questions to make our first conversation focused:
- What's the primary use case (customer-facing chatbot, internal automation, recommendation system)?
- What's your current AI stack (OpenAI, Anthropic, open-source)?
- Are you at proof-of-concept stage or moving toward production?

Looking forward to learning more about what you're building at {{company}}.

Best,
The AI Engineering Team`,
        },
        {
          category: 'follow_up',
          subject: 'Following up on your AI integration inquiry',
          textBody: `Hi {{first_name}},

I'm following up on your recent message. We've worked with teams at companies building everything from internal knowledge bases to customer-facing AI agents, and we know the challenges that come up when moving from demo to production.

If you're still evaluating, I'd suggest a 30-minute technical conversation — no pitch, just a genuine look at where you're stuck and what's worked for similar teams.

Available times:
- [Time slot 1]
- [Time slot 2]

Best,
The AI Engineering Team`,
        },
        {
          category: 'proposal_sent',
          subject: 'AI build proposal for {{company}} — scope and timeline',
          textBody: `Hi {{first_name}},

The proposal is in your inbox. Here's the high-level scope:

- Discovery and AI readiness assessment (1 week)
- Architecture design and stack selection (2 weeks)
- Build phase: RAG pipeline / agent framework / inference optimization (4–8 weeks, depending on scope)
- Evaluation framework and handoff documentation

Detailed timelines, pricing, and team structure are on pages 3–5. I'm available for a scope review call if helpful.

Best,
The AI Engineering Team`,
        },
        {
          category: 'won',
          subject: 'Welcome aboard — {{company}} AI engagement',
          textBody: `Hi {{first_name}},

We're genuinely excited to work with {{company}} on this build. Here's the kickoff plan:

- A technical pre-brief will land in your inbox within 24 hours
- We'll schedule a kickoff call with your engineering lead and our architect within 48 hours
- Access to our shared project workspace will be provisioned by Friday

If anything comes up before the kickoff, don't hesitate to reach out directly.

The AI Engineering Team`,
        },
        {
          category: 'lost',
          subject: 'Keeping the door open — {{company}}',
          textBody: `Hi {{first_name}},

Thanks for the time you put into the conversation with our team. We understand the decision didn't come down in our favour this time.

The AI landscape moves quickly, and we publish a biweekly update on what's working in production AI deployments — happy to add you to the list if that would be useful.

If you ever want a second opinion on an architectural decision or a brief technical review, our door is always open.

Best,
The AI Engineering Team`,
        },
      ]

    default:
      return getGenericTemplates(slug)
  }
}

function getGenericTemplates(slug: string): EmailTemplateSeed[] {
  const agencyLabel = slug.charAt(0).toUpperCase() + slug.slice(1)
  return [
    {
      category: 'welcome',
      subject: `Welcome — ${agencyLabel} services inquiry`,
      textBody: `Hi {{first_name}},

Thank you for reaching out. We're glad you found us.

To make our first conversation as productive as possible, it helps to know a bit more about what you're looking for. Could you share:
- What challenge prompted you to reach out?
- What does success look like for {{company}} in the next 90 days?
- Have you worked with an agency in this space before?

Looking forward to speaking with you.

Best,
The ${agencyLabel} Team`,
    },
    {
      category: 'follow_up',
      subject: `Following up — ${agencyLabel} services for {{company}}`,
      textBody: `Hi {{first_name}},

I'm following up on your recent inquiry. Our team has helped businesses like {{company}} make meaningful progress quickly, and I'd love to understand whether we're a strong fit.

Would you have 20 minutes this week for a quick conversation? Here are a few times:
- [Time slot 1]
- [Time slot 2]

Best,
The ${agencyLabel} Team`,
    },
    {
      category: 'proposal_sent',
      subject: `Your ${agencyLabel.toLowerCase()} proposal — next steps`,
      textBody: `Hi {{first_name}},

The proposal for {{company}} is on its way. Here's a brief summary of the engagement:

- Phase 1: Discovery and audit
- Phase 2: Strategy and planning
- Phase 3: Execution and reporting

Detailed scope, timeline, and investment are covered in the document. Please review and let us know if you have questions — we're happy to schedule a walkthrough call.

Best,
The ${agencyLabel} Team`,
    },
    {
      category: 'won',
      subject: `Engagement confirmed — welcome, {{first_name}}`,
      textBody: `Hi {{first_name}},

We're looking forward to getting started with {{company}}. Here's what to expect over the next few days:

- You'll receive a kickoff questionnaire to help us hit the ground running
- We'll schedule an onboarding call within 48 hours
- You'll have access to your project workspace shortly

Excited to get to work.

Best,
The ${agencyLabel} Team`,
    },
    {
      category: 'lost',
      subject: `Keeping the door open — {{company}}`,
      textBody: `Hi {{first_name}},

Thank you for the time you invested in exploring a partnership with our team. We genuinely appreciate the opportunity.

If your needs change or you'd like to revisit the conversation at a later stage, we're always happy to reconnect. We also share regular insights from our work — happy to include you if that would be useful.

Wishing you every success with {{company}}.

Best,
The ${agencyLabel} Team`,
    },
  ]
}

export const crmEmailTemplatesPreSeedStep: SeedStep = {
  name: 'crm-email-templates-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const templates = getTemplates(slug)

    for (const tmpl of templates) {
      await tx.execute(
        sql`INSERT INTO email_templates (id, agency_id, subject, text_body, category)
            VALUES (gen_random_uuid(), ${agencyId}::uuid, ${tmpl.subject}, ${tmpl.textBody}, ${tmpl.category})
            ON CONFLICT (agency_id, category) DO NOTHING`
      )
    }
  },
}
