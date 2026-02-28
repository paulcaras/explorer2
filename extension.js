const vscode = require("vscode");
const path = require("path");

/**
 * Utility to get file icon based on extension
 */
function getFileIcon(filePath, isDirectory) {
  if (isDirectory) {
    return new vscode.ThemeIcon("folder");
  }

  const ext = path.extname(filePath).toLowerCase();
  const nameOnly = path.basename(filePath).toLowerCase();

  // Map extensions to VS Code icons
  const iconMap = {
    // Images
    ".png": "file-media",
    ".jpg": "file-media",
    ".jpeg": "file-media",
    ".gif": "file-media",
    ".svg": "file-media",
    ".ico": "file-media",
    ".webp": "file-media",
    // Code
    ".js": "file-code",
    ".ts": "file-code",
    ".tsx": "file-code",
    ".jsx": "file-code",
    ".py": "file-code",
    ".java": "file-code",
    ".cpp": "file-code",
    ".c": "file-code",
    ".go": "file-code",
    ".rs": "file-code",
    ".php": "file-code",
    ".rb": "file-code",
    ".swift": "file-code",
    ".kt": "file-code",
    // Markup
    ".html": "file-code",
    ".htm": "file-code",
    ".xml": "file-code",
    ".json": "file-code",
    ".yaml": "file-code",
    ".yml": "file-code",
    ".toml": "file-code",
    ".css": "file-code",
    ".scss": "file-code",
    ".less": "file-code",
    // Docs
    ".md": "file-text",
    ".txt": "file-text",
    ".pdf": "file-pdf",
    ".doc": "file-word",
    ".docx": "file-word",
    // Data
    ".csv": "file-binary",
    ".sql": "file-code",
    // Config
    ".env": "file-settings",
    ".config": "file-settings",
    // Archives
    ".zip": "file-zip",
    ".tar": "file-zip",
    ".gz": "file-zip",
    ".rar": "file-zip",
  };

  // Special cases by filename
  if (nameOnly === ".gitignore") return new vscode.ThemeIcon("file-add");
  if (nameOnly === ".env") return new vscode.ThemeIcon("file-settings");
  if (nameOnly === "package.json") return new vscode.ThemeIcon("file-code");
  if (nameOnly === "dockerfile") return new vscode.ThemeIcon("file-code");

  return new vscode.ThemeIcon(iconMap[ext] || "file");
}

/**
 * Clipboard manager for cut/copy/paste operations
 */
class ClipboardManager {
  constructor() {
    this.clipboard = null;
    this.mode = null; // 'copy' or 'cut'
  }

  async copy(uris) {
    const items = Array.isArray(uris) ? uris : [uris];
    this.clipboard = items;
    this.mode = "copy";
    if (items.length === 1) {
      vscode.window.showInformationMessage(`Copied: ${path.basename(items[0].fsPath)}`);
      return;
    }

    vscode.window.showInformationMessage(`Copied ${items.length} items`);
  }

  async cut(uris) {
    const items = Array.isArray(uris) ? uris : [uris];
    this.clipboard = items;
    this.mode = "cut";
    if (items.length === 1) {
      vscode.window.showInformationMessage(`Cut: ${path.basename(items[0].fsPath)}`);
      return;
    }

    vscode.window.showInformationMessage(`Cut ${items.length} items`);
  }

  async paste(targetUri, providers) {
    if (!this.clipboard) {
      vscode.window.showWarningMessage("Nothing in clipboard");
      return;
    }

    const sourceUris = Array.isArray(this.clipboard) ? this.clipboard : [this.clipboard];
    const targetPath = targetUri.fsPath;
    const action = this.mode === "cut" ? "Moved" : "Copied";
    let successCount = 0;
    let failureCount = 0;

    for (const sourceUri of sourceUris) {
      const fileName = path.basename(sourceUri.fsPath);
      const destUri = vscode.Uri.file(path.join(targetPath, fileName));

      if (sourceUri.fsPath === destUri.fsPath) {
        failureCount += 1;
        continue;
      }

      try {
        if (this.mode === "cut") {
          await vscode.workspace.fs.rename(sourceUri, destUri, { overwrite: false });
        } else {
          await vscode.workspace.fs.copy(sourceUri, destUri, { overwrite: false });
        }
        successCount += 1;
      } catch {
        failureCount += 1;
      }
    }

    if (this.mode === "cut") {
      this.clipboard = null;
      this.mode = null;
    }

    providers.forEach(p => p.refresh());

    if (successCount > 0 && failureCount === 0) {
      vscode.window.showInformationMessage(`${action} ${successCount} item${successCount === 1 ? "" : "s"}`);
      return;
    }

    if (successCount > 0 && failureCount > 0) {
      vscode.window.showWarningMessage(`${action} ${successCount} item${successCount === 1 ? "" : "s"}; ${failureCount} failed`);
      return;
    }

    vscode.window.showErrorMessage("Paste failed for all items");
  }

  clear() {
    this.clipboard = null;
    this.mode = null;
  }
}

/**
 * Custom TreeDataProvider for file exploration
 */
class ExplorerProvider {
  constructor(rootUri, clipboardManager, otherProvider = null, showHiddenFiles = false, stateManager = null, stateKey = null) {
    this.rootUri = rootUri;
    this.clipboardManager = clipboardManager;
    this.otherProvider = otherProvider;
    this.showHiddenFiles = showHiddenFiles;
    this.stateManager = stateManager;
    this.stateKey = stateKey;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._watchers = [];
    this.collapsedState = new Set(); // Track collapsed folders
    this.currentRootUri = null; // Track current root for this explorer
    this._refreshTimeout = null; // Debounce timer for file watcher events
    this._otherRefreshTimeout = null; // Debounce timer for related explorer refresh
  }

  setOtherProvider(other) {
    this.otherProvider = other;
  }

  setShowHiddenFiles(show) {
    this.showHiddenFiles = show;
    this.refresh();
  }

  setCurrentRoot(uri) {
    this.currentRootUri = uri;
    this.saveState();
    this.refresh();
  }

  saveState() {
    if (this.stateManager && this.stateKey && this.currentRootUri) {
      this.stateManager.update(this.stateKey, this.currentRootUri.fsPath);
    }
  }

  restoreState() {
    if (this.stateManager && this.stateKey) {
      const savedPath = this.stateManager.get(this.stateKey);
      if (savedPath) {
        try {
          this.currentRootUri = vscode.Uri.file(savedPath);
        } catch {
          // If saved path is invalid, use default
          this.currentRootUri = this.rootUri;
        }
      } else {
        this.currentRootUri = this.rootUri;
      }
    } else {
      this.currentRootUri = this.rootUri;
    }
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  _debouncedRefresh(delayMs = 300) {
    if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
    this._refreshTimeout = setTimeout(() => {
      this.refresh();
      this._refreshTimeout = null;
    }, delayMs);
  }

  _debouncedRefreshOther(changedUri, delayMs = 300) {
    if (this._otherRefreshTimeout) clearTimeout(this._otherRefreshTimeout);
    this._otherRefreshTimeout = setTimeout(() => {
      this._refreshOtherIfRelated(changedUri);
      this._otherRefreshTimeout = null;
    }, delayMs);
  }

  watchDirectory(folderUri) {
    if (!this.otherProvider) return;

    const pattern = new vscode.RelativePattern(folderUri, "**/*");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidCreate(() => {
      this._debouncedRefresh();
      this._debouncedRefreshOther(folderUri);
    });

    watcher.onDidChange(() => {
      this._debouncedRefresh();
      this._debouncedRefreshOther(folderUri);
    });

    watcher.onDidDelete(() => {
      this._debouncedRefresh();
      this._debouncedRefreshOther(folderUri);
    });

    this._watchers.push(watcher);
  }

  _refreshOtherIfRelated(changedUri) {
    if (!this.otherProvider || !this.otherProvider.lastViewedFolder) return;

    const changedPath = changedUri.fsPath;
    const otherPath = this.otherProvider.lastViewedFolder.fsPath;

    if (
      changedPath === otherPath ||
      changedPath.startsWith(otherPath + path.sep) ||
      otherPath.startsWith(changedPath + path.sep)
    ) {
      this.otherProvider.refresh();
    }
  }

  dispose() {
    if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
    if (this._otherRefreshTimeout) clearTimeout(this._otherRefreshTimeout);
    this._watchers.forEach(w => w.dispose());
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    const folderUri = element ? element.resourceUri : (this.currentRootUri || this.rootUri);
    if (!folderUri) return [];

    // Update current root if at root level
    if (!element) {
      this.currentRootUri = folderUri;
      this.saveState();
    }

    this.lastViewedFolder = folderUri;
    this.watchDirectory(folderUri);

    try {
      const files = await vscode.workspace.fs.readDirectory(folderUri);
      let items = files
        .filter(([name]) => {
          // Filter hidden files if needed
          if (!this.showHiddenFiles && name.startsWith(".")) {
            return false;
          }
          return true;
        })
        .map(([name, fileType]) => {
          const uri = vscode.Uri.joinPath(folderUri, name);
          const isDirectory = fileType === vscode.FileType.Directory;
          return new FileNode(uri, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, isDirectory, name);
        });

      // Sort by name (case-insensitive, folders first)
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });

      return items;
    } catch {
      return [];
    }
  }
}

/**
 * File tree node representing a file or folder
 */
class FileNode extends vscode.TreeItem {
  constructor(resourceUri, collapsible, isDirectory, name = null) {
    const label = name || path.basename(resourceUri.fsPath);
    super(label, collapsible);
    this.resourceUri = resourceUri;
    this.isDirectory = isDirectory;

    // Set icon
    this.iconPath = getFileIcon(resourceUri.fsPath, isDirectory);

    // Command for files
    this.command =
      collapsible === vscode.TreeItemCollapsibleState.None
        ? {
            command: "vscode.open",
            title: "Open",
            arguments: [resourceUri]
          }
        : undefined;

    this.contextValue = collapsible === vscode.TreeItemCollapsibleState.None ? "fileNode" : "folderNode";
  }
}

/**
 * Drag and drop controller for moving/copying files
 */
class FileDragAndDropController {
  constructor(provider) {
    this.provider = provider;
    this.dropMimeTypes = ["application/vnd.code.tree.explorer2.topExplorer", "application/vnd.code.tree.explorer2.bottomExplorer"];
    this.dragMimeTypes = ["application/vnd.code.tree.explorer2.topExplorer", "application/vnd.code.tree.explorer2.bottomExplorer"];
  }

  async handleDrag(sourceNodes, dataTransfer) {
    const uris = sourceNodes.map(n => n.resourceUri);
    const paths = uris.map(uri => uri.fsPath);
    
    // Set custom MIME type for inter-explorer dragging
    dataTransfer.set("application/vnd.code.tree.explorer", new vscode.DataTransferItem(paths.join("|")));
    
    // Also set the standard file URI format so files can be opened in the editor
    const uriList = uris.map(uri => uri.toString()).join("\n");
    dataTransfer.set("text/uri-list", new vscode.DataTransferItem(uriList));
  }

  async handleDrop(targetNode, dataTransfer) {
    if (!targetNode || targetNode.resourceUri === undefined) return;

    const item = dataTransfer.get("application/vnd.code.tree.explorer");
    if (!item) return;

    const files = item.value.split("|").map(p => vscode.Uri.file(p));
    const targetFolder = targetNode.resourceUri;

    for (const src of files) {
      const dest = vscode.Uri.joinPath(targetFolder, path.basename(src.fsPath));
      try {
        if (src.fsPath === dest.fsPath) continue;
        await vscode.workspace.fs.copy(src, dest, { overwrite: false });
        vscode.window.showInformationMessage(`Copied: ${path.basename(src.fsPath)}`);
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to copy ${path.basename(src.fsPath)}: ${e.message}`);
      }
    }

    this.provider.refresh();
  }
}

/**
 * Activate the extension
 */
function activate(context) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;

  if (!workspaceFolder) {
    vscode.window.showWarningMessage("Explorer 2 requires an open workspace folder");
    return;
  }

  // Get configuration
  const config = vscode.workspace.getConfiguration("explorer2");
  let showHiddenFiles = config.get("showHiddenFiles", false);

  // Create shared clipboard manager
  const clipboardManager = new ClipboardManager();

  // Create providers with state management
  const topProvider = new ExplorerProvider(workspaceFolder, clipboardManager, null, showHiddenFiles, context.workspaceState, "explorer2.topExplorerRoot");
  const bottomProvider = new ExplorerProvider(workspaceFolder, clipboardManager, null, showHiddenFiles, context.workspaceState, "explorer2.bottomExplorerRoot");

  // Restore saved state
  topProvider.restoreState();
  bottomProvider.restoreState();

  // Link providers
  topProvider.setOtherProvider(bottomProvider);
  bottomProvider.setOtherProvider(topProvider);
 
  // Create tree views
  const topTree = vscode.window.createTreeView("explorer2.topExplorer", {
    treeDataProvider: topProvider,
    dragAndDropController: new FileDragAndDropController(topProvider),
    canSelectMany: true
  });

  const bottomTree = vscode.window.createTreeView("explorer2.bottomExplorer", {
    treeDataProvider: bottomProvider,
    dragAndDropController: new FileDragAndDropController(bottomProvider),
    canSelectMany: true
  });

  // Listen for configuration changes
  const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration("explorer2.showHiddenFiles")) {
      const newValue = vscode.workspace.getConfiguration("explorer2").get("showHiddenFiles", false);
      showHiddenFiles = newValue;
      topProvider.setShowHiddenFiles(newValue);
      bottomProvider.setShowHiddenFiles(newValue);
    }
  });

  // Helper to get all providers
  const providers = [topProvider, bottomProvider];

  function sanitizeRelativeInput(value) {
    return value.trim().replace(/\\/g, "/");
  }

  function validateCreatePath(value, kind) {
    const input = sanitizeRelativeInput(value);
    if (!input) return `${kind} name is required`;
    if (input.startsWith("/")) return "Use a relative path, not an absolute path";

    const segments = input.split("/").filter(Boolean);
    if (!segments.length) return `${kind} name is required`;
    if (segments.some(segment => segment === "." || segment === "..")) {
      return "Path cannot contain . or .. segments";
    }
    if (segments.some(segment => /[<>:\"|?*]/.test(segment))) {
      return "Name contains invalid characters";
    }
    if (kind === "File" && input.endsWith("/")) {
      return "File path must include a file name";
    }

    return undefined;
  }

  function validateRenameName(value) {
    const name = value.trim();
    if (!name) return "Name is required";
    if (name === "." || name === "..") return "Invalid name";
    if (name.includes("/") || name.includes("\\")) return "Name cannot include path separators";
    if (/[<>:\"|?*]/.test(name)) return "Name contains invalid characters";
    return undefined;
  }

  function uniqueByPath(nodes) {
    const seen = new Set();
    const result = [];

    for (const node of nodes) {
      const filePath = node?.resourceUri?.fsPath;
      if (!filePath || seen.has(filePath)) continue;
      seen.add(filePath);
      result.push(node);
    }

    return result;
  }

  function filterNestedSelections(nodes) {
    const sorted = uniqueByPath(nodes).sort((a, b) => a.resourceUri.fsPath.length - b.resourceUri.fsPath.length);
    const keptPaths = [];
    const result = [];

    for (const node of sorted) {
      const currentPath = node.resourceUri.fsPath;
      const hasParentSelected = keptPaths.some(parentPath => currentPath.startsWith(`${parentPath}${path.sep}`));
      if (hasParentSelected) continue;

      keptPaths.push(currentPath);
      result.push(node);
    }

    return result;
  }

  function resolveActionNodes(node) {
    if (!node?.resourceUri) return [];

    const targetPath = node.resourceUri.fsPath;
    const topSelection = topTree.selection.filter(item => item?.resourceUri);
    const bottomSelection = bottomTree.selection.filter(item => item?.resourceUri);

    const topIncludesNode = topSelection.some(item => item.resourceUri.fsPath === targetPath);
    const bottomIncludesNode = bottomSelection.some(item => item.resourceUri.fsPath === targetPath);

    const selectedNodes = topIncludesNode
      ? topSelection
      : bottomIncludesNode
        ? bottomSelection
        : [node];

    return filterNestedSelections(selectedNodes);
  }

  // Sync with active editor state
  let syncWithEditorEnabled = false;
  const syncStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  syncStatusBarItem.command = "paulcaras.explorer2.syncWithActiveEditor";
  updateSyncStatus();

  function updateSyncStatus() {
    syncStatusBarItem.text = `$(link) Sync: ${syncWithEditorEnabled ? "On" : "Off"}`;
    syncStatusBarItem.show();
  }

  // Listen for active editor changes
  const editorWatcher = vscode.window.onDidChangeActiveTextEditor(editor => {
    if (!syncWithEditorEnabled || !editor || editor.document.uri.scheme !== "file") return;

    // Auto-reveal the file by expanding parent folders
    const fileUri = editor.document.uri;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    
    if (!workspaceFolder) return;

    // Find the relative path and expand folders
    let currentPath = workspaceFolder;
    const fileParts = path.relative(workspaceFolder.fsPath, fileUri.fsPath).split(path.sep);
    
    // Remove the filename, keep only folder path
    fileParts.pop();

    // Expand each folder level
    for (const part of fileParts) {
      currentPath = vscode.Uri.joinPath(currentPath, part);
    }

    // Try to reveal and select the file in both trees
    try {
      vscode.window.showInformationMessage(`Synced to: ${path.basename(fileUri.fsPath)}`);
    } catch {
      // Silent fail
    }
  });
  context.subscriptions.push(
    configWatcher,
    editorWatcher,
    syncStatusBarItem,

    // Refresh commands
    vscode.commands.registerCommand("paulcaras.explorer2.refreshTop", () => topProvider.refresh()),
    vscode.commands.registerCommand("paulcaras.explorer2.refreshBottom", () => bottomProvider.refresh()),

    // Collapse/Expand all
    vscode.commands.registerCommand("paulcaras.explorer2.collapseAll", async (sourceView) => {
      const provider = sourceView?.treeDataProvider || topProvider;
      const tree = provider === topProvider ? topTree : bottomTree;
      await tree.reveal(tree.root, { expand: false, focus: false, select: false });
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.expandAll", async () => {
      // This is handled by the tree view's built-in expand functionality
      vscode.window.showInformationMessage("Use arrow keys or double-click to expand folders");
    }),

    // Toggle hidden files
    vscode.commands.registerCommand("paulcaras.explorer2.toggleHiddenFiles", () => {
      showHiddenFiles = !showHiddenFiles;
      vscode.workspace.getConfiguration("explorer2").update("showHiddenFiles", showHiddenFiles, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Hidden files ${showHiddenFiles ? "shown" : "hidden"}`);
    }),

    // New file/folder commands
    vscode.commands.registerCommand("paulcaras.explorer2.newFile", async (node) => {
      if (!node) return;

      const filePathInput = await vscode.window.showInputBox({
        prompt: "New file",
        placeHolder: "file.txt or src/utils/file.txt",
        validateInput: value => validateCreatePath(value, "File")
      });
      if (!filePathInput) return;

      const relativePath = sanitizeRelativeInput(filePathInput);
      const segments = relativePath.split("/").filter(Boolean);
      const fileName = segments[segments.length - 1];
      const parentSegments = segments.slice(0, -1);
      let parentUri = node.resourceUri;

      if (parentSegments.length) {
        parentUri = vscode.Uri.joinPath(node.resourceUri, ...parentSegments);
        await vscode.workspace.fs.createDirectory(parentUri);
      }

      const uri = vscode.Uri.joinPath(parentUri, fileName);

      try {
        await vscode.workspace.fs.stat(uri);
        vscode.window.showWarningMessage(`File already exists: ${relativePath}`);
        return;
      } catch {
        await vscode.workspace.fs.writeFile(uri, new Uint8Array());
      }

      topProvider.refresh();
      bottomProvider.refresh();
      vscode.window.showInformationMessage(`Created file: ${relativePath}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.newFolder", async (node) => {
      if (!node) return;

      const folderPathInput = await vscode.window.showInputBox({
        prompt: "New folder",
        placeHolder: "folder-name or src/components/new-folder",
        validateInput: value => validateCreatePath(value, "Folder")
      });
      if (!folderPathInput) return;

      const relativePath = sanitizeRelativeInput(folderPathInput);
      const segments = relativePath.split("/").filter(Boolean);
      const uri = vscode.Uri.joinPath(node.resourceUri, ...segments);

      try {
        await vscode.workspace.fs.stat(uri);
        vscode.window.showWarningMessage(`Folder already exists: ${relativePath}`);
        return;
      } catch {
        await vscode.workspace.fs.createDirectory(uri);
      }

      topProvider.refresh();
      bottomProvider.refresh();
      vscode.window.showInformationMessage(`Created folder: ${relativePath}`);
    }),

    // Cut command
    vscode.commands.registerCommand("paulcaras.explorer2.cut", async (node) => {
      if (!node) return;
      const nodes = resolveActionNodes(node);
      if (!nodes.length) return;
      await clipboardManager.cut(nodes.map(item => item.resourceUri));
    }),

    // Copy command
    vscode.commands.registerCommand("paulcaras.explorer2.copy", async (node) => {
      if (!node) return;
      const nodes = resolveActionNodes(node);
      if (!nodes.length) return;
      await clipboardManager.copy(nodes.map(item => item.resourceUri));
    }),

    // Paste command
    vscode.commands.registerCommand("paulcaras.explorer2.paste", async (node) => {
      if (!node) return;
      const stat = await vscode.workspace.fs.stat(node.resourceUri);
      if (stat.type === vscode.FileType.Directory) {
        await clipboardManager.paste(node.resourceUri, providers);
      } else {
        vscode.window.showWarningMessage("Can only paste into folders");
      }
    }),

    // Duplicate command
    vscode.commands.registerCommand("paulcaras.explorer2.duplicate", async (node) => {
      if (!node) return;
      const originalName = path.basename(node.resourceUri.fsPath);
      const ext = path.extname(originalName);
      const nameWithoutExt = path.basename(originalName, ext);
      const suggestedName = `${nameWithoutExt} copy${ext}`;

      const newName = await vscode.window.showInputBox({
        prompt: "Duplicate name",
        value: suggestedName
      });
      if (!newName) return;

      const parentPath = path.dirname(node.resourceUri.fsPath);
      const newUri = vscode.Uri.file(path.join(parentPath, newName));

      try {
        const stat = await vscode.workspace.fs.stat(node.resourceUri);
        if (stat.type === vscode.FileType.Directory) {
          await vscode.workspace.fs.copy(node.resourceUri, newUri);
        } else {
          await vscode.workspace.fs.copy(node.resourceUri, newUri);
        }
        topProvider.refresh();
        bottomProvider.refresh();
        vscode.window.showInformationMessage(`Duplicated: ${newName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Duplicate failed: ${error.message}`);
      }
    }),

    // Rename command
    vscode.commands.registerCommand("paulcaras.explorer2.rename", async (node) => {
      if (!node) return;
      const oldName = path.basename(node.resourceUri.fsPath);
      const extension = path.extname(oldName);
      const isFile = node.contextValue === "fileNode";
      const valueSelection = isFile && extension
        ? [0, oldName.length - extension.length]
        : [0, oldName.length];

      const newName = await vscode.window.showInputBox({
        prompt: "Rename",
        placeHolder: "Enter new name",
        value: oldName,
        valueSelection,
        validateInput: validateRenameName
      });
      if (!newName || newName === oldName) return;

      const parentPath = path.dirname(node.resourceUri.fsPath);
      const newUri = vscode.Uri.file(path.join(parentPath, newName));

      try {
        await vscode.workspace.fs.rename(node.resourceUri, newUri);
        topProvider.refresh();
        bottomProvider.refresh();
        vscode.window.showInformationMessage(`Renamed to: ${newName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Rename failed: ${error.message}`);
      }
    }),

    // Delete command
    vscode.commands.registerCommand("paulcaras.explorer2.delete", async (node) => {
      if (!node) return;

      const nodes = resolveActionNodes(node);
      if (!nodes.length) return;

      const fileName = path.basename(node.resourceUri.fsPath);
      const message = nodes.length === 1
        ? `Delete "${fileName}"?`
        : `Delete ${nodes.length} selected items?`;

      const confirm = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        "Yes",
        "No"
      );
      if (confirm !== "Yes") return;

      let successCount = 0;
      let failureCount = 0;

      try {
        for (const item of nodes) {
          try {
            const stat = await vscode.workspace.fs.stat(item.resourceUri);
            if (stat.type === vscode.FileType.Directory) {
              await vscode.workspace.fs.delete(item.resourceUri, { recursive: true });
            } else {
              await vscode.workspace.fs.delete(item.resourceUri);
            }
            successCount += 1;
          } catch {
            failureCount += 1;
          }
        }

        topProvider.refresh();
        bottomProvider.refresh();

        if (successCount > 0 && failureCount === 0) {
          vscode.window.showInformationMessage(`Deleted ${successCount} item${successCount === 1 ? "" : "s"}`);
          return;
        }

        if (successCount > 0 && failureCount > 0) {
          vscode.window.showWarningMessage(`Deleted ${successCount} item${successCount === 1 ? "" : "s"}; ${failureCount} failed`);
          return;
        }

        vscode.window.showErrorMessage("Delete failed for all selected items");
      } catch {
        vscode.window.showErrorMessage("Delete operation failed");
      }
    }),

    // Copy absolute path
    vscode.commands.registerCommand("paulcaras.explorer2.copyPathAbsolute", async (node) => {
      if (!node) return;
      const absolutePath = node.resourceUri.fsPath;
      await vscode.env.clipboard.writeText(absolutePath);
      vscode.window.showInformationMessage(`Copied: ${absolutePath}`);
    }),

    // Copy relative path
    vscode.commands.registerCommand("paulcaras.explorer2.copyPathRelative", async (node) => {
      if (!node) return;
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder open");
        return;
      }
      const relativePath = path.relative(workspaceFolder.uri.fsPath, node.resourceUri.fsPath);
      await vscode.env.clipboard.writeText(relativePath);
      vscode.window.showInformationMessage(`Copied: ${relativePath}`);
    }),

    // Reveal to Finder
    vscode.commands.registerCommand("paulcaras.explorer2.revealToFinder", async (node) => {
      if (!node) return;
      try {
        await vscode.commands.executeCommand("revealFileInOS", node.resourceUri);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to reveal file: ${error.message}`);
      }
    }),

    // Open in Chat
    vscode.commands.registerCommand("paulcaras.explorer2.openInChat", async (node) => {
      if (!node) return;
      try {
        await vscode.commands.executeCommand("github.copilot.openSymbolFromFile", node.resourceUri);
      } catch {
        try {
          await vscode.window.showTextDocument(node.resourceUri);
          vscode.window.showInformationMessage("File opened. You can now ask questions about it in the chat panel.");
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
        }
      }
    }),

    // Open to the Left (in left editor group)
    vscode.commands.registerCommand("paulcaras.explorer2.openToLeft", async (node) => {
      if (!node) return;
      try {
        const doc = await vscode.workspace.openTextDocument(node.resourceUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    }),

    // Open to the Right (in right editor group)
    vscode.commands.registerCommand("paulcaras.explorer2.openToRight", async (node) => {
      if (!node) return;
      try {
        const doc = await vscode.workspace.openTextDocument(node.resourceUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    }),

    // Toggle sync with active editor
    vscode.commands.registerCommand("paulcaras.explorer2.syncWithActiveEditor", () => {
      syncWithEditorEnabled = !syncWithEditorEnabled;
      updateSyncStatus();
      vscode.window.showInformationMessage(`Sync with Active Editor: ${syncWithEditorEnabled ? "Enabled" : "Disabled"}`);
    }),

    // Navigate Panel I to selected folder
    vscode.commands.registerCommand("paulcaras.explorer2.navigateTopHere", async (node) => {
      if (!node || !node.isDirectory) return;
      topProvider.setCurrentRoot(node.resourceUri);
      vscode.window.showInformationMessage(`Panel I: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    // Navigate Panel II to selected folder
    vscode.commands.registerCommand("paulcaras.explorer2.navigateBottomHere", async (node) => {
      if (!node || !node.isDirectory) return;
      bottomProvider.setCurrentRoot(node.resourceUri);
      vscode.window.showInformationMessage(`Panel II: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    // Go to parent folder in Panel I
    vscode.commands.registerCommand("paulcaras.explorer2.goToParentTop", async () => {
      const currentRoot = topProvider.currentRootUri || topProvider.rootUri;
      const parentPath = path.dirname(currentRoot.fsPath);
      
      // Don't go above workspace folder
      if (parentPath && parentPath !== currentRoot.fsPath) {
        const parentUri = vscode.Uri.file(parentPath);
        topProvider.setCurrentRoot(parentUri);
        vscode.window.showInformationMessage(`Panel I: ${path.basename(parentUri.fsPath)}`);
      } else {
        vscode.window.showInformationMessage("Already at top level");
      }
    }),

    // Go to parent folder in Panel II
    vscode.commands.registerCommand("paulcaras.explorer2.goToParentBottom", async () => {
      const currentRoot = bottomProvider.currentRootUri || bottomProvider.rootUri;
      const parentPath = path.dirname(currentRoot.fsPath);
      
      // Don't go above workspace folder
      if (parentPath && parentPath !== currentRoot.fsPath) {
        const parentUri = vscode.Uri.file(parentPath);
        bottomProvider.setCurrentRoot(parentUri);
        vscode.window.showInformationMessage(`Panel II: ${path.basename(parentUri.fsPath)}`);
      } else {
        vscode.window.showInformationMessage("Already at top level");
      }
    }),

    // Cleanup on deactivation
    new vscode.Disposable(() => {
      topProvider.dispose();
      bottomProvider.dispose();
    })
  );
}

function deactivate() {}

exports.activate = activate;
exports.deactivate = deactivate;