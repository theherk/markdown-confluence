import { expect, test } from "@effect/vitest";
import { Effect } from "effect";
import {
	BinaryFile,
	FilesToUpload,
	MarkdownFile,
	MarkdownWorkspace,
	MarkdownWorkspaceService,
} from "./MarkdownWorkspace";
import { ConfluencePerPageAllValues } from "./ConniePageConfig";
import { RequiredConfluenceClient } from "./ConfluenceClient";
import { uploadBufferEffect, uploadFileEffect } from "./Attachments";

const pngBytes = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
	"base64",
);

test("fully decodes file URL components before reading binary files", async () => {
	const uploadRequests: unknown[] = [];
	const workspace = new TestMarkdownWorkspace((searchPath) =>
		searchPath === "file#name.png"
			? {
					filename: "file#name.png",
					filePath: "assets/file#name.png",
					mimeType: "image/png",
					contents: pngBytes,
				}
			: false,
	);

	const result = await Effect.runPromise(
		uploadFileEffect(
			makeConfluenceClient(uploadRequests),
			"page-id",
			"page.md",
			"file%23name.png",
			{},
		).pipe(Effect.provideService(MarkdownWorkspaceService, workspace)),
	);

	expect(result?.status).toBe("uploaded");
	expect(getUploadedAttachment(uploadRequests).contentType).toBe("image/png");
});

test("derives upload buffer content type from the filename", async () => {
	const uploadRequests: unknown[] = [];

	const result = await Effect.runPromise(
		uploadBufferEffect(
			makeConfluenceClient(uploadRequests),
			"page-id",
			"notes.txt",
			Buffer.from("hello"),
			{},
		),
	);

	expect(result?.status).toBe("uploaded");
	expect(getUploadedAttachment(uploadRequests).contentType).toBe("text/plain");
});

test("extracts SVG dimensions when image-size cannot detect them", async () => {
	const uploadRequests: unknown[] = [];
	const svgBytes = Buffer.from(
		'<?xml version="1.0"?><!----><svg xmlns="http://www.w3.org/2000/svg" width="1911px" height="1391px" viewBox="0 0 1911 1391"></svg>',
	);
	const workspace = new TestMarkdownWorkspace((searchPath) =>
		searchPath === "diagram.svg"
			? {
					filename: "diagram.svg",
					filePath: "img/diagram.svg",
					mimeType: "image/svg+xml",
					contents: svgBytes,
				}
			: false,
	);

	const result = await Effect.runPromise(
		uploadFileEffect(
			makeConfluenceClient(uploadRequests),
			"page-id",
			"page.md",
			"diagram.svg",
			{},
		).pipe(Effect.provideService(MarkdownWorkspaceService, workspace)),
	);

	expect(result?.width).toBe(1911);
	expect(result?.height).toBe(1391);
	expect(getUploadedAttachment(uploadRequests).contentType).toBe("image/svg+xml");
});

class TestMarkdownWorkspace implements MarkdownWorkspace {
	readonly getMarkdownFilesToUpload: Effect.Effect<FilesToUpload, Error> = Effect.succeed([]);

	constructor(private readonly binaryForPath: (searchPath: string) => BinaryFile | false) {}

	updateMarkdownValues(
		_absoluteFilePath: string,
		_values: Partial<ConfluencePerPageAllValues>,
	): Effect.Effect<void, Error> {
		return Effect.void;
	}

	loadMarkdownFile(_absoluteFilePath: string): Effect.Effect<MarkdownFile, Error> {
		return Effect.fail(new Error("Method not implemented."));
	}

	readBinary(searchPath: string): Effect.Effect<BinaryFile | false, Error> {
		return Effect.succeed(this.binaryForPath(searchPath));
	}
}

function makeConfluenceClient(uploadRequests: unknown[]): RequiredConfluenceClient {
	return {
		contentAttachments: {
			createOrUpdateAttachments: async (attachmentDetails: unknown) => {
				uploadRequests.push(attachmentDetails);
				return {
					results: [
						{
							extensions: {
								fileId: "file-id",
							},
							container: {
								id: "page-id",
							},
						},
					],
				};
			},
		},
	} as unknown as RequiredConfluenceClient;
}

function getUploadedAttachment(uploadRequests: unknown[]): { contentType: string } {
	const request = uploadRequests[0] as
		| {
				attachments: Array<{
					contentType: string;
				}>;
		  }
		| undefined;
	if (!request) {
		throw new Error("Missing upload request");
	}

	const attachment = request.attachments[0];
	if (!attachment) {
		throw new Error("Missing upload attachment");
	}

	return attachment;
}
