# @mjagency/cms

Payload 3.82.1 shared configuration package. Exports Payload collection definitions, field schemas, access control helpers, and the Payload config factory consumed by all 12 agency apps. M005 (Central CMS + Block Library + Editor UX) fills this package with the full content model. At M001 each app boots with an empty collections array — Payload auto-generates the users collection. This package holds the shared Payload config so M005 can fill it once and all 12 apps pick it up.
