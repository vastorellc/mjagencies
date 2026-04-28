export { proposalsCollection } from './collections/proposals.js'
export { proposalViewsCollection } from './collections/proposal-views.js'
export { createProposal } from './actions/create-proposal.js'
export { handleProposalAction } from './actions/update-proposal-status.js'
export type { ProposalActionInput, ProposalActionOutput } from './actions/update-proposal-status.js'
export { startExpiryWorker } from './workers/expiry-worker.js'

import type { CollectionConfig } from 'payload'
import { proposalsCollection } from './collections/proposals.js'
import { proposalViewsCollection } from './collections/proposal-views.js'
export const proposalCollections: CollectionConfig[] = [proposalsCollection, proposalViewsCollection]
