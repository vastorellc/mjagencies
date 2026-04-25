import { GRAPHQL_PLAYGROUND_GET } from '@payloadcms/next/routes'
import config from '../../../../payload.config'

export const GET = async (request: Request): Promise<Response> =>
  GRAPHQL_PLAYGROUND_GET(request, { config })
