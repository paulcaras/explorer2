const vscode = require("vscode");
const path = require("path");

function registerPanelCommands(
  context,
  {
    topProvider,
    bottomProvider,
    topTree,
    bottomTree,
    updateTreeViewTitles,
    setPanelRoot,
    openFolderForPanel,
    resetPanelToWorkspaceRoot
  }
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("paulcaras.explorer2.refreshTop", () => topProvider?.refresh()),
    vscode.commands.registerCommand("paulcaras.explorer2.refreshBottom", () => bottomProvider?.refresh()),

    vscode.commands.registerCommand("paulcaras.explorer2.openRootTop", async () => {
      await openFolderForPanel(topProvider, "Panel I");
    }),
    vscode.commands.registerCommand("paulcaras.explorer2.openRootBottom", async () => {
      await openFolderForPanel(bottomProvider, "Panel II");
    }),
    vscode.commands.registerCommand("paulcaras.explorer2.resetRootTop", async () => {
      await resetPanelToWorkspaceRoot(topProvider, "Panel I");
    }),
    vscode.commands.registerCommand("paulcaras.explorer2.resetRootBottom", async () => {
      await resetPanelToWorkspaceRoot(bottomProvider, "Panel II");
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.collapseAll", async (sourceView) => {
      if (!topProvider) return;
      const provider = sourceView?.treeDataProvider || topProvider;
      const tree = provider === topProvider ? topTree : bottomTree;
      await tree?.reveal(tree.root, { expand: false, focus: false, select: false });
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.expandAll", async () => {
      vscode.window.showInformationMessage("Use arrow keys or double-click to expand folders");
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.toggleHiddenFilesTop", async () => {
      if (!topProvider) return;
      const nextValue = !topProvider.showHiddenFiles;
      topProvider.setShowHiddenFiles(nextValue);
      vscode.window.showInformationMessage(`Panel I hidden files ${nextValue ? "shown" : "hidden"}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.toggleHiddenFilesBottom", async () => {
      if (!bottomProvider) return;
      const nextValue = !bottomProvider.showHiddenFiles;
      bottomProvider.setShowHiddenFiles(nextValue);
      vscode.window.showInformationMessage(`Panel II hidden files ${nextValue ? "shown" : "hidden"}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.navigateTopHere", async (node) => {
      if (!topProvider || !node || !node.isDirectory) return;
      topProvider.setCurrentRoot(node.resourceUri);
      updateTreeViewTitles();
      vscode.window.showInformationMessage(`Panel I navigated to: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.setRootTopHere", async (node) => {
      if (!topProvider || !node || !node.isDirectory) return;
      topProvider.setBoundaryRoot(node.resourceUri);
      updateTreeViewTitles();
      vscode.window.showInformationMessage(`Panel I boundary root set to: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.navigateBottomHere", async (node) => {
      if (!bottomProvider || !node || !node.isDirectory) return;
      bottomProvider.setCurrentRoot(node.resourceUri);
      updateTreeViewTitles();
      vscode.window.showInformationMessage(`Panel II navigated to: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.setRootBottomHere", async (node) => {
      if (!bottomProvider || !node || !node.isDirectory) return;
      bottomProvider.setBoundaryRoot(node.resourceUri);
      updateTreeViewTitles();
      vscode.window.showInformationMessage(`Panel II boundary root set to: ${path.basename(node.resourceUri.fsPath)}`);
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.goToParentTop", async () => {
      if (!topProvider) return;
      const currentRoot = topProvider.currentRootUri || topProvider.rootUri;
      const parentPath = path.dirname(currentRoot.fsPath);

      if (parentPath && parentPath !== currentRoot.fsPath) {
        const parentUri = vscode.Uri.file(parentPath);
        topProvider.setCurrentRoot(parentUri);
        vscode.window.showInformationMessage(`Panel I: ${path.basename(parentUri.fsPath)}`);
      } else {
        vscode.window.showInformationMessage("Already at top level");
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.goToParentBottom", async () => {
      if (!bottomProvider) return;
      const currentRoot = bottomProvider.currentRootUri || bottomProvider.rootUri;
      const parentPath = path.dirname(currentRoot.fsPath);

      if (parentPath && parentPath !== currentRoot.fsPath) {
        const parentUri = vscode.Uri.file(parentPath);
        bottomProvider.setCurrentRoot(parentUri);
        vscode.window.showInformationMessage(`Panel II: ${path.basename(parentUri.fsPath)}`);
      } else {
        vscode.window.showInformationMessage("Already at top level");
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.revealCurrentRootTop", async () => {
      if (!topProvider) return;
      const currentRoot = topProvider.currentRootUri || topProvider.rootUri;
      if (currentRoot) {
        try {
          await vscode.commands.executeCommand("revealFileInOS", currentRoot);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to reveal folder: ${error.message}`);
        }
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.revealCurrentRootBottom", async () => {
      if (!bottomProvider) return;
      const currentRoot = bottomProvider.currentRootUri || bottomProvider.rootUri;
      if (currentRoot) {
        try {
          await vscode.commands.executeCommand("revealFileInOS", currentRoot);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to reveal folder: ${error.message}`);
        }
      }
    })
  );
}

module.exports = { registerPanelCommands };