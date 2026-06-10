# @markdown-confluence/cli

`@markdown-confluence/cli` is a powerful tool that allows you to publish your markdown files as Confluence pages. It is designed to work seamlessly in various environments, including package CLI, Docker Container, and GitHub Actions, enabling you to use your docs wherever you need them. Comprehensive documentation for the tool can be found at [https://markdown-confluence.com/](https://markdown-confluence.com/).

## Usage Examples

### CLI

**Example setup**

`.markdown-confluence.json`:

```json
{
  "confluenceBaseUrl": "https://markdown-confluence.atlassian.net",
  "confluenceParentId": "524353",
  "atlassianUserName": "andrew.mcclenaghan@gmail.com",
  "folderToPublish": ".",
  "contentRoot": "."
}
```

**Environment Variables**

macOS / Linux:

```bash
export ATLASSIAN_API_TOKEN="YOUR API TOKEN"
```

Windows:

```bash
set ATLASSIAN_API_TOKEN="YOUR API TOKEN"
```

[Learn more about `set` command](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/set_1)

**CLI Command**

```bash
vp dlx @markdown-confluence/cli
```

### Docker Container

**Example setup**

```bash
docker run -it --rm -v "$(pwd):/content" -e ATLASSIAN_API_TOKEN ghcr.io/markdown-confluence/publish:latest
```

### GitHub Actions

**Example setup**

`.github/workflows/publish.yml`:

```yaml
name: Publish to Confluence
on: [push]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Publish Markdown to Confluence
        uses: markdown-confluence/publish-action@v5
        with:
          confluenceBaseUrl: https://markdown-confluence.atlassian.net
          confluenceParentId: "524353"
          atlassianUserName: ${{ secrets.ATLASSIAN_USERNAME }}
          atlassianApiToken: ${{ secrets.ATLASSIAN_API_TOKEN }}
          folderToPublish: docs
          contentRoot: .
```

**Environment Variables**

Add your API token as a secret in your GitHub repository settings:

1. Go to your repository's `Settings` tab.
2. Click on `Secrets` in the left sidebar.
3. Click on `New repository secret`.
4. Name it `ATLASSIAN_API_TOKEN` and enter your API token as the value.
5. Click on `Add secret`.

## Configuration

The CLI, Docker image, and GitHub Action all read the same global settings. You can set them in `.markdown-confluence.json`, environment variables, or command line options.

### `.markdown-confluence.json`

```json
{
  "confluenceBaseUrl": "https://your-domain.atlassian.net",
  "confluenceParentId": "123456",
  "atlassianUserName": "your-email@example.com",
  "atlassianApiToken": "optional-token-from-config",
  "folderToPublish": "docs",
  "contentRoot": ".",
  "firstHeadingPageTitle": false
}
```

### Global Settings

| JSON key | Environment variable | CLI option | Description |
| --- | --- | --- | --- |
| `confluenceBaseUrl` | `CONFLUENCE_BASE_URL` | `--baseUrl`, `-b` | Your Confluence site URL. For Confluence Cloud, use the Atlassian site URL without `/wiki`, for example `https://your-domain.atlassian.net`. When authenticating with OAuth 2.0, set this to the API gateway URL `https://api.atlassian.com/ex/confluence/{cloudId}`. |
| `confluenceSiteUrl` | `CONFLUENCE_SITE_URL` | `--siteUrl` | The browsable Confluence site URL used to build and match display links (for example `https://your-domain.atlassian.net`). Falls back to `confluenceBaseUrl` when unset. Required when `confluenceBaseUrl` points at the API gateway, otherwise published links would be unresolvable. |
| `confluenceParentId` | `CONFLUENCE_PARENT_ID` | `--parentId`, `-p` | The numeric ID of an existing Confluence parent page. The parent page determines the target space. |
| `authMethod` | `CONFLUENCE_AUTH_METHOD` | `--authMethod` | Authentication method: `basic` (default) or `oauth2`. |
| `atlassianUserName` | `ATLASSIAN_USERNAME` | `--userName`, `-u` | The Atlassian user name or email address used for publishing. Required when `authMethod` is `basic`. |
| `atlassianApiToken` | `ATLASSIAN_API_TOKEN` | `--apiToken` | The Atlassian API token. Required when `authMethod` is `basic`. Prefer an environment variable or GitHub secret instead of committing this value to JSON. |
| `atlassianClientId` | `ATLASSIAN_CLIENT_ID` | `--clientId` | OAuth 2.0 client ID. Required when `authMethod` is `oauth2`. |
| `atlassianClientSecret` | `ATLASSIAN_CLIENT_SECRET` | `--clientSecret` | OAuth 2.0 client secret. Required when `authMethod` is `oauth2`. Prefer an environment variable or GitHub secret instead of committing this value to JSON. |
| `folderToPublish` | `FOLDER_TO_PUBLISH` | `--enableFolder`, `-f` | The folder, relative to `contentRoot`, whose Markdown files default to `connie-publish: true`. Use `.` to publish all Markdown files under `contentRoot`. |
| `contentRoot` | `CONFLUENCE_CONTENT_ROOT` | `--contentRoot`, `--cr` | The root directory to scan for Markdown files and referenced content. |
| `firstHeadingPageTitle` | `CONFLUENCE_FIRST_HEADING_PAGE_TITLE` | `--firstHeaderPageTitle`, `--fh` | When `true`, use the first heading as the page title when `connie-title` is not set. |

### OAuth 2.0 Service Account Authentication

By default the CLI authenticates with Basic Auth using `atlassianUserName` and `atlassianApiToken`. You can instead authenticate as a service account using the OAuth 2.0 client-credentials grant. The CLI exchanges the credentials for a short-lived bearer token itself, so this works for the CLI, the Docker image, and the GitHub Action without any pre-steps.

To use OAuth 2.0:

1. Set `authMethod` to `oauth2`.
2. Supply `atlassianClientId` and `atlassianClientSecret` (prefer environment variables or secrets).
3. Set `confluenceBaseUrl` to the API gateway URL `https://api.atlassian.com/ex/confluence/{cloudId}`.
4. Set `confluenceSiteUrl` to your browsable site URL `https://your-domain.atlassian.net` so published links resolve correctly.

`.markdown-confluence.json`:

```json
{
  "authMethod": "oauth2",
  "confluenceBaseUrl": "https://api.atlassian.com/ex/confluence/your-cloud-id",
  "confluenceSiteUrl": "https://your-domain.atlassian.net",
  "confluenceParentId": "123456",
  "folderToPublish": "docs",
  "contentRoot": "."
}
```

```bash
export ATLASSIAN_CLIENT_ID="YOUR CLIENT ID"
export ATLASSIAN_CLIENT_SECRET="YOUR CLIENT SECRET"
```

The CLI exchanges these credentials for a bearer token against the Atlassian token endpoint (`https://auth.atlassian.com/oauth/token`) and uses it for all Confluence API requests.

> **Note:** The bearer token is fetched once at startup and is short-lived. This is sufficient for normal publishes, but a very large publish run could exceed the token lifetime and begin failing partway through. If you hit this, split the publish into smaller runs.

### `folderToPublish` vs `contentRoot`

Use `contentRoot` to choose the directory the tool scans. Use `folderToPublish` to choose which Markdown files under that root are published by default.

This scans the whole repository but only publishes Markdown files under `docs` unless another file opts in with `connie-publish: true`:

```json
{
  "contentRoot": ".",
  "folderToPublish": "docs"
}
```

This scans only the `docs` directory and publishes every Markdown file found there:

```json
{
  "contentRoot": "docs",
  "folderToPublish": "."
}
```

This scans `phil` and publishes only files under `phil/thingy`:

```json
{
  "contentRoot": "./phil/",
  "folderToPublish": "thingy"
}
```

### Per-page Frontmatter

Individual Markdown files can override publishing behavior with frontmatter:

```yaml
---
connie-publish: true
connie-title: Custom Confluence Page Title
connie-page-id: "123456"
connie-dont-change-parent-page: true
connie-frontmatter-to-publish:
  - owner
connie-content-type: page
connie-blog-post-date: "2024-01-31"
tags:
  - docs
---
```

These keys apply to one Markdown file at a time and are not global `.markdown-confluence.json` settings.
