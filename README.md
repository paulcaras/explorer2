# Explorer 2

Explorer 2 enhances your development workflow by providing **dual independent file explorers** in VS Code's sidebar. Navigate and manage files across different project directories simultaneously—ideal for working with monorepos, separating frontend and backend codebases, or comparing different modules side by side without constantly switching between views.

![Explorer 2 Demo](media/screenshot1.png)

## Features

### Dual File Explorers
- **Two Independent Views**: Navigate different folders at the same time with "Panel I" and "Panel II"
- **Dedicated Activity Bar Icon**: Quick access via the sidebar with a custom "Explorer 2" icon
- **Independent Navigation**: Each explorer maintains its own folder context and state
- **Persistent State**: Automatically restores the last viewed folder in each explorer when you reopen VS Code

### Complete File Operations
- **Create**: New files and folders with intuitive prompts
- **Delete**: Remove files and folders with confirmation
- **Rename**: Quick rename with `F2` keyboard shortcut
- **Cut/Copy/Paste**: Full clipboard support with visual feedback
- **Duplicate**: Clone files and folders with custom naming
- **Drag & Drop**: Move or copy files between the two explorers

### Enhanced Navigation
- **Show/Hide Hidden Files**: Toggle visibility of dotfiles and hidden directories
- **Collapse/Expand All**: Quickly manage folder tree expansion states
- **Navigate to Folder**: Right-click any folder to make it the root of that explorer
- **Go to Parent Folder**: Navigate up to the parent directory with toolbar button
- **Sync with Active Editor**: Automatically reveal the currently open file in the explorer
- **State Persistence**: Automatically remembers the last viewed folder in each explorer
- **Smart Icons**: Context-aware file icons based on file type and extension
- **Sorted Display**: Files organized alphabetically with folders first

### Integration Features
- **Open to Left/Right**: Open files in split editor panes
- **Reveal in Finder**: Show files in your system file manager (macOS)
- **Open in Chat**: Integration with VS Code chat features
- **Copy Path**: Copy absolute or relative file paths to clipboard
- **Auto-Refresh**: File system watchers keep both explorers synchronized with disk changes

## Installation

1. Open VS Code
2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux) to open Extensions
3. Search for "Explorer 2"
4. Click Install

Or install from the command line:
```bash
code --install-extension paul.explorer2
```

## Usage

1. Click the "Explorer 2" icon in the Activity Bar (sidebar)
2. You'll see two explorer views: "Panel I" and "Panel II"
3. Navigate each explorer independently to different folders
4. Use context menu (right-click) to access file operations
5. Drag and drop files between explorers to move or copy them

## Commands

All commands are accessible via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

| Command | Description |
|---------|-------------|
| `Explorer 2: Refresh Panel I` | Manually refresh the top explorer |
| `Explorer 2: Refresh Panel II` | Manually refresh the bottom explorer |
| `Explorer 2: New File` | Create a new file in the selected folder |
| `Explorer 2: New Folder` | Create a new folder in the selected folder |
| `Explorer 2: Delete` | Delete the selected file or folder |
| `Explorer 2: Rename` | Rename the selected file or folder |
| `Explorer 2: Cut` | Cut the selected file or folder |
| `Explorer 2: Copy` | Copy the selected file or folder |
| `Explorer 2: Paste` | Paste into the selected folder |
| `Explorer 2: Duplicate` | Duplicate the selected file or folder |
| `Explorer 2: Reveal in Finder` | Show file in system file manager |
| `Explorer 2: Open in Chat` | Open file in VS Code chat |
| `Explorer 2: Copy Absolute Path` | Copy absolute path to clipboard |
| `Explorer 2: Copy Relative Path` | Copy workspace-relative path to clipboard |
| `Explorer 2: Collapse All` | Collapse all expanded folders |
| `Explorer 2: Expand All` | Expand all folders |
| `Explorer 2: Sync with Active Editor` | Reveal active file in explorer |
| `Explorer 2: Open to Left` | Open file in left editor pane |
| `Explorer 2: Open to Right` | Open file in right editor pane |
| `Explorer 2: Navigate Panel I Here` | Set selected folder as root of Panel I |
| `Explorer 2: Navigate Panel II Here` | Set selected folder as root of Panel II |
| `Explorer 2: Go to Parent Folder` | Navigate up to the parent directory |

## Keyboard Shortcuts

| Key | Command | Context |
|-----|---------|---------|
| `F2` | Rename | Explorer focused |
| `Delete` | Delete | Explorer focused |
| `Cmd+C` / `Ctrl+C` | Copy | Explorer focused |
| `Cmd+X` / `Ctrl+X` | Cut | Explorer focused |
| `Cmd+V` / `Ctrl+V` | Paste | Explorer focused |

## Extension Settings

This extension contributes the following settings:

* `explorer2.showHiddenFiles`: Show or hide files and folders starting with `.` (default: `false`)
* `explorer2.excludePatterns`: Array of patterns to exclude from the explorer (default: `["node_modules", ".git", "dist", "build"]`)
* `explorer2.sortBy`: Sort files by `"name"`, `"type"`, or `"modified"` (default: `"name"`)

Configure these settings in your VS Code settings:

```json
{
  "explorer2.showHiddenFiles": true,
  "explorer2.excludePatterns": ["node_modules", ".git", "*.log"],
  "explorer2.sortBy": "name"
}
```

## Use Cases

- **Code Refactoring**: View source and test files side by side
- **File Organization**: Move files between different project folders
- **Multi-Project Work**: Navigate multiple workspaces simultaneously
- **Documentation**: Keep docs open while browsing implementation files
- **Large Codebases**: Compare different modules or feature directories

## Requirements

- VS Code version 1.108.1 or higher

## Known Issues

None at this time. Please report issues on the GitHub repository.

## Development

To contribute or modify this extension:

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Run tests
npm run test

# Lint code
npm run lint
```

## Quick Start

1. Install the extension
2. Click the **Explorer 2** icon in the Activity Bar
3. Set each panel to a different folder
4. Use right-click context menus for file operations
5. Drag & drop between panels to move/copy files

## Screenshots

### Dual Independent Explorers
![Dual Explorers](media/screenshot1.png)
*Side-by-side file navigation with independent folder contexts*

### File Operations
![File Operations](media/screenshot2.png)
*Complete context menu with create, delete, rename, and more*

### Split Editor Integration
![Split Editing](media/screenshot3.png)
*Open files to left/right editor panes for side-by-side comparison*

## Troubleshooting

**Views not showing?**
- Ensure the Explorer 2 icon is visible in the Activity Bar
- Try running "Explorer 2: Refresh Panel I/II" from Command Palette

**Files not refreshing?**
- The extension uses file system watchers (except for excluded patterns)
- Try manual refresh using the refresh icon in the toolbar

**Performance with large directories?**
- Adjust `explorer2.excludePatterns` in settings to exclude node_modules or build folders
- Use the collapse buttons to reduce rendered tree nodes

## Support & Feedback

Found a bug or have a feature request? Visit the [GitHub repository](https://github.com/paulcaras/explorer2/issues)

## License

This project is licensed under the MIT License. See [LICENSE.md](LICENSE.md) for details.

---

**Enjoy dual-pane file exploration!**
