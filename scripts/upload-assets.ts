import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import mime from "mime-types"; // Import mime-types library
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { env, s3Client } from "./constants";
import appInfo from "../package.json";
import { execSync } from "node:child_process";

type ActionType = "sync" | "all";

/**
 * Retrieves a list of files based on the specified action type.
 *
 * @param type - The type of action to determine which files to retrieve.
 *   - `"all"`: Retrieves all files in the `public` directory recursively.
 *   - Other values: Retrieves files that have changed compared to the `origin/main` branch
 *     in the `public` directory using `git diff`.
 *
 * @returns An array of objects representing the files. Each object contains:
 *   - `status`: The status of the file ("A" for added, "M" for modified and "D" for deleted).
 *   - `filePath`: The relative path to the file.
 *
 * @throws Will log an error and return an empty array if the `git diff` command fails.
 */
function getFiles(type: ActionType) {
	if (type === "all") {
		return readdirSync("public", { withFileTypes: true, recursive: true })
			.filter((file) => file.isFile())
			.map((file) => ({
				status: "A",
				filePath: `${file.parentPath}/${file.name}`,
			}));
	}

	try {
		const output = execSync(
			"git diff --name-status origin/main -- public/*",
		).toString();

		return output
			.split("\n")
			.filter((line) => line.trim() !== "")
			.map((line) => {
				const [status, filePath] = line.trim().split("\t");
				return { status, filePath };
			});
	} catch (error) {
		console.error("❌ Failed to get git diffs", String(error));
		return [];
	}
}

/**
 * Uploads a file to an S3 bucket.
 *
 * @param localPath - The local file path of the file to be uploaded.
 * @param remotePath - The destination path in the S3 bucket where the file will be stored.
 *
 * @throws Will throw an error if the upload process fails.
 *
 * Logs a success message upon successful upload, including the relative local path,
 * the remote path, and the content type of the uploaded file.
 */
const uploadFile = async (localPath: string, remotePath: string) => {
	const fileContent = readFileSync(localPath);
	const contentType = mime.lookup(localPath) || "application/octet-stream";

	const uploadParams = {
		Bucket: env.CDN_BUCKET_NAME,
		Key: remotePath,
		Body: fileContent,
		ContentType: contentType,
	};

	await s3Client.send(new PutObjectCommand(uploadParams));

	// Get the relative local path to display in the log message
	const relativeLocalPath = relative(process.cwd(), localPath);

	console.info(
		`Successfully uploaded file ${relativeLocalPath} to ${remotePath} with content type: ${contentType}`,
	);
};

/**
 * Deletes an object from an S3 bucket.
 *
 * @param remotePath - The path of the object to delete in the S3 bucket.
 * @returns A promise that resolves when the object is successfully deleted.
 *
 * @example
 * ```typescript
 * await deleteFromS3('path/to/your/object.txt');
 * console.info('Object deleted successfully');
 * ```
 */
const deleteFromS3 = async (remotePath: string) => {
	const deleteParams = {
		Bucket: env.CDN_BUCKET_NAME,
		Key: remotePath,
	};
	await s3Client.send(new DeleteObjectCommand(deleteParams));
	console.info(`🗑️ Deleted from S3: ${remotePath}`);
};

// Function to handle the main upload logic
async function upload(type: ActionType): Promise<void> {
	const buildID = appInfo.buildID;
	const targetPrefix = `${env.CDN_TARGET_PATH_PREFIX}/${buildID}`;
	console.info(`Syncing static assets to S3 (${targetPrefix})...`);

	const mapFiles = {
		"public/locales": `${targetPrefix}/locales`,
		"public/images": `${targetPrefix}/images`,
		".next/static": `${targetPrefix}/_next/static`,
		"public/fonts": `${targetPrefix}/fonts`,
	};

	// Get changed files from Git
	const files = getFiles(type);

	// Filter only files that are inside the mapFiles keys
	for (const { status, filePath } of files) {
		for (const [localBase, remoteBase] of Object.entries(mapFiles)) {
			if (filePath.startsWith(localBase)) {
				const fullLocalPath = join(process.cwd(), filePath);
				const relativePath = filePath
					.replace(localBase, "")
					.replace(/^\/+/, "");
				const remotePath = `${remoteBase}/${relativePath}`;

				if (status === "D") {
					await deleteFromS3(remotePath);
				} else if (status === "A" || status === "M") {
					if (existsSync(fullLocalPath)) {
						await uploadFile(fullLocalPath, remotePath);
					}
				}
			}
		}
	}
}

switch (process.argv[2]) {
	case "all":
		upload("all")
			.then(() => {
				console.info("✅ All files uploaded successfully.");
			})
			.catch((error) => {
				console.error("❌ Error uploading files:", error);
				process.exit(1);
			});
		break;
	default:
		upload("sync")
			.then(() => {
				console.info("✅ Files synced succesfully.");
			})
			.catch((error) => {
				console.error("❌ Error uploading files:", error);
				process.exit(1);
			});
		break;
}
