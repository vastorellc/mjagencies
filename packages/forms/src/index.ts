import type { CollectionConfig } from 'payload'
export { formsCollection } from './collections/forms.js'
export { formSubmissionsCollection } from './collections/form-submissions.js'
export { createFormWorker } from './workers/form-worker.js'
export type { FormSubmissionJobData } from './workers/form-worker.js'

import { formsCollection } from './collections/forms.js'
import { formSubmissionsCollection } from './collections/form-submissions.js'

export const formsCollections: CollectionConfig[] = [formsCollection, formSubmissionsCollection]
