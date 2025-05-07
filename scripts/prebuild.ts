import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import currentInfo from "../package.json";
import { env, s3Client } from "./constants";
import { execSync } from "node:child_process";

function getChangedFiles() {
	try {
		const output = execSync(
			"git diff --name-only HEAD~1 HEAD -- public/",
		).toString();
		return output.split("\n").filter((f) => f.trim() !== "" && existsSync(f));
	} catch (error) {
		console.error("❌ Gagal mengambil file yang berubah:", String(error));
		return [];
	}
}

async function deleteS3Folder() {
	const listParams = {
		Bucket: env.CDN_BUCKET_NAME,
		Prefix: `${env.CDN_TARGET_PATH_PREFIX}/${currentInfo.buildID}`,
	};

	const listObjects = await s3Client.send(new ListObjectsV2Command(listParams));

	if (!listObjects.Contents) {
		console.log("No objects found in the specified S3 folder.");
		return;
	}

	const deleteParams = {
		Bucket: env.CDN_BUCKET_NAME,
		Delete: {
			Objects: listObjects.Contents.map((object) => ({ Key: object.Key })),
		},
	};

	await s3Client.send(new DeleteObjectsCommand(deleteParams));
	if (listObjects.IsTruncated) {
		await deleteS3Folder();
	}

	console.log(
		`Deleted ${listObjects.Contents.length} objects from S3 folder: ${env.CDN_TARGET_PATH_PREFIX}/${currentInfo.buildID}`,
	);
}

function updateBuildID() {
	const packageJsonPath = join(__dirname, "../package.json");
	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
	const buildID = crypto.randomUUID();
	packageJson.buildID = buildID;
	writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");

	console.log(`Updated buildID in package.json to ${buildID}`);
}

async function main() {
	try {
		await deleteS3Folder();
		updateBuildID();
	} catch (error) {
		console.error("Error during prebuild process:", error);
		process.exit(1);
	}
}

// main()
// 	.then(() => {
// 		console.log("Prebuild process completed successfully.");
// 	})
// 	.catch((error) => {
// 		console.error("Error during prebuild process:", error);
// 		process.exit(1);
// 	});

console.log(getChangedFiles());
