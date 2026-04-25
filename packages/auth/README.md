# @mjagency/auth

JWT-based authentication layer for all MJAgency apps. Uses the jose library exclusively (jsonwebtoken is banned — CLAUDE.md §2, REQ-502). Exports session verification helpers, token factory, refresh-token rotation logic, and the per-agency auth context. M003 (Auth + SSO + Edge Routing) fills this package with the full implementation including Next.js middleware integration and the one-time-use refresh token family revocation pattern. At M001 this is a typed stub.
