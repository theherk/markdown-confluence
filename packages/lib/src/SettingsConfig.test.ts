import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterEach, expect, test } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import { loadConfluenceSettingsEffect, parseConfluenceSettingsEffect } from "./SettingsConfig";
import { RuntimeEnvironment, RuntimeEnvironmentService, runEffect } from "./effects";

let tmpRoot: string | undefined;

afterEach(async () => {
	await runEffect(
		Effect.gen(function* () {
			const fs = yield* FileSystem;

			if (tmpRoot) {
				yield* fs.remove(tmpRoot, { recursive: true, force: true });
				tmpRoot = undefined;
			}
		}),
	);
});

test("loads settings from Effect ConfigProviders with CLI, env, file, default precedence", async () => {
	const { configPath, expectedCliContentRoot } = await runEffect(
		Effect.gen(function* () {
			const fs = yield* FileSystem;
			const path = yield* Path;

			tmpRoot = yield* fs.makeTempDirectory({ prefix: "markdown-confluence-settings-" });
			const filePath = path.join(tmpRoot, ".markdown-confluence.json");

			yield* fs.writeFileString(
				filePath,
				JSON.stringify({
					confluenceBaseUrl: "https://file.example.atlassian.net",
					confluenceParentId: "file-parent",
					atlassianUserName: "file-user@example.com",
					atlassianApiToken: "file-token",
					folderToPublish: "file-folder",
					contentRoot: "file-root",
					firstHeadingPageTitle: true,
				}),
			);

			return {
				configPath: filePath,
				expectedCliContentRoot: `cli-root${path.sep}`,
			};
		}),
	);

	const runtimeEnvironment = makeRuntimeEnvironment({
		argv: [
			"node",
			"markdown-confluence",
			"--config",
			configPath,
			"--parentId",
			"cli-parent",
			"--apiToken",
			"cli-token",
			"--contentRoot",
			"cli-root",
		],
		cwd: tmpRoot ?? ".",
		env: {
			CONFLUENCE_BASE_URL: "https://env.example.atlassian.net",
			ATLASSIAN_USERNAME: "env-user@example.com",
			FOLDER_TO_PUBLISH: "env-folder",
		},
	});

	const settings = await Effect.runPromise(
		loadConfluenceSettingsEffect().pipe(
			Effect.provide(
				Layer.mergeAll(
					NodeFileSystem.layer,
					NodePath.layer,
					Layer.succeed(RuntimeEnvironmentService, runtimeEnvironment),
				),
			),
		),
	);

	expect(settings).toEqual({
		confluenceBaseUrl: "https://env.example.atlassian.net",
		confluenceSiteUrl: "",
		confluenceParentId: "cli-parent",
		authMethod: "basic",
		atlassianUserName: "env-user@example.com",
		atlassianApiToken: "cli-token",
		atlassianClientId: "",
		atlassianClientSecret: "",
		folderToPublish: "env-folder",
		contentRoot: expectedCliContentRoot,
		firstHeadingPageTitle: true,
		forcePublish: false,
	});
});

test("keeps explicit false values from config providers", async () => {
	const { settings, expectedContentRoot } = await runEffect(
		Effect.gen(function* () {
			const path = yield* Path;
			const contentRoot = "docs";
			const settings = yield* parseConfluenceSettingsEffect(
				ConfigProvider.fromUnknown({
					confluenceBaseUrl: "https://file.example.atlassian.net",
					confluenceParentId: "file-parent",
					atlassianUserName: "file-user@example.com",
					atlassianApiToken: "file-token",
					folderToPublish: "file-folder",
					contentRoot,
					firstHeadingPageTitle: false,
				}),
			);

			return {
				settings,
				expectedContentRoot: `${contentRoot}${path.sep}`,
			};
		}),
	);

	expect(settings.firstHeadingPageTitle).toBe(false);
	expect(settings.contentRoot).toBe(expectedContentRoot);
});

test("parses boolean CLI values passed as separate arguments", async () => {
	const { settings, expectedContentRoot } = await runEffect(
		Effect.gen(function* () {
			const path = yield* Path;
			const contentRoot = "docs";
			const runtimeEnvironment = makeRuntimeEnvironment({
				argv: [
					"node",
					"markdown-confluence",
					"--baseUrl",
					"https://cli.example.atlassian.net",
					"--parentId",
					"cli-parent",
					"--userName",
					"cli-user@example.com",
					"--apiToken",
					"cli-token",
					"--enableFolder",
					"docs",
					"--contentRoot",
					contentRoot,
					"--fh",
					"false",
				],
				cwd: ".",
				env: {},
			});
			const settings = yield* loadConfluenceSettingsEffect().pipe(
				Effect.provide(
					Layer.mergeAll(
						NodeFileSystem.layer,
						NodePath.layer,
						Layer.succeed(RuntimeEnvironmentService, runtimeEnvironment),
					),
				),
			);

			return {
				settings,
				expectedContentRoot: `${contentRoot}${path.sep}`,
			};
		}),
	);

	expect(settings.firstHeadingPageTitle).toBe(false);
	expect(settings.contentRoot).toBe(expectedContentRoot);
});

test("loads OAuth client-credentials settings and leaves basic credentials optional", async () => {
	const settings = await runEffect(
		parseConfluenceSettingsEffect(
			ConfigProvider.fromUnknown({
				confluenceBaseUrl: "https://api.atlassian.com/ex/confluence/cloud-id",
				confluenceSiteUrl: "https://site.example.atlassian.net",
				confluenceParentId: "parent",
				authMethod: "oauth2",
				atlassianClientId: "client-id",
				atlassianClientSecret: "client-secret",
				folderToPublish: "docs",
				contentRoot: "docs",
				firstHeadingPageTitle: false,
			}),
		),
	);

	expect(settings.authMethod).toBe("oauth2");
	expect(settings.atlassianClientId).toBe("client-id");
	expect(settings.atlassianClientSecret).toBe("client-secret");
	expect(settings.confluenceSiteUrl).toBe("https://site.example.atlassian.net");
	expect(settings.atlassianUserName).toBe("");
	expect(settings.atlassianApiToken).toBe("");
});

test("defaults authMethod to basic and confluenceSiteUrl to empty string", async () => {
	const settings = await runEffect(
		parseConfluenceSettingsEffect(
			ConfigProvider.fromUnknown({
				confluenceBaseUrl: "https://site.example.atlassian.net",
				confluenceParentId: "parent",
				atlassianUserName: "user@example.com",
				atlassianApiToken: "token",
				folderToPublish: "docs",
				contentRoot: "docs",
				firstHeadingPageTitle: false,
			}),
		),
	);

	expect(settings.authMethod).toBe("basic");
	expect(settings.confluenceSiteUrl).toBe("");
});

test("fails when basic auth is missing the API token", async () => {
	await expect(
		runEffect(
			parseConfluenceSettingsEffect(
				ConfigProvider.fromUnknown({
					confluenceBaseUrl: "https://site.example.atlassian.net",
					confluenceParentId: "parent",
					authMethod: "basic",
					atlassianUserName: "user@example.com",
					folderToPublish: "docs",
					contentRoot: "docs",
					firstHeadingPageTitle: false,
				}),
			),
		),
	).rejects.toThrow(/Atlassian API token is required when authMethod is basic/);
});

test("fails when oauth2 auth is missing the client secret", async () => {
	await expect(
		runEffect(
			parseConfluenceSettingsEffect(
				ConfigProvider.fromUnknown({
					confluenceBaseUrl: "https://api.atlassian.com/ex/confluence/cloud-id",
					confluenceParentId: "parent",
					authMethod: "oauth2",
					atlassianClientId: "client-id",
					folderToPublish: "docs",
					contentRoot: "docs",
					firstHeadingPageTitle: false,
				}),
			),
		),
	).rejects.toThrow(/Atlassian client secret is required when authMethod is oauth2/);
});

test("requires confluenceSiteUrl when confluenceBaseUrl is the Atlassian API gateway", async () => {
	await expect(
		runEffect(
			parseConfluenceSettingsEffect(
				ConfigProvider.fromUnknown({
					confluenceBaseUrl: "https://api.atlassian.com/ex/confluence/cloud-id",
					confluenceParentId: "parent",
					authMethod: "oauth2",
					atlassianClientId: "client-id",
					atlassianClientSecret: "client-secret",
					folderToPublish: "docs",
					contentRoot: "docs",
					firstHeadingPageTitle: false,
				}),
			),
		),
	).rejects.toThrow(
		/Confluence site URL is required when confluenceBaseUrl points at the Atlassian API gateway/,
	);
});

test("accepts the Atlassian API gateway base URL when confluenceSiteUrl is provided", async () => {
	const settings = await runEffect(
		parseConfluenceSettingsEffect(
			ConfigProvider.fromUnknown({
				confluenceBaseUrl: "https://api.atlassian.com/ex/confluence/cloud-id",
				confluenceSiteUrl: "https://site.example.atlassian.net",
				confluenceParentId: "parent",
				authMethod: "oauth2",
				atlassianClientId: "client-id",
				atlassianClientSecret: "client-secret",
				folderToPublish: "docs",
				contentRoot: "docs",
				firstHeadingPageTitle: false,
			}),
		),
	);

	expect(settings.confluenceSiteUrl).toBe("https://site.example.atlassian.net");
});

test("rejects an unsupported authMethod value", async () => {
	await expect(
		runEffect(
			parseConfluenceSettingsEffect(
				ConfigProvider.fromUnknown({
					confluenceBaseUrl: "https://site.example.atlassian.net",
					confluenceParentId: "parent",
					authMethod: "saml",
					atlassianUserName: "user@example.com",
					atlassianApiToken: "token",
					folderToPublish: "docs",
					contentRoot: "docs",
					firstHeadingPageTitle: false,
				}),
			),
		),
	).rejects.toThrow(/Unsupported authMethod "saml"/);
});

function makeRuntimeEnvironment({
	argv,
	cwd,
	env,
}: {
	argv: readonly string[];
	cwd: string;
	env: Record<string, string | undefined>;
}): RuntimeEnvironment {
	return {
		cwd: Effect.succeed(cwd),
		chdir: () => Effect.void,
		argv: Effect.succeed(argv),
		getEnv: (name) => Effect.succeed(env[name]),
		setMaxListeners: () => Effect.void,
		exit: (code) => Effect.die(new Error(`Unexpected exit ${code}`)) as Effect.Effect<never>,
	};
}
