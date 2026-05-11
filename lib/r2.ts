import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"
import { env } from "@/lib/env"

const s3 = new S3Client({
  endpoint: env.R2_ENDPOINT_URL,
  region: "auto",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
})

export async function getObject(key: string): Promise<string> {
  const resp = await s3.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  )
  if (!resp.Body) throw new Error(`Empty body for R2 key: ${key}`)
  return resp.Body.transformToString("utf-8")
}
