import { GRAPHQL_POST } from '@payloadcms/next/routes'
import config from '../../../../payload.config'

export const POST = async (request: Request): Promise<Response> =>
  GRAPHQL_POST(request, { config })
