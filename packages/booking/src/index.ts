import type { CollectionConfig } from 'payload'
export { bookingConfigsCollection } from './collections/booking-configs.js'
export { createBookingWorker } from './workers/booking-worker.js'

import { bookingConfigsCollection } from './collections/booking-configs.js'
export const bookingCollections: CollectionConfig[] = [bookingConfigsCollection]
