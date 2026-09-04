const vscode = require("vscode");
const path = require("path");
const { isPathUnderRoot } = require("../utils/path");

function setupEditorSync(context, { topProvider, bottomProvider, topTree, bottomTree }) {
  const ACTIVE_FILE_JUMP_KEY = "explorer2.activeFileJumpEnabled";
  let activeFileJumpEnabled = context.workspaceState.get(ACTIVE_FILE_JUMP_KEY, true);

  const syncStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  syncStatusBarItem.command = "paulcaras.explorer2.syncWithActiveEditor";

  function updateSyncStatus() {
    syncStatusBarItem.text = `$(link) File Jumper: ${activeFileJumpEnabled ? "Active" : "Inactive"}`;
    syncStatusBarItem.show();
  }

  function setActiveFileJumpEnabled(enabled) {
    activeFileJumpEnabled = enabled;
    context.workspaceState.update(ACTIVE_FILE_JUMP_KEY, enabled);
    updateSyncStatus();
  }

  function getPanelBoundary(provider) {
    return provider.boundaryRootUri || provider.rootUri;
  }

  function chooseProviderForFile(fileUri) {
    const providerCandidates = [];
    const providersToCheck = [
      { provider: topProvider, tree: topTree },
      { provider: bottomProvider, tree: bottomTree }
    ];

    for (const item of providersToCheck) {
      const boundary = getPanelBoundary(item.provider);
      if (boundary && isPathUnderRoot(fileUri, boundary)) {
        providerCandidates.push({
          ...item,
          boundaryLength: boundary.fsPath.length
        });
      }
    }

    if (providerCandidates.length === 0) return [];
    providerCandidates.sort((a, b) => b.boundaryLength - a.boundaryLength);
    return [providerCandidates[0]];
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function revealTreeItem(tree, item, options, retries = 5) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        await tree.reveal(item, options);
        return true;
      } catch {
        if (attempt === retries - 1) return false;
        await delay(100);
      }
    }
    return false;
  }

  async function getTreeItemByPath(provider, parent, targetUri) {
    const children = await provider.getChildren(parent);
    return children.find((child) => child?.resourceUri?.fsPath === targetUri.fsPath) || null;
  }

  async function revealFileInProvider(provider, tree, fileUri) {
    if (!provider || !tree || !fileUri) return false;

    const boundary = getPanelBoundary(provider);
    if (!boundary || !isPathUnderRoot(fileUri, boundary)) return false;

    const currentNav = provider.currentRootUri || boundary;
    if (!isPathUnderRoot(fileUri, currentNav)) {
      provider.setCurrentRoot(boundary);
    }

    const activeRoot = provider.currentRootUri || boundary;
    const relativePath = path.relative(activeRoot.fsPath, fileUri.fsPath);
    const parts = relativePath.split(path.sep).filter(Boolean);
    const folderParts = parts.slice(0, -1);

    let currentUri = activeRoot;
    let parentItem = null;

    for (const part of folderParts) {
      currentUri = vscode.Uri.joinPath(currentUri, part);
      provider.trackExpand(currentUri);

      let folderItem = provider.nodeCache.get(currentUri.fsPath);
      if (!folderItem) {
        folderItem = await getTreeItemByPath(provider, parentItem, currentUri);
      }
      if (!folderItem) return false;

      parentItem = folderItem;
    }

    let fileItem = provider.nodeCache.get(fileUri.fsPath);
    if (!fileItem) {
      fileItem = await getTreeItemByPath(provider, parentItem, fileUri);
    }
    if (!fileItem) return false;

    const fileRevealed = await revealTreeItem(tree, fileItem, { expand: true, focus: false, select: true }, 5);
    if (fileRevealed) {
      provider.setLastOpenedFile(fileUri);
      return true;
    }

    return false;
  }

  function isFileAlreadyRevealed(provider, tree, fileUri) {
    const lastOpenedFile = provider?.getLastOpenedFileUri?.();
    if (lastOpenedFile?.fsPath === fileUri.fsPath) return true;

    return tree?.selection?.some((item) => item?.resourceUri?.fsPath === fileUri.fsPath) || false;
  }

  async function jumpToActiveEditor(editor = vscode.window.activeTextEditor) {
    if (!activeFileJumpEnabled || !editor || editor.document.uri.scheme !== "file") return;

    const fileUri = editor.document.uri;
    const panels = chooseProviderForFile(fileUri);

    if (panels.length === 0) return;

    const targetPanel = panels[0];
    if (targetPanel?.provider && targetPanel?.tree) {
      if (isFileAlreadyRevealed(targetPanel.provider, targetPanel.tree, fileUri)) return;
      await revealFileInProvider(targetPanel.provider, targetPanel.tree, fileUri);
    }
  }

  updateSyncStatus();

  context.subscriptions.push(
    syncStatusBarItem,
    vscode.window.onDidChangeActiveTextEditor(jumpToActiveEditor),
    vscode.commands.registerCommand("paulcaras.explorer2.syncWithActiveEditor", async () => {
      setActiveFileJumpEnabled(!activeFileJumpEnabled);
      const noPanelRoots = !getPanelBoundary(topProvider) && !getPanelBoundary(bottomProvider);
      vscode.window.showInformationMessage(
        `File Jumper: ${activeFileJumpEnabled ? "Active" : "Inactive"}${
          noPanelRoots ? ". No root folder is set for Panel I or Panel II." : ""
        }`
      );

      if (
        activeFileJumpEnabled &&
        vscode.window.activeTextEditor &&
        vscode.window.activeTextEditor.document.uri.scheme === "file"
      ) {
        await jumpToActiveEditor();
      }
    })
  );

  return { jumpToActiveEditor, revealFileInProvider };
}

module.exports = { setupEditorSync };