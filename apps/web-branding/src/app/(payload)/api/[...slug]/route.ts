import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'
import { getPayload } from 'payload'
import config from '../../../../payload.config'

const options = async (request: Request): Promise<Response> =>
  REST_OPTIONS(request, { config })

const GET = async (request: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> =>
  REST_GET(request, { config, params })

const POST = async (request: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> =>
  REST_POST(request, { config, params })

const DELETE = async (request: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> =>
  REST_DELETE(request, { config, params })

const PATCH = async (request: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> =>
  REST_PATCH(request, { config, params })

const PUT = async (request: Request, { params }: { params: Promise<{ slug: string[] }> }): Promise<Response> =>
  REST_PUT(request, { config, params })

export { DELETE, GET, OPTIONS, PATCH, POST, PUT }
export { options as OPTIONS }
