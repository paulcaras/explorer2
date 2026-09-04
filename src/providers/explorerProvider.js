const vscode = require("vscode");
const path = require("path");
const FileNode = require("../models/fileNode");
const { isPathUnderRoot } = require("../utils/path");

class ExplorerProvider {
  constructor(
    rootUri,
    clipboardManager,
    otherProvider = null,
    showHiddenFiles = false,
    stateManager = null,
    stateKey = null
  ) {
    this.rootUri = rootUri;
    this.boundaryRootUri = null;
    this.currentRootUri = null;
    this.clipboardManager = clipboardManager;
    this.otherProvider = otherProvider;
    this.showHiddenFiles = showHiddenFiles;
    this.stateManager = stateManager;
    this.stateKey = stateKey;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this._watchers = [];
    this.collapsedState = new Set();
    this._refreshTimeout = null;
    this._otherRefreshTimeout = null;
    this.expandedPaths = new Set();
    this.treeStates = {};
    this.lastOpenedFilePath = null;
    this.nodeCache = new Map();
  }

  setBoundaryRoot(uri) {
    this.boundaryRootUri = uri;
    this.currentRootUri = uri;
    this.loadTreeStateForCurrentRoot();
    this.saveState();
    this.refresh();
  }

  setCurrentRoot(uri) {
    this.currentRootUri = uri;
    this.loadTreeStateForCurrentRoot();
    this.saveState();
    this.refresh();
  }

  setOtherProvider(other) {
    this.otherProvider = other;
  }

  setShowHiddenFiles(show) {
    this.showHiddenFiles = show;
    this.saveState();
    this.refresh();
  }

  refresh() {
    this.nodeCache.clear();
    this._onDidChangeTreeData.fire();
  }

  saveState() {
    if (this.stateManager && this.stateKey) {
      const payload = {
        boundaryPath: this.boundaryRootUri?.fsPath || this.rootUri?.fsPath || null,
        rootPath: this.currentRootUri?.fsPath || this.rootUri?.fsPath || null,
        lastOpenedFilePath: this.lastOpenedFilePath || null,
        treeStates: this.treeStates || {},
        showHiddenFiles: this.showHiddenFiles
      };
      this.stateManager.update(this.stateKey, payload);
    }
  }

  restoreState() {
    if (this.stateManager && this.stateKey) {
      const savedState = this.stateManager.get(this.stateKey);
      const savedBoundary = typeof savedState === "object" ? savedState?.boundaryPath : null;
      const savedPath = typeof savedState === "string" ? savedState : savedState?.rootPath;

      this.lastOpenedFilePath = typeof savedState === "object" ? savedState?.lastOpenedFilePath || null : null;
      this.treeStates = typeof savedState === "object" && savedState?.treeStates ? savedState.treeStates : {};
      this.showHiddenFiles =
        typeof savedState === "object" && typeof savedState?.showHiddenFiles === "boolean"
          ? savedState.showHiddenFiles
          : this.showHiddenFiles;

      try {
        this.boundaryRootUri = savedBoundary ? vscode.Uri.file(savedBoundary) : this.rootUri;
        this.currentRootUri = savedPath ? vscode.Uri.file(savedPath) : this.boundaryRootUri;
      } catch {
        this.boundaryRootUri = this.rootUri;
        this.currentRootUri = this.rootUri;
      }
    } else {
      this.boundaryRootUri = this.rootUri;
      this.currentRootUri = this.rootUri;
    }

    this.loadTreeStateForCurrentRoot();
  }

  loadTreeStateForCurrentRoot() {
    const rootPath = this.currentRootUri?.fsPath;
    const rootState = rootPath ? this.treeStates[rootPath] : null;
    const expanded = rootState?.expandedPaths;

    this.expandedPaths = new Set(Array.isArray(expanded) ? expanded : []);
  }

  saveTreeStateForCurrentRoot() {
    const rootPath = this.currentRootUri?.fsPath;
    if (!rootPath) return;

    if (!this.treeStates) {
      this.treeStates = {};
    }

    this.treeStates[rootPath] = {
      expandedPaths: Array.from(this.expandedPaths)
    };
  }

  trackExpand(uri) {
    if (!uri?.fsPath) return;
    this.expandedPaths.add(uri.fsPath);
    this.saveTreeStateForCurrentRoot();
    this.saveState();
  }

  trackCollapse(uri) {
    if (!uri?.fsPath) return;
    this.expandedPaths.delete(uri.fsPath);
    this.saveTreeStateForCurrentRoot();
    this.saveState();
  }

  isPathExpanded(uri) {
    if (!uri?.fsPath) return false;
    return this.expandedPaths.has(uri.fsPath);
  }

  setLastOpenedFile(uri) {
    this.lastOpenedFilePath = uri?.fsPath || null;
    this.saveState();
  }

  getLastOpenedFileUri() {
    if (!this.lastOpenedFilePath) return null;
    try {
      return vscode.Uri.file(this.lastOpenedFilePath);
    } catch {
      return null;
    }
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
    this._watchers.forEach((w) => w.dispose());
  }

  getTreeItem(element) {
    return element;
  }

  async getParent(element) {
    if (!element?.resourceUri) return null;

    const activeRoot = this.currentRootUri || this.boundaryRootUri || this.rootUri;
    if (!activeRoot) return null;

    if (element.resourceUri.fsPath === activeRoot.fsPath) {
      return null;
    }

    const parentPath = path.dirname(element.resourceUri.fsPath);
    if (!parentPath || parentPath === element.resourceUri.fsPath) return null;

    const boundary = this.boundaryRootUri || this.rootUri;
    if (boundary && !isPathUnderRoot(vscode.Uri.file(parentPath), boundary)) {
      return null;
    }

    return new FileNode(
      vscode.Uri.file(parentPath),
      vscode.TreeItemCollapsibleState.Collapsed,
      true,
      path.basename(parentPath),
      this.stateKey
    );
  }

  async getChildren(element) {
    const folderUri = element
      ? element.resourceUri
      : this.currentRootUri || this.boundaryRootUri || this.rootUri;
    if (!folderUri) return [];

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
          if (!this.showHiddenFiles && name.startsWith(".")) return false;
          return true;
        })
        .map(([name, fileType]) => {
          const uri = vscode.Uri.joinPath(folderUri, name);
          const isDirectory = fileType === vscode.FileType.Directory;
          const collapsibleState = isDirectory
            ? this.isPathExpanded(uri)
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

          const cached = this.nodeCache.get(uri.fsPath);
          if (cached && cached.collapsibleState === collapsibleState) {
            return cached;
          }

          const node = new FileNode(uri, collapsibleState, isDirectory, name, this.stateKey);
          this.nodeCache.set(uri.fsPath, node);
          return node;
        });

      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });

      return items;
    } catch {
      return [];
    }
  }
}

module.exports = ExplorerProvider;