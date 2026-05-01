// Phase 2 Plan 02 stub. Bodies filled in by Plan 02-04.
import { Router, type Request, type Response } from 'express'

export const authMetaRouter = Router()

authMetaRouter.get('/instagram/connect', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-04)' })
})
authMetaRouter.get('/instagram/callback', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-04)' })
})
authMetaRouter.get('/facebook/connect', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-04)' })
})
authMetaRouter.get('/facebook/callback', (_req: Request, res: Response) => {
  res.status(501).json({ error: 'not implemented (Plan 02-04)' })
})
