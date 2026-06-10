import { FileSystem } from "effect/FileSystem";
import { Path } from "effect/Path";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { defineConfig, type Plugin } from "vite-plus";
import { generatedBanner, isNodeBuiltin } from "../../vite.package-build.ts";

// The CLI is bundled as ESM but pulls in CommonJS dependencies (for example
// `mime-types`) that call `require(...)` for Node built-ins at runtime.
// ESM modules have no `require` in scope, so rolldown's CJS interop shim throws.
// Provide a real `require` via `createRequire` so those calls resolve natively.
const cliBanner = `${generatedBanner}import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);
`;

const NodePlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

function runNodePlatform<A>(effect: Effect.Effect<A, unknown, FileSystem | Path>) {
	return Effect.runPromise(effect.pipe(Effect.provide(NodePlatformLive)));
}

function copyRendererHtmlPlugin(): Plugin {
	return {
		apply: "build",
		name: "copy-mermaid-renderer-html",
		async closeBundle() {
			await runNodePlatform(
				Effect.gen(function* () {
					const fs = yield* FileSystem;
					const path = yield* Path;
					const source = path.resolve(
						"../mermaid-puppeteer-renderer/dist/mermaid_renderer.html",
					);
					const target = path.resolve("dist/mermaid_renderer.html");

					yield* fs.makeDirectory(path.dirname(target), { recursive: true });
					yield* fs.copyFile(source, target);
				}),
			);
		},
	};
}

export default defineConfig({
	build: {
		emptyOutDir: true,
		lib: {
			entry: "src/index.ts",
			fileName: () => "index.js",
			formats: ["es"],
		},
		minify: true,
		rollupOptions: {
			external: isNodeBuiltin,
			output: {
				banner: cliBanner,
				codeSplitting: false,
			},
		},
		sourcemap: true,
		target: "node16",
	},
	plugins: [copyRendererHtmlPlugin()],
	resolve: {
		mainFields: ["module", "main"],
	},
});
