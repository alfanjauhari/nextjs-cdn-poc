import type en from "../public/locales/en.json";

type Messages = typeof en;

declare module "next-intl" {
	interface AppConfig {
		Messages: Messages;
	}
}
