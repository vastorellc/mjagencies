/**
 * packages/db/src/seed/steps/crm-sequences.ts
 *
 * Seed step: pre-populate 8 email sequences per agency, each with 5 steps.
 *
 * Idempotency:
 *   - INSERT ... ON CONFLICT (agency_id, name) DO NOTHING ensures the row exists.
 *   - UPDATE sets the steps JSONB unconditionally — idempotent since the same
 *     JSON is written on every run.
 *
 * Uses raw SQL because `email_sequences` is a Payload-managed collection table —
 * no Drizzle schema binding is available for it in this package.
 *
 * REQ-112 (email sequences), REQ-302 (agency isolation)
 */

import type { SeedStep } from '../types.js'
import { agencyUuid } from '../uuid.js'
import { sql } from 'drizzle-orm'

interface SequenceStep {
  delayHours: number
  subject: string
  body: string
}

interface SequenceSeed {
  name: string
  steps: SequenceStep[]
}

function buildSequences(slug: string): SequenceSeed[] {
  const nicheLabel = slug.charAt(0).toUpperCase() + slug.slice(1)

  // Each sequence is defined with niche-contextualised copy.
  // The core eight sequences are shared across all agencies; the step copy
  // references the niche label to keep it relevant.
  return [
    {
      name: 'New Lead Nurture',
      steps: [
        {
          delayHours: 0,
          subject: `Quick question about ${nicheLabel} for your business`,
          body: `Hi {{first_name}},

We came across {{company}} and noticed you might be working through some ${nicheLabel.toLowerCase()} challenges right now.

We help businesses like yours get traction faster. Would a short conversation this week make sense?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 48,
          subject: `One thing most ${nicheLabel.toLowerCase()} teams miss`,
          body: `Hi {{first_name}},

One of the most consistent patterns we see: teams focused on ${nicheLabel.toLowerCase()} often optimise the wrong thing first.

We published a brief breakdown on this — happy to share it if it would be useful.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 120,
          subject: `Still thinking about {{company}}?`,
          body: `Hi {{first_name}},

Following up one more time. I understand timing isn't always right.

If you're evaluating ${nicheLabel.toLowerCase()} options for later in the year, I'm happy to set aside time now and give you something useful to reference.

Worth 15 minutes?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 240,
          subject: `A result we got for a similar business`,
          body: `Hi {{first_name}},

A client we work with in a similar space was facing the same kind of friction you might be dealing with.

Without going into details on their business: within 90 days of working together, they had meaningfully better results in the areas that mattered to them.

Happy to share more context on a brief call.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 432,
          subject: `Last note from us, {{first_name}}`,
          body: `Hi {{first_name}},

This is my last message for now. I don't want to be noise in your inbox.

If the timing or situation changes, please don't hesitate to reach back out — this email address goes directly to me.

Wishing you every success with {{company}}.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Post-Demo Follow-up',
      steps: [
        {
          delayHours: 1,
          subject: `Great talking with you — next steps for {{company}}`,
          body: `Hi {{first_name}},

Thanks for taking the time today. I enjoyed learning more about what you're building at {{company}}.

As promised, I'll send over the relevant case studies and the outline we discussed. You should receive a separate email with those shortly.

In the meantime, is there anything specific you want me to dig into before our next conversation?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 24,
          subject: `Resources from our call + one question`,
          body: `Hi {{first_name}},

Following up on our conversation — attached are the resources I mentioned.

One question I forgot to ask: what's the internal timeline for making a decision on this? Even a rough window helps me make sure we're moving at the right pace for {{company}}.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 72,
          subject: `Checking in — any questions after reviewing?`,
          body: `Hi {{first_name}},

Wanted to check in now that you've had a chance to review what I sent over.

Happy to jump on a call to answer any questions, or walk through how we'd approach the specifics of your situation at {{company}}.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 168,
          subject: `Still evaluating, {{first_name}}?`,
          body: `Hi {{first_name}},

It's been about a week since we spoke. Wanted to make sure nothing got lost in the shuffle.

If you're still comparing options, I'm happy to put together a quick side-by-side or answer any specific questions that might be blocking the decision.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 336,
          subject: `Closing the loop on {{company}}`,
          body: `Hi {{first_name}},

I don't want to leave things hanging indefinitely — last message from me on this thread.

If the project at {{company}} has moved in a different direction, no worries at all. If you'd like to revisit the conversation at any point, you know where to find me.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Onboarding Welcome',
      steps: [
        {
          delayHours: 0,
          subject: `Welcome aboard, {{first_name}} — here's how we'll work together`,
          body: `Hi {{first_name}},

Welcome to the team. We're genuinely excited to get started with {{company}}.

Here's what to expect in the first two weeks:
1. Kickoff questionnaire (arriving in your inbox today)
2. Onboarding call (scheduled by your account lead)
3. Shared workspace access (provisioned within 24 hours)

Your primary point of contact is {{account_lead_name}}. They'll be in touch shortly.

Best,
The Team`,
        },
        {
          delayHours: 24,
          subject: `Your kickoff questionnaire is ready`,
          body: `Hi {{first_name}},

Your onboarding questionnaire is now live. It takes about 10–15 minutes to complete and helps us hit the ground running with the right context about {{company}}.

[Complete Questionnaire →]

If you run into any issues or have questions while filling it out, just reply to this email.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 72,
          subject: `Kickoff call confirmed — agenda inside`,
          body: `Hi {{first_name}},

Your kickoff call is confirmed. Here's the agenda for our time together:

1. Introductions (10 min)
2. Your current situation and goals at {{company}} (20 min)
3. Our approach and first 30-day plan (20 min)
4. Open questions (10 min)

Looking forward to it.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 168,
          subject: `One week in — how's everything going?`,
          body: `Hi {{first_name}},

We're one week into the engagement. I wanted to check in personally to make sure everything is running smoothly on your end.

Is there anything that's unclear, or any friction you've noticed so far? This is the right moment to flag it so we can adjust quickly.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 336,
          subject: `Two-week check-in and first progress update`,
          body: `Hi {{first_name}},

Two weeks in — here's a brief update on where we stand.

[Progress summary will be tailored to your engagement]

We'll share the first formal report at the 30-day mark. In the meantime, let us know if you have questions.

Best,
{{account_lead_name}}`,
        },
      ],
    },
    {
      name: 'Re-Engagement (Lapsed)',
      steps: [
        {
          delayHours: 0,
          subject: `{{first_name}}, it's been a while — still relevant?`,
          body: `Hi {{first_name}},

We haven't spoken in a while, and I wanted to reach back out in case circumstances at {{company}} have changed.

A lot has shifted in the ${nicheLabel.toLowerCase()} space over the past few months. If you're revisiting the project, I'd love to reconnect.

Worth a brief conversation?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 72,
          subject: `What's new in ${nicheLabel.toLowerCase()} — quick share`,
          body: `Hi {{first_name}},

Following up with a quick note. We've been heads-down with clients in your space and have a few observations I thought might be valuable to share.

Happy to send them over if timing is better now.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 168,
          subject: `A relevant result from a similar business`,
          body: `Hi {{first_name}},

I won't keep cluttering your inbox, but I did want to share one thing before I stop following up.

We recently wrapped an engagement with a business very similar to {{company}}. The outcome was genuinely strong, and the approach we used might be directly applicable to your situation.

Happy to share a two-page summary if that's useful.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 336,
          subject: `Any update on the ${nicheLabel.toLowerCase()} project at {{company}}?`,
          body: `Hi {{first_name}},

One last note from me on this. I understand things shift and timing isn't always right.

If the project is back on the table, I'm still interested in the conversation. And if the path has gone in a different direction, I hope it's going well.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 720,
          subject: `Checking in one final time`,
          body: `Hi {{first_name}},

It's been a few months since we last spoke, and this will be my final follow-up.

If you'd like to reconnect at any point, you know where to find me. Wishing you continued success with {{company}}.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Proposal Follow-up',
      steps: [
        {
          delayHours: 24,
          subject: `Did the proposal land okay, {{first_name}}?`,
          body: `Hi {{first_name}},

Just checking that the proposal came through cleanly. Sometimes these get caught by filters or land in spam.

If you have a moment, let me know you received it — and if you have any immediate questions, I'm happy to hop on a quick call.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 96,
          subject: `Any initial thoughts on the proposal?`,
          body: `Hi {{first_name}},

I wanted to follow up now that you've had a few days to review. No pressure — just want to make sure you have everything you need to feel confident in the decision.

If there's a particular section you'd like to walk through together, I'm happy to schedule a brief call.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 168,
          subject: `One week since we sent the proposal`,
          body: `Hi {{first_name}},

It's been about a week since the proposal landed. I understand decisions like this take time, especially when multiple stakeholders are involved.

Is there anything I can do to help move things forward — additional references, a revised scope, or a call with our team?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 240,
          subject: `Where things stand — {{company}} proposal`,
          body: `Hi {{first_name}},

I don't want to let this go too long without a check-in. We typically hold proposal pricing for 14–21 days.

Would it be helpful to schedule a brief call to answer any remaining questions before the deadline?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 336,
          subject: `Final follow-up on the proposal for {{company}}`,
          body: `Hi {{first_name}},

This is my last follow-up on the proposal. I understand if the timing or fit isn't right.

If you'd like to reopen the conversation later — or if circumstances change at {{company}} — please don't hesitate to reach out. We'd be glad to revisit.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Referral Partner Nurture',
      steps: [
        {
          delayHours: 0,
          subject: `Partnership opportunity — ${nicheLabel} referrals`,
          body: `Hi {{first_name}},

I'm reaching out because your work at {{company}} and what we do at ${nicheLabel} complement each other in a way that could genuinely benefit your clients.

We have an established referral programme with clear terms. If you're open to it, I'd love to explain how it works and see if there's a fit.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 72,
          subject: `How our referral programme works`,
          body: `Hi {{first_name}},

To give you more context on what I mentioned earlier — here's how our referral partnership works in practice:

1. You introduce us to a client or contact who might benefit from ${nicheLabel.toLowerCase()} services
2. We handle all conversations and proposals from that point
3. If the engagement closes, you receive a referral fee (details on request)

There's no obligation on your end, and we only take on clients where we're confident we can deliver.

Would you be open to a brief conversation?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 168,
          subject: `A quick question for you, {{first_name}}`,
          body: `Hi {{first_name}},

Do you have any clients or contacts who are actively working through ${nicheLabel.toLowerCase()} challenges right now?

If so, a warm introduction would be welcomed — and we'd take it from there without any friction to you.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 336,
          subject: `Keeping the partner door open`,
          body: `Hi {{first_name}},

I don't want to keep pushing on this if the timing isn't right. I'll just leave the door open.

If you ever come across a client who could use ${nicheLabel.toLowerCase()} support, feel free to forward my details.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 720,
          subject: `Checking in — any ${nicheLabel.toLowerCase()} referrals from your end?`,
          body: `Hi {{first_name}},

It's been a few months. Just wanted to touch base and see if there are any clients in your world who might benefit from a conversation with our team.

Happy to return the favour where we can.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Event Follow-up',
      steps: [
        {
          delayHours: 2,
          subject: `Great to meet you at {{event_name}}, {{first_name}}`,
          body: `Hi {{first_name}},

It was great to connect at {{event_name}}. I enjoyed our conversation about {{company}} and the ${nicheLabel.toLowerCase()} challenges you're working through.

As I mentioned, I'll send over some relevant resources. In the meantime, feel free to look us up — I think our work might resonate with where {{company}} is heading.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 48,
          subject: `Resources I promised — following up from {{event_name}}`,
          body: `Hi {{first_name}},

As promised, here are a few things that might be relevant to what you're working on:

[Relevant resource 1]
[Relevant resource 2]

Happy to dig into any of this further on a call. Even 20 minutes could be useful if the timing is right.

Best,
{{sender_name}}`,
        },
        {
          delayHours: 168,
          subject: `Following up — {{event_name}} conversation`,
          body: `Hi {{first_name}},

A quick follow-up from our conversation at {{event_name}}. I've been thinking about what you shared about {{company}} and wanted to send over one more resource that's directly relevant.

Would a short call this week make sense?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 336,
          subject: `Still thinking about what we discussed?`,
          body: `Hi {{first_name}},

It's been a couple of weeks since {{event_name}}. I don't want to let a good conversation fade without seeing if there's something real to explore.

Is there a convenient time to reconnect?

Best,
{{sender_name}}`,
        },
        {
          delayHours: 720,
          subject: `One last note from the {{event_name}} conversation`,
          body: `Hi {{first_name}},

This will be my final follow-up from our conversation at {{event_name}}. I hope things are going well at {{company}}.

If you ever want to pick up where we left off, the door is open.

Best,
{{sender_name}}`,
        },
      ],
    },
    {
      name: 'Upsell Sequence',
      steps: [
        {
          delayHours: 0,
          subject: `An opportunity for {{company}} — expanding our engagement`,
          body: `Hi {{first_name}},

Based on the results we've delivered in the current engagement, I wanted to share an idea for how we could extend our impact at {{company}}.

We've identified an adjacent area where we believe we could generate meaningful results in a relatively short time. I'd love to share the specifics.

Would 20 minutes work this week?

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 72,
          subject: `A quick brief on the expansion idea for {{company}}`,
          body: `Hi {{first_name}},

I put together a one-page brief on what I had in mind. It outlines the opportunity, the approach, and a rough estimate of what we'd expect to see.

Happy to walk through it on a call, or just answer any questions by email if that's easier.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 168,
          subject: `Any initial thoughts on the proposal, {{first_name}}?`,
          body: `Hi {{first_name}},

Just checking in to see if you've had a chance to review the brief I sent over.

No pressure on timing — just want to make sure it didn't get buried.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 336,
          subject: `Expansion scope for {{company}} — updated version`,
          body: `Hi {{first_name}},

I've refined the proposal slightly based on some additional thinking. The scope is a bit tighter, and I've adjusted the investment to reflect that.

Happy to walk through the updated version on a brief call.

Best,
{{account_lead_name}}`,
        },
        {
          delayHours: 504,
          subject: `Final note on the {{company}} expansion`,
          body: `Hi {{first_name}},

I'll leave this with you. If the timing is right in the next quarter, we can revisit from here.

In the meantime, let us know if there's anything we can do in the current scope to keep delivering strong results.

Best,
{{account_lead_name}}`,
        },
      ],
    },
  ]
}

export const crmSequencesPreSeedStep: SeedStep = {
  name: 'crm-sequences-preseed',
  async run(tx, slug) {
    const agencyId = agencyUuid(slug)
    const sequences = buildSequences(slug)

    for (const seq of sequences) {
      // Step 1: Insert sequence row (idempotent — skip if name already exists for this agency)
      await tx.execute(
        sql`INSERT INTO email_sequences (id, agency_id, name)
            VALUES (gen_random_uuid(), ${agencyId}::uuid, ${seq.name})
            ON CONFLICT (agency_id, name) DO NOTHING`
      )

      // Step 2: Set steps JSONB — always update so re-runs converge to the same state
      await tx.execute(
        sql`UPDATE email_sequences
            SET steps = ${JSON.stringify(seq.steps)}::jsonb
            WHERE agency_id = ${agencyId}::uuid AND name = ${seq.name}`
      )
    }
  },
}
