import { env } from "./src/config";

export default function cloudfrontLoader({ src, width, quality }) {
	if (
		src.startsWith("/_next") ||
		src.startsWith(env.NEXT_PUBLIC_BUCKET_PUBLIC_URL) ||
		src.startsWith("http") ||
		src.startsWith("https")
	) {
		return src;
	}

	const url = new URL(env.NEXT_PUBLIC_CDN_URL + src);
	url.searchParams.set("format", "auto");
	url.searchParams.set("width", width.toString());
	url.searchParams.set("quality", (quality || 75).toString());

	return url.href;
}
