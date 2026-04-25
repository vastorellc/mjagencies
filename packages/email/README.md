# @mjagency/email

Transactional email delivery layer. Supports Postmark, SendGrid, and SES as interchangeable providers (BYO API key). All sends are queued via BullMQ — never synchronous in the request path (CLAUDE.md §8). M009 fills this package with template rendering, delivery tracking, and the TCPA double opt-in flow. At M001 this is a typed stub.
