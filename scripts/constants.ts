import { S3Client } from "@aws-sdk/client-s3";
import { cleanEnv, str } from "envalid";

// Environment variables setup
export const env = cleanEnv(process.env, {
	CDN_BUCKET_NAME: str(),
	CDN_REGION: str({ default: "ap-southeast-1" }),
	CDN_ENDPOINT_URL: str({ default: "https://s3.ap-southeast-1.amazonaws.com" }),
	CDN_ACCESS_KEY_ID: str(),
	CDN_SECRET_ACCESS_KEY: str(),
	CDN_TARGET_PATH_PREFIX: str({ default: "dev" }),
});

// Initialize S3 client
export const s3Client = new S3Client({
	region: env.CDN_REGION,
	endpoint: env.CDN_ENDPOINT_URL,
	credentials: {
		accessKeyId: env.CDN_ACCESS_KEY_ID,
		secretAccessKey: env.CDN_SECRET_ACCESS_KEY,
	},
});
