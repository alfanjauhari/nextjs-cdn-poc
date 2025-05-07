import { PutObjectCommand } from "@aws-sdk/client-s3";

import mime from "mime-types"; // Import mime-types library
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { env, s3Client } from "./constants";
import appInfo from "../package.json";

// Helper function to upload an individual file
const uploadFile = async (localPath: string, remotePath: string) => {
	const fileContent = readFileSync(localPath); // Read file content
	const contentType = mime.lookup(localPath) || "application/octet-stream"; // Detect content type

	const uploadParams = {
		Bucket: env.CDN_BUCKET_NAME,
		Key: remotePath,
		Body: fileContent,
		ContentType: contentType, // Set the correct MIME type
	};

	await s3Client.send(new PutObjectCommand(uploadParams));

	// Get the relative local path to display in the log message
	const relativeLocalPath = relative(process.cwd(), localPath);

	console.info(
		`Successfully uploaded file ${relativeLocalPath} to ${remotePath} with content type: ${contentType}`,
	);
};

// Helper function to recursively upload a directory and its files
const uploadDirectory = async (localDirPath: string, remoteDirPath: string) => {
	const entries = readdirSync(localDirPath);

	for (const entry of entries) {
		const fullLocalPath = join(localDirPath, entry);
		const stats = lstatSync(fullLocalPath);

		if (stats.isDirectory()) {
			// Recursively handle subdirectories
			const remoteSubDirPath = `${remoteDirPath}/${entry}`;
			await uploadDirectory(fullLocalPath, remoteSubDirPath);
		} else if (stats.isFile()) {
			// Upload individual files
			const remoteFilePath = `${remoteDirPath}/${entry}`;
			await uploadFile(fullLocalPath, remoteFilePath);
		}
	}
};

// Function to handle the main upload logic
async function upload(): Promise<void> {
	const targetPath = `${env.CDN_BUCKET_NAME}/${env.CDN_TARGET_PATH_PREFIX}/${appInfo.buildID}`;
	console.info(`Uploading static assets to S3 (${targetPath})...`);

	const mapFiles = {
		"public/locales": `${env.CDN_TARGET_PATH_PREFIX}/${appInfo.buildID}/locales`,
		"public/images": `${env.CDN_TARGET_PATH_PREFIX}/${appInfo.buildID}/images`,
		"public/fonts": `${env.CDN_TARGET_PATH_PREFIX}/${appInfo.buildID}/fonts`,
		".next/static": `${env.CDN_TARGET_PATH_PREFIX}/${appInfo.buildID}/_next/static`,
	};

	// Iterate through mapFiles and sync each directory or upload each file
	for (const [localPath, remotePath] of Object.entries(mapFiles)) {
		const fullLocalPath = join(process.cwd(), localPath); // Resolve absolute path
		const stats = lstatSync(fullLocalPath);

		if (stats.isDirectory()) {
			// Recursively upload the directory
			await uploadDirectory(fullLocalPath, remotePath);
		} else if (stats.isFile()) {
			// Upload individual file
			await uploadFile(fullLocalPath, remotePath);
		} else {
			console.warn(`Skipping unknown path type: ${fullLocalPath}`);
		}
	}

	console.info("All files and directories uploaded successfully.");
}

// Invoke the upload function
upload().catch((error) => {
	console.error("Upload failed", error);
	process.exit(1);
});
