/**
 * packages/cms/src/collections/users.ts
 *
 * Payload 3.82.1 CollectionConfig for the `users` collection.
 * Required by Payload admin (admin.user = 'users' in build-payload-config.ts).
 *
 * This collection mirrors the app-layer user schema (packages/db/src/schema/users.ts)
 * and allows Payload admin to authenticate staff users.
 *
 * Fields: email (built-in via auth: true), role, agencyId
 *
 * Rule 2 addition (07-04): Payload requires a 'users' collection to be registered;
 * without it, buildConfig() throws InvalidConfiguration. This collection was always
 * planned (packages/cms/src/access/collection-access.ts references it) but not yet created.
 *
 * Security:
 *   - auth: true enables Payload's built-in cookie/JWT auth for admin login
 *   - role/agencyId access: superAdminOnly on create/delete; read/update via collectionAccess
 *   - role field: only super_admin can set role (prevents privilege escalation)
 */
import type { CollectionConfig } from 'payload'
import { superAdminOnly } from '../access/collection-access.js'

export const usersCollection: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'agencyId', 'updatedAt'],
    group: 'Configuration',
    description: 'CMS admin users. role and agencyId control agency-scoped access.',
  },
  access: {
    read: superAdminOnly,
    create: superAdminOnly,
    update: superAdminOnly,
    delete: superAdminOnly,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      options: [
        { label: 'Super Admin', value: 'super_admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      admin: {
        position: 'sidebar',
        description: 'User role. Controls agency-scoped access in all collections.',
      },
    },
    {
      name: 'agencyId',
      type: 'text',
      admin: {
        position: 'sidebar',
        description:
          'Agency this user belongs to. Required for admin and editor roles. Leave empty for super_admin.',
      },
    },
  ],
}
