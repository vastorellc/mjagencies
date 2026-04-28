import { describe, it, expect } from 'vitest'
import { runAxeTest } from '@mjagency/testing'

function createPageFixture(bodyContent: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = `
    <a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>
    <header role="banner">
      <nav aria-label="Main navigation">
        <a href="/" aria-current="page">Home</a>
        <a href="/about">About</a>
        <a href="/services">Services</a>
        <a href="/blog">Blog</a>
        <a href="/contact">Contact</a>
      </nav>
    </header>
    <main id="main-content">
      ${bodyContent}
    </main>
    <footer role="contentinfo">
      <p>© 2026 MJ Ecommerce Agency. All rights reserved.</p>
    </footer>
  `
  return div
}

describe('WCAG 2.2 AA — Home page structure', () => {
  it('has zero critical axe violations', async () => {
    const container = createPageFixture(`
      <h1>Revenue-Driven Ecommerce Growth</h1>
      <p>We build and scale ecommerce brands that convert. Shopify, headless, CRO, and paid acquisition.</p>
      <a href="/contact" role="button">Get a free consultation</a>
      <section aria-labelledby="services-heading">
        <h2 id="services-heading">Our Services</h2>
        <ul>
          <li><a href="/services/shopify-development">Shopify Development</a></li>
          <li><a href="/services/cro">Conversion Rate Optimization</a></li>
          <li><a href="/services/paid-acquisition">Paid Acquisition</a></li>
        </ul>
      </section>
      <img src="hero-ecommerce.jpg" alt="Ecommerce dashboard showing revenue growth" width="1200" height="600" />
    `)
    await runAxeTest(container)
  })

  it('has skip-to-main-content link', () => {
    const container = createPageFixture('<h1>Home</h1>')
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    expect(skipLink?.textContent?.trim()).toBe('Skip to main content')
  })

  it('has exactly one h1', () => {
    const container = createPageFixture('<h1>Revenue-Driven Ecommerce Growth</h1><p>Content here.</p>')
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
  })
})

describe('WCAG 2.2 AA — Contact page structure', () => {
  it('has zero critical axe violations', async () => {
    const container = createPageFixture(`
      <h1>Contact MJ Ecommerce Agency</h1>
      <form aria-label="Contact form" novalidate>
        <div>
          <label for="contact-name">Full name <span aria-hidden="true">*</span></label>
          <input type="text" id="contact-name" name="name" required aria-required="true" />
        </div>
        <div>
          <label for="contact-email">Email address <span aria-hidden="true">*</span></label>
          <input type="email" id="contact-email" name="email" required aria-required="true" />
        </div>
        <div>
          <label for="contact-message">Message <span aria-hidden="true">*</span></label>
          <textarea id="contact-message" name="message" required aria-required="true" rows="6"></textarea>
        </div>
        <button type="submit">Send message</button>
      </form>
    `)
    await runAxeTest(container)
  })

  it('all form inputs have associated labels', () => {
    const container = createPageFixture(`
      <h1>Contact</h1>
      <form>
        <label for="name">Name</label>
        <input type="text" id="name" name="name" />
        <label for="email">Email</label>
        <input type="email" id="email" name="email" />
        <button type="submit">Send</button>
      </form>
    `)
    const inputs = container.querySelectorAll('input')
    inputs.forEach(input => {
      const label = container.querySelector(`label[for="${input.id}"]`)
      expect(label).toBeTruthy()
    })
  })
})

describe('WCAG 2.2 AA — Services page structure', () => {
  it('has zero critical axe violations', async () => {
    const container = createPageFixture(`
      <h1>Ecommerce Services</h1>
      <ul>
        <li>
          <article>
            <h2>Shopify Development</h2>
            <p>Custom Shopify themes and app development for high-volume stores.</p>
            <a href="/services/shopify-development">View service details</a>
          </article>
        </li>
        <li>
          <article>
            <h2>Conversion Rate Optimization</h2>
            <p>Data-driven CRO strategies that increase revenue without increasing ad spend.</p>
            <a href="/services/cro">View service details</a>
          </article>
        </li>
      </ul>
    `)
    await runAxeTest(container)
  })
})

describe('WCAG 2.2 AA — Blog index structure', () => {
  it('has zero critical axe violations with posts', async () => {
    const container = createPageFixture(`
      <h1>Ecommerce Insights</h1>
      <ul aria-label="Blog posts">
        <li>
          <article>
            <h2><a href="/blog/how-to-increase-aov">How to Increase Average Order Value by 30%</a></h2>
            <time datetime="2026-03-15">March 15, 2026</time>
            <p>Learn the proven tactics that top ecommerce brands use to lift AOV without alienating customers.</p>
            <a href="/blog/how-to-increase-aov">Read article</a>
          </article>
        </li>
      </ul>
    `)
    await runAxeTest(container)
  })

  it('shows empty state when no posts', async () => {
    const container = createPageFixture(`
      <h1>Ecommerce Insights</h1>
      <p>No posts published yet. Check back soon.</p>
    `)
    await runAxeTest(container)
  })
})
