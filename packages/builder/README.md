# @mjagency/builder

Visual page builder backed by Puck (MIT open-source). Outputs JSON, never uses dangerouslySetInnerHTML (CLAUDE.md Puck rules). Puck editor is wrapped in a server-side session check; the auth cookie enables the UI toggle only, not access control. M010 fills this package with block definitions, drag-and-drop UI, and server actions. At M001 Puck is installed as a dependency but only the type contract is exported.
