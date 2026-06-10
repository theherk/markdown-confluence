import { expect, test } from "@effect/vitest";
import { RequiredConfluenceClient } from "./ConfluenceClient";
import { Publisher } from "./Publisher";
import { ConfluenceSettings } from "./Settings";

test("explains how to resolve a missing parent page space key", async () => {
	const publisher = new Publisher(testSettings, createConfluenceClientWithoutParentSpace(), []);

	await expect(publisher.publish()).rejects.toThrow(
		/Missing Space Key for Confluence page "123456"\. .*there is no separate space-key setting.*set confluenceBaseUrl to the Atlassian site URL without \/wiki/,
	);
});

function createConfluenceClientWithoutParentSpace(): RequiredConfluenceClient {
	return {
		users: {
			getCurrentUser: async () => ({ accountId: "current-user" }),
		},
		content: {
			getContentById: async () => ({
				id: testSettings.confluenceParentId,
			}),
		},
		contentAttachments: {},
		contentLabels: {},
		space: {},
	} as unknown as RequiredConfluenceClient;
}

const testSettings: ConfluenceSettings = {
	confluenceBaseUrl: "https://example.atlassian.net",
	confluenceSiteUrl: "",
	confluenceParentId: "123456",
	authMethod: "basic",
	atlassianUserName: "user@example.com",
	atlassianApiToken: "token",
	atlassianClientId: "",
	atlassianClientSecret: "",
	folderToPublish: ".",
	contentRoot: ".",
	firstHeadingPageTitle: false,
};
