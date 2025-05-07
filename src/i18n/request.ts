import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export default getRequestConfig(async () => {
	const cookieStore = (await cookies()).get("locale");
	const locale = cookieStore?.value || "en";

	const localesUrl = process.env.NEXT_PUBLIC_CDN_URL;

	try {
		const res = await fetch(`${localesUrl}/locales/${locale}.json`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		if (!res.ok) {
			throw new Error("Failed to fetch locales");
		}

		const data = await res.json();
		return {
			locale,
			messages: data,
		};
	} catch (error) {
		console.error("Error fetching locales:", error);

		const res = await fetch(`${localesUrl}/locales/en.json`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		if (!res.ok) {
			throw new Error("Failed to fetch default locales");
		}
		const data = await res.json();
		return {
			locale: "en",
			messages: data,
		};
	}
});
