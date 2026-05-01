// Phase 2 Plan 02 stub. Bodies filled in by Plan 02-03.
// Registered now so app.ts wiring is settled; routes return Not Implemented until 02-03.
import { Router, type Request, type Response } from 'express'

export const authGoogleRouter = Router()

authGoogleRouter.get('/connect', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-03)' })
})

authGoogleRouter.get('/callback', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-03)' })
})
