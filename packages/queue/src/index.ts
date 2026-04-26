/**
 * packages/queue/src/index.ts
 *
 * Barrel export for @mjagency/queue.
 *
 * Usage:
 *   import { createEncryptedQueue, createEncryptedWorker, getQueueKey } from '@mjagency/queue'
 */

export { createEncryptedQueue, createEncryptedWorker } from './encrypted-queue.js'
export { getQueueKey } from './key.js'
