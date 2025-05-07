import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import appInfo from "./package.json";

// Avoid build and lint error in Docker or Vercel deployment
const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [{ protocol: "https", hostname: "**" }],
		loader: "custom",
		loaderFile: "./image-loader.js",
	},
	reactStrictMode: true,
	poweredByHeader: false,
	output: "standalone",
	eslint: { ignoreDuringBuilds: isProduction },
	typescript: { ignoreBuildErrors: isProduction },
	logging: {
		fetches: { fullUrl: true },
	},
	transpilePackages: ["@t3-oss/env-nextjs", "@t3-oss/env-core"],
	cleanDistDir: true,
	generateBuildId: () => {
		return appInfo.buildID;
	},
	assetPrefix: `${process.env.NEXT_PUBLIC_CDN_URL}/${appInfo.buildID}`,

	webpack: (config) => {
		config.module.rules.push({
			test: /fonts\.css$/,
			use: [
				{
					loader: "string-replace-loader",
					options: {
						search: "%CDN_URL%",
						replace: process.env.NEXT_PUBLIC_CDN_URL,
						flags: "g",
					},
				},
				// any other loaders you need, e.g. css-loader //
			],
		});

		return config;
	},
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
