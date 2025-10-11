# Rusalka

A GitHub Action for deploying TypeScript projects. Rusalka handles building your project, managing package.json scripts, and deploying to a specified branch. It also supports publishing to npm and creating versioned branches.

## Configuration

### Inputs

| Name | Description | Default |
|------|-------------|---------|
| `files` | List of files/directories to copy (space-separated) | `dist package.json LICENSE` |
| `branch` | Target branch | `dist` |
| `customCommands` | Run custom commands after build | (none) |
| `preBuildCustomCommands` | Run custom commands before build | (none) |
| `publishToNpm` | Publish the package to npm (optional) | `false` |
| `scriptsHandling` | Control how scripts in package.json are handled:<br>- `retain-all`: Retain all scripts<br>- `remove-all`: Remove all scripts<br>- `keep-start`: Keep only the "start" script<br>- `keep-build`: Keep only the "build" script<br>- `custom-list`: Provide a custom list of scripts to retain | `remove-all` |
| `customScripts` | Comma-separated list of scripts to retain (used with `scriptsHandling: custom-list`) | (none) |
| `createVersionedBranch` | If true and run on tag, also create a dist-{version} branch | `false` |

### Outputs

| Name | Description |
|------|-------------|
| `message` | Majestic exit message: "Rusalka is majestic" |

## Usage

```yaml
- name: Deploy with Rusalka
  uses: wxn0brP/rusalka@master
  with:
    files: 'dist package.json'
    branch: 'dist'
    publishToNpm: true
```