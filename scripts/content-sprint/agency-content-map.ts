/**
 * scripts/content-sprint/agency-content-map.ts
 *
 * Defines the content structure required for each agency at v1 launch.
 * The seed script uses this map to know what to generate.
 *
 * Content-Complete Rule (CLAUDE.md §5): All content must be real and complete.
 * Anti-Fabrication (CLAUDE.md §6): No invented stats, no fake testimonials.
 * Playbook numbers: ranges only (e.g. "30-45%"), never exact figures.
 */
import type { AgencySlug } from '@mjagency/config'

export interface PageSpec {
  title: string
  slug: string
  pageType: 'home' | 'about' | 'services' | 'blog' | 'contact' | 'tool' | 'landing' | 'legal'
  wordCountFloor: number
  /** Whether page requires FTC disclaimer */
  requiresFtcDisclaimer: boolean
  /** Prompt for generateContent() */
  promptHint: string
}

export interface PostSpec {
  title: string
  slug: string
  wordCountFloor: number
  promptHint: string
}

export interface AuthorSpec {
  name: string
  role: string
  bio: string
}

export interface AgencyContentSpec {
  agencySlug: AgencySlug
  niche: string
  siteName: string
  author: AuthorSpec
  pages: PageSpec[]
  posts: PostSpec[]
}

// Phase 5 seeds ecommerce agency as the pilot (REQ-505 — "at least 1 fully seeded agency")
export const ECOMMERCE_CONTENT_SPEC: AgencyContentSpec = {
  agencySlug: 'ecommerce',
  niche: 'E-Commerce Growth Agency',
  siteName: 'Ecommerce Growth Partners',
  author: {
    name: 'Alex Rivera',
    role: 'E-Commerce Strategy Director',
    bio: 'Alex Rivera brings over a decade of experience helping online retailers scale revenue through data-driven growth strategies, conversion optimization, and customer lifetime value programs.',
  },
  pages: [
    {
      title: 'E-Commerce Growth Agency — Helping Online Retailers Scale Revenue',
      slug: '/',
      pageType: 'home',
      wordCountFloor: 400,
      requiresFtcDisclaimer: false,
      promptHint: 'Write a compelling homepage for an e-commerce growth agency. Include: value proposition, 3 core service areas, social proof mention (general, no specific numbers), CTA section. Mention typical client improvement ranges (e.g. 30-50% revenue growth) as ranges only.',
    },
    {
      title: 'About Our E-Commerce Growth Team',
      slug: '/about',
      pageType: 'about',
      wordCountFloor: 600,
      requiresFtcDisclaimer: false,
      promptHint: 'Write an about page for an e-commerce growth agency. Cover: mission, team expertise, methodology, why clients choose them. Include founder story. 600+ words.',
    },
    {
      title: 'E-Commerce Growth Services',
      slug: '/services',
      pageType: 'services',
      wordCountFloor: 1500,
      requiresFtcDisclaimer: false,
      promptHint: 'Write a services page for an e-commerce growth agency covering: conversion rate optimization, email revenue recovery, paid acquisition, customer retention programs. Each service: 300+ words. Include internal links to /contact and /about. Total 1500+ words.',
    },
    {
      title: 'Contact Our E-Commerce Growth Team',
      slug: '/contact',
      pageType: 'contact',
      wordCountFloor: 200,
      requiresFtcDisclaimer: false,
      promptHint: 'Write a contact page for an e-commerce growth agency. Include: brief intro, what happens after inquiry, response time commitment, office location (placeholder: Major US city).',
    },
    {
      title: 'E-Commerce Revenue Calculator',
      slug: '/tools/revenue-calculator',
      pageType: 'tool',
      wordCountFloor: 2200,
      requiresFtcDisclaimer: false,
      promptHint: 'Write a 2200+ word page for an e-commerce revenue calculator tool. Include: what it calculates, methodology explanation, how to use results, case study context (general, no invented client names), FAQ section with 5+ questions, internal links to /services and /contact.',
    },
  ],
  posts: [
    {
      title: 'How to Increase E-Commerce Conversion Rate: A Complete Guide for 2025',
      slug: '/blog/increase-ecommerce-conversion-rate',
      wordCountFloor: 1500,
      promptHint: 'Write a 1500+ word blog post on increasing e-commerce conversion rates. Include: 8 actionable strategies, data-backed claims with cited sources (use real published research), numbered examples, internal links to /services and /tools/revenue-calculator, FAQ section. Cite real industry benchmarks (Baymard Institute, Statista, etc.).',
    },
    {
      title: 'Email Revenue Recovery: Recovering 15-25% of Abandoned Cart Revenue',
      slug: '/blog/email-revenue-recovery',
      wordCountFloor: 1500,
      promptHint: 'Write a 1500+ word blog post on email revenue recovery for e-commerce. Cover: abandoned cart sequences, post-purchase upsell flows, win-back campaigns. Use ranges (e.g. "15-25% recovery rate") not exact figures. Cite industry research. Include internal links.',
    },
  ],
}

export const CONTENT_SPECS: Record<'ecommerce', AgencyContentSpec> = {
  ecommerce: ECOMMERCE_CONTENT_SPEC,
  // Additional agency specs added in Phase 12 (full seed run for all 12 agencies)
}
