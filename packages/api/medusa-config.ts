import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'
import fs from 'fs'
import path from 'path'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Resolves where a dashboard app lives:
// - in the source tree (development): ../../apps/<name>
// - in the production build artifact: hosts that deploy only `.medusa/server` (for example
//   Medusa Cloud) get the panels bundled into ./dashboards/<name> by
//   scripts/bundle-dashboards.mjs during `build`. The compiled config runs from the
//   artifact root, so __dirname points there.
const dashboardAppDir = (name: string) => {
  const bundled = path.join(__dirname, 'dashboards', name)
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, `../../apps/${name}`)
}

const isS3Configured = Boolean(
  process.env.S3_BUCKET &&
  (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID)
)

const s3Endpoint = process.env.S3_ENDPOINT || 'https://s3.etsmtl.club'
const s3FileUrl =
  process.env.S3_FILE_URL ||
  (process.env.S3_BUCKET
    ? `${s3Endpoint.replace(/\/+$/, '')}/${process.env.S3_BUCKET}`
    : undefined)

module.exports = withMercur({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: process.env.DATABASE_DRIVER_OPTIONS
      ? JSON.parse(process.env.DATABASE_DRIVER_OPTIONS)
      : process.env.DATABASE_URL?.includes("ssl_mode=disable")
        ? { connection: { ssl: false } }
        : undefined,
    redisUrl: process.env.REDIS_URL,
    workerMode: process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      vendorCors: process.env.VENDOR_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  featureFlags: {
    seller_registration: true
  },
  modules: [
    {
      resolve: '@mercurjs/core/modules/admin-ui',
      options: {
        appDir: dashboardAppDir('admin'),
        path: '/dashboard',
      }
    },
    {
      resolve: '@mercurjs/core/modules/vendor-ui',
      options: {
        appDir: dashboardAppDir('vendor'),
        path: '/seller',
      }
    },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          isS3Configured
            ? {
                resolve: '@medusajs/medusa/file-s3',
                id: 's3',
                options: {
                  file_url: s3FileUrl,
                  endpoint: s3Endpoint,
                  bucket: process.env.S3_BUCKET,
                  region: process.env.S3_REGION || 'us-east-1',
                  access_key_id:
                    process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
                  secret_access_key:
                    process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
                  additional_client_config: {
                    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
                  },
                },
              }
            : {
                resolve: '@medusajs/medusa/file-local',
                id: 'local',
                options: {
                  // The local provider bakes this into every uploaded file URL.
                  // It must be the publicly reachable origin in production, or
                  // images resolve to localhost and render broken.
                  backend_url: process.env.FILE_BACKEND_URL || 'http://localhost:9000/static',
                },
              },
        ],
      },
    },
  ],
})
