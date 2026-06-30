#!/usr/bin/env node

import { NodeRuntime } from "@effect/platform-node";
import chalk from "chalk";
import boxen from "boxen";
import { Console, Effect } from "effect";
import {
	ConfluenceSettingsLive,
	ConfluenceUploadSettings,
	ConfluenceV2Client,
	MarkdownWorkspaceLive,
	MarkdownConfluencePlatformLive,
	Publisher,
	MermaidRendererPlugin,
	RuntimeEnvironmentService,
	fetchOAuthAccessToken,
	type RequiredConfluenceClient,
} from "@markdown-confluence/lib";
import { PuppeteerMermaidRenderer } from "@markdown-confluence/mermaid-puppeteer-renderer";
import { Api, ConfluenceClient } from "confluence.js";

const program = Effect.gen(function* () {
	const runtimeEnvironment = yield* RuntimeEnvironmentService as any;
	yield* runtimeEnvironment.setMaxListeners(Infinity) as any;

	const settings = yield* ConfluenceUploadSettings.ConfluenceSettingsService as any;

	const confluenceClient = yield* buildConfluenceClient(settings);

	const publisher = new Publisher(settings, confluenceClient, [
		new MermaidRendererPlugin(new PuppeteerMermaidRenderer()),
	]);

	const publishFilter = "";
	const results = yield* publisher.publishEffect(publishFilter) as any;

	for (const file of results) {
		if (file.successfulUploadResult) {
			yield* Console.log(
				chalk.green(
					`SUCCESS: ${file.node.file.absoluteFilePath} Content: ${file.successfulUploadResult.contentResult}, Images: ${file.successfulUploadResult.imageResult}, Labels: ${file.successfulUploadResult.labelResult}, Page URL: ${file.node.file.pageUrl}`,
				),
			) as any;
			continue;
		}
		yield* Console.error(
			chalk.red(
				`FAILED:  ${file.node.file.absoluteFilePath} publish failed. Error is: ${file.reason}`,
			),
		) as any;
	}
});

NodeRuntime.runMain(
	program.pipe(
		Effect.provide(MarkdownWorkspaceLive),
		Effect.provide(ConfluenceSettingsLive),
		Effect.catch((error) =>
			Effect.gen(function* () {
				const runtimeEnvironment = yield* RuntimeEnvironmentService as any;
				yield* Console.error(
					chalk.red(boxen(`Error: ${getErrorMessage(error)}`, { padding: 1 })),
				) as any;
				return yield* runtimeEnvironment.exit(1) as any;
			}),
		),
		Effect.provide(MarkdownConfluencePlatformLive),
	) as Effect.Effect<void, never>,
);

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : JSON.stringify(error);
}

type ConfluenceClientConfig = ConstructorParameters<typeof ConfluenceClient>[0];
type ConfluenceAuthentication = ConfluenceClientConfig["authentication"];

const onErrorMiddleware: NonNullable<ConfluenceClientConfig["middlewares"]>["onError"] = (e) => {
	if ("response" in e && "data" in e.response) {
		e.message =
			typeof e.response.data === "string" ? e.response.data : JSON.stringify(e.response.data);
	}
};

/**
 * Builds the Confluence client the publisher uses. For Basic auth this is the
 * stock confluence.js client (v1 REST). For OAuth, the v1 `/content` CRUD
 * endpoints return 410 via the gateway, so content operations are routed
 * through {@link ConfluenceV2Client} (v2 API) while attachments, labels, and
 * users continue to use the v1 client (which works under OAuth).
 */
function buildConfluenceClient(
	settings: ConfluenceUploadSettings.ConfluenceSettings,
): Effect.Effect<RequiredConfluenceClient, Error> {
	if (settings.authMethod === "oauth2") {
		return fetchOAuthAccessToken(
			settings.atlassianClientId,
			settings.atlassianClientSecret,
		).pipe(
			Effect.map((accessToken) => {
				const client = makeConfluenceClient(settings.confluenceBaseUrl, {
					oauth2: { accessToken },
				});
				const v2Content = new ConfluenceV2Client(settings.confluenceBaseUrl, accessToken);
				// Under OAuth the v1 /content reads are gone (410), so route content
				// CRUD plus the attachment/label *reads* through the v2 adapter. The
				// attachment upload and label writes still work on v1 and are kept.
				return {
					content: v2Content as unknown as Api.Content,
					space: client.space,
					contentAttachments: Object.assign(
						Object.create(client.contentAttachments) as Api.ContentAttachments,
						{
							getAttachments: v2Content.getAttachments.bind(v2Content),
						},
					),
					contentLabels: Object.assign(
						Object.create(client.contentLabels) as Api.ContentLabels,
						{
							getLabelsForContent: v2Content.getLabelsForContent.bind(v2Content),
						},
					),
					users: client.users,
				};
			}),
		);
	}

	return Effect.succeed(
		makeConfluenceClient(settings.confluenceBaseUrl, {
			basic: {
				email: settings.atlassianUserName,
				apiToken: settings.atlassianApiToken,
			},
		}),
	);
}

function makeConfluenceClient(
	host: string,
	authentication: ConfluenceAuthentication,
): ConfluenceClient {
	return new ConfluenceClient({
		host,
		authentication,
		middlewares: { onError: onErrorMiddleware },
	});
}
