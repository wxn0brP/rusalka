# Rusalka

A GitHub Action for deploying TypeScript projects. Rusalka handles building your project, managing `package.json` scripts, and deploying to a specified branch. It also supports publishing to npm and creating versioned branches.

## Configuration

Rusalka supports **dynamic configuration** via workflow-specific files. Instead of using action inputs, create a configuration file in the `rusalka` directory that matches your workflow name.

The configuration file can be **TypeScript (`.ts`)** or **JSON (`.json`)**, and should be named after your workflow. For example, if your workflow is named `"Build"`, create either:

```
rusalka/build.ts
```

or

```
rusalka/build.json
```

> **Note:** Rusalka will **only load one configuration file**. If both `.ts` and `.json` exist for the same workflow, the **TypeScript file (`.ts`) takes priority**.

### Load Priority

When multiple file types exist for the same workflow, Rusalka loads them in the following order:

1. `.ts` (TypeScript)
2. `.js` (JavaScript)
3. `.json` (JSON)

This allows you to use TypeScript for dynamic logic or JSON for static configuration.

### Configuration Options

| Name | Type | Description | Default |
|------|------|-------------|---------|
| `files` | string[] | List of files/directories to copy | `["dist", "package.json", "LICENSE"]` |
| `branch` | string | Target branch | `"dist"` |
| `preBuildCommands` | string | Run custom commands before build | `""` |
| `postBuildCommands` | string | Run custom commands after build | `""` |
| `scriptsHandling` | string | Control how scripts in package.json are handled:<br>- `"retain-all"`: Retain all scripts<br>- `"remove-all"`: Remove all scripts<br>- `"keep-start"`: Keep only the "start" script<br>- `"keep-build"`: Keep only the "build" script<br>- `"custom-list"`: Provide a custom list of scripts to retain | `"remove-all"` |
| `customScripts` | string | Comma-separated list of scripts to retain (used with `scriptsHandling: custom-list`) | `""` |
| `publishToNpm` | boolean | Publish the package to npm (optional) | `false` |
| `createVersionedBranch` | boolean | If true and run on tag, also create a dist-{version} branch | `false` |

### Configuration File Example

Create a file in your repository at `rusalka/{workflow-name}.{ts,js,json}` where `{workflow-name}` matches your workflow name in lowercase with spaces replaced by underscores.

**Example (rusalka/build.ts):**
```ts
export const files = ["dist", "package.json", "LICENSE"];
export const branch = "dist";
export const preBuildCommands = "";
export const postBuildCommands = "";
export const scriptsHandling = "remove-all";
export const customScripts = [];
export const publishToNpm = true;
export const createVersionedBranch = false;
// or export default
```

**Example (rusalka/build.json):**
```json
{
    "files": ["dist", "package.json", "LICENSE"],
    "branch": "dist",
    "preBuildCommands": "",
    "postBuildCommands": "",
    "scriptsHandling": "remove-all",
    "customScripts": [],
    "publishToNpm": true,
    "createVersionedBranch": false
}
```

### Outputs

| Name | Description |
|------|-------------|
| `message` | Majestic exit message: "Rusalka is majestic" |
[ `npm_tag` | NPM tag (if published): `latest`/`alpha`/`beta`/`next` |]

## Usage

```yaml
name: Build

on:
  push:
    branches:
      - master
    tags:
      - "*"

  workflow_dispatch:

concurrency:
  group: build
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: wxn0brP/rusalka@master
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # required to npm publish

```

**Note:** Make sure to create the corresponding configuration file in the `rusalka` directory that matches your workflow name.