import { Context } from "effect";

export type ConfluenceAuthMethod = "basic" | "oauth2";

export type ConfluenceSettings = {
	confluenceBaseUrl: string;
	confluenceSiteUrl: string;
	confluenceParentId: string;
	authMethod: ConfluenceAuthMethod;
	atlassianUserName: string;
	atlassianApiToken: string;
	atlassianClientId: string;
	atlassianClientSecret: string;
	folderToPublish: string;
	contentRoot: string;
	firstHeadingPageTitle: boolean;
};

export const DEFAULT_SETTINGS: ConfluenceSettings = {
	confluenceBaseUrl: "",
	confluenceSiteUrl: "",
	confluenceParentId: "",
	authMethod: "basic",
	atlassianUserName: "",
	atlassianApiToken: "",
	atlassianClientId: "",
	atlassianClientSecret: "",
	folderToPublish: "Confluence Pages",
	contentRoot: ".",
	firstHeadingPageTitle: false,
};

/**
 * The human-facing Atlassian site URL used to build and match browser-facing
 * links (e.g. https://your-site.atlassian.net). Falls back to
 * `confluenceBaseUrl` when `confluenceSiteUrl` is unset, preserving existing
 * behaviour for deployments that talk directly to the site rather than the
 * API gateway (https://api.atlassian.com/ex/confluence/{cloudId}).
 */
export function resolveSiteUrl(settings: ConfluenceSettings): string {
	return settings.confluenceSiteUrl || settings.confluenceBaseUrl;
}

export class ConfluenceSettingsService extends Context.Service<
	ConfluenceSettingsService,
	ConfluenceSettings
>()("@markdown-confluence/ConfluenceSettings") {}
