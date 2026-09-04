const vscode = require("vscode");
const path = require("path");

const FileNode = require("./src/models/fileNode");
const ClipboardManager = require("./src/services/clipboardManager");
const FileDragAndDropController = require("./src/controllers/dragAndDropController");
const ExplorerProvider = require("./src/providers/explorerProvider");

const { filterNestedSelections } = require("./src/utils/path");
const { registerFileCommands } = require("./src/commands/fileCommands");
const { registerClipboardCommands } = require("./src/commands/clipboardCommands");
const { registerPanelCommands } = require("./src/commands/panelCommands");
const { setupEditorSync } = require("./src/commands/editorSync");

function activate(context) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  const config = vscode.workspace.getConfiguration("explorer2");
  let showHiddenFiles = config.get("showHiddenFiles", false);

  const clipboardManager = new ClipboardManager();

  const topProvider = new ExplorerProvider(
    workspaceFolder || null,
    clipboardManager,
    null,
    showHiddenFiles,
    context.workspaceState,
    "explorer2.topExplorerRoot"
  );
  const bottomProvider = new ExplorerProvider(
    workspaceFolder || null,
    clipboardManager,
    null,
    showHiddenFiles,
    context.workspaceState,
    "explorer2.bottomExplorerRoot"
  );

  topProvider.restoreState();
  bottomProvider.restoreState();

  topProvider.setOtherProvider(bottomProvider);
  bottomProvider.setOtherProvider(topProvider);

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

  function getPanelTitle(baseTitle, provider) {
    const currentRoot = provider.currentRootUri;
    if (!currentRoot) return baseTitle;

    const defaultRoot = provider.rootUri?.fsPath;
    if (defaultRoot && currentRoot.fsPath === defaultRoot) return baseTitle;

    return `${baseTitle}: ${path.basename(currentRoot.fsPath)}/`;
  }

  function updateTreeViewTitles() {
    if (topTree) topTree.title = getPanelTitle("Panel I", topProvider);
    if (bottomTree) bottomTree.title = getPanelTitle("Panel II", bottomProvider);
  }

  updateTreeViewTitles();

  if (!workspaceFolder && !topProvider.currentRootUri && !bottomProvider.currentRootUri) {
    vscode.window.showWarningMessage(
      "Explorer 2 has no workspace folder. Use Open Folder in each panel to start."
    );
  }

  const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("explorer2.showHiddenFiles")) {
      const newValue = vscode.workspace.getConfiguration("explorer2").get("showHiddenFiles", false);
      showHiddenFiles = newValue;
      if (topProvider) topProvider.setShowHiddenFiles(newValue);
      if (bottomProvider) bottomProvider.setShowHiddenFiles(newValue);
    }
  });

  const TOP_PANEL_KEY = "explorer2.topExplorerRoot";
  const BOTTOM_PANEL_KEY = "explorer2.bottomExplorerRoot";
  const activePanelKey = { value: TOP_PANEL_KEY };

  function getProviderByKey(key) {
    if (key === TOP_PANEL_KEY) return topProvider;
    if (key === BOTTOM_PANEL_KEY) return bottomProvider;
    return null;
  }

  function getSelectionForPanel(panelKey) {
    if (panelKey === TOP_PANEL_KEY) {
      return (topTree?.selection ?? []).filter((item) => item?.resourceUri);
    }
    if (panelKey === BOTTOM_PANEL_KEY) {
      return (bottomTree?.selection ?? []).filter((item) => item?.resourceUri);
    }
    return [];
  }

  function setActivePanel(panelKey) {
    if (panelKey === TOP_PANEL_KEY || panelKey === BOTTOM_PANEL_KEY) {
      activePanelKey.value = panelKey;
    }
  }

  function getProviderFromNode(node) {
    if (node?.sourcePanel) {
      setActivePanel(node.sourcePanel);
      const p = getProviderByKey(node.sourcePanel);
      if (p) return p;
    }

    const targetPath = node?.resourceUri?.fsPath;
    if (!targetPath) return null;

    if (topTree?.selection.some((item) => item?.resourceUri?.fsPath === targetPath)) {
      setActivePanel(TOP_PANEL_KEY);
      return topProvider;
    }

    if (bottomTree?.selection.some((item) => item?.resourceUri?.fsPath === targetPath)) {
      setActivePanel(BOTTOM_PANEL_KEY);
      return bottomProvider;
    }

    return null;
  }

  const { jumpToActiveEditor, revealFileInProvider } = setupEditorSync(context, {
    topProvider,
    bottomProvider,
    topTree,
    bottomTree
  });

  async function setPanelRoot(provider, rootUri) {
    if (!provider || !rootUri) return;
    provider.setCurrentRoot(rootUri);
    updateTreeViewTitles();

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor?.document.uri.scheme === "file") {
      const tree = provider === topProvider ? topTree : bottomTree;
      await revealFileInProvider(provider, tree, activeEditor.document.uri);
    }
  }

  async function openFolderForPanel(provider, panelLabel) {
    const selected = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: `Open in ${panelLabel}`
    });

    const target = selected?.[0];
    if (!target) return false;

    await setPanelRoot(provider, target);
    vscode.window.showInformationMessage(`${panelLabel}: ${path.basename(target.fsPath)}`);
    return true;
  }

  async function resetPanelToWorkspaceRoot(provider, panelLabel) {
    const currentWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (currentWorkspaceRoot) {
      await setPanelRoot(provider, currentWorkspaceRoot);
      vscode.window.showInformationMessage(`${panelLabel} reset to workspace root`);
      return;
    }

    await openFolderForPanel(provider, panelLabel);
  }

  async function safeStat(uri) {
    if (!uri) return null;
    try {
      return await vscode.workspace.fs.stat(uri);
    } catch {
      return null;
    }
  }

  async function restoreProviderTreeState(provider) {
    const tree = provider === topProvider ? topTree : bottomTree;
    if (!tree || !provider.currentRootUri) return;

    const rootStat = await safeStat(provider.currentRootUri);
    if (!rootStat || rootStat.type !== vscode.FileType.Directory) {
      provider.currentRootUri = provider.rootUri;
      provider.loadTreeStateForCurrentRoot();
      provider.saveState();
      provider.refresh();
      return;
    }

    provider.refresh();

    const expandedPaths = Array.from(provider.expandedPaths).sort((a, b) => a.length - b.length);
    for (const expandedPath of expandedPaths) {
      try {
        const folderUri = vscode.Uri.file(expandedPath);
        const stat = await safeStat(folderUri);
        if (!stat || stat.type !== vscode.FileType.Directory) continue;

        await tree.reveal(
          new FileNode(folderUri, vscode.TreeItemCollapsibleState.Collapsed, true, null, provider.stateKey),
          { expand: true, focus: false, select: false }
        );
      } catch {
        // Best effort restoration
      }
    }

    const lastFileUri = provider.getLastOpenedFileUri();
    if (!lastFileUri) return;

    const lastFileStat = await safeStat(lastFileUri);
    if (!lastFileStat || lastFileStat.type !== vscode.FileType.File) return;

    try {
      const parentPath = path.dirname(lastFileUri.fsPath);
      if (parentPath.startsWith(provider.currentRootUri.fsPath)) {
        const relativeDir = path.relative(provider.currentRootUri.fsPath, parentPath);
        const parts = relativeDir ? relativeDir.split(path.sep).filter(Boolean) : [];
        let currentUri = provider.currentRootUri;

        for (const part of parts) {
          currentUri = vscode.Uri.joinPath(currentUri, part);
          provider.trackExpand(currentUri);
          await tree.reveal(
            new FileNode(currentUri, vscode.TreeItemCollapsibleState.Collapsed, true, null, provider.stateKey),
            { expand: true, focus: false, select: false }
          );
        }

        await tree.reveal(
          new FileNode(lastFileUri, vscode.TreeItemCollapsibleState.None, false, null, provider.stateKey),
          { focus: false, select: true }
        );
      }
    } catch {
      // Best effort restoration
    }
  }

  function getCurrentSelection() {
    const activeSelection = getSelectionForPanel(activePanelKey.value);
    if (activeSelection.length > 0) return activeSelection;

    const otherPanelKey = activePanelKey.value === TOP_PANEL_KEY ? BOTTOM_PANEL_KEY : TOP_PANEL_KEY;
    const fallbackSelection = getSelectionForPanel(otherPanelKey);
    if (fallbackSelection.length > 0) return fallbackSelection;

    return [];
  }

  function resolveActionNodes(node) {
    if (!node?.resourceUri) return [];

    if (node.sourcePanel) {
      setActivePanel(node.sourcePanel);
    }

    const targetPath = node.resourceUri.fsPath;
    const topSelection = getSelectionForPanel(TOP_PANEL_KEY);
    const bottomSelection = getSelectionForPanel(BOTTOM_PANEL_KEY);

    const topIncludesNode = topSelection.some((item) => item.resourceUri.fsPath === targetPath);
    const bottomIncludesNode = bottomSelection.some((item) => item.resourceUri.fsPath === targetPath);

    const selectedNodes = topIncludesNode
      ? topSelection
      : bottomIncludesNode
      ? bottomSelection
      : [node];

    return filterNestedSelections(selectedNodes);
  }

  const providers = () => [topProvider, bottomProvider].filter(Boolean);

  if (topTree && bottomTree) {
    context.subscriptions.push(
      configWatcher,
      topTree.onDidChangeSelection(() => setActivePanel(TOP_PANEL_KEY)),
      bottomTree.onDidChangeSelection(() => setActivePanel(BOTTOM_PANEL_KEY)),
      topTree.onDidChangeVisibility((event) => {
        if (event.visible) void jumpToActiveEditor();
      }),
      bottomTree.onDidChangeVisibility((event) => {
        if (event.visible) void jumpToActiveEditor();
      }),
      topTree.onDidExpandElement((e) => topProvider.trackExpand(e.element.resourceUri)),
      topTree.onDidCollapseElement((e) => topProvider.trackCollapse(e.element.resourceUri)),
      bottomTree.onDidExpandElement((e) => bottomProvider.trackExpand(e.element.resourceUri)),
      bottomTree.onDidCollapseElement((e) => bottomProvider.trackCollapse(e.element.resourceUri)),
      new vscode.Disposable(() => {
        topProvider.saveTreeStateForCurrentRoot();
        bottomProvider.saveTreeStateForCurrentRoot();
        topProvider.saveState();
        bottomProvider.saveState();
        topProvider.dispose();
        bottomProvider.dispose();
      })
    );
  }

  registerFileCommands(context, {
    topProvider,
    bottomProvider,
    topTree,
    bottomTree,
    getProviderFromNode,
    resolveActionNodes
  });

  registerClipboardCommands(context, {
    clipboardManager,
    resolveActionNodes,
    getCurrentSelection,
    getSelectionForPanel,
    getProviderByKey,
    topProvider,
    activePanelKey,
    providers
  });

  registerPanelCommands(context, {
    topProvider,
    bottomProvider,
    topTree,
    bottomTree,
    updateTreeViewTitles,
    setPanelRoot,
    openFolderForPanel,
    resetPanelToWorkspaceRoot
  });

  if (topProvider && bottomProvider) {
    void Promise.all([restoreProviderTreeState(topProvider), restoreProviderTreeState(bottomProvider)]).then(
      () => jumpToActiveEditor()
    );
    updateTreeViewTitles();
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};