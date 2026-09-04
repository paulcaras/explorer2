const vscode = require("vscode");
const path = require("path");

function registerClipboardCommands(
  context,
  {
    clipboardManager,
    resolveActionNodes,
    getCurrentSelection,
    getSelectionForPanel,
    getProviderByKey,
    topProvider,
    activePanelKey,
    providers
  }
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("paulcaras.explorer2.cut", async (node) => {
      const nodes = node ? resolveActionNodes(node) : getCurrentSelection();
      if (!nodes.length) {
        vscode.window.showWarningMessage("No files or folders selected");
        return;
      }
      await clipboardManager.cut(nodes.map((item) => item.resourceUri));
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.copy", async (node) => {
      const nodes = node ? resolveActionNodes(node) : getCurrentSelection();
      if (!nodes.length) {
        vscode.window.showWarningMessage("No files or folders selected");
        return;
      }
      await clipboardManager.copy(nodes.map((item) => item.resourceUri));
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.paste", async (node) => {
      if (!topProvider) return;
      let targetFolder = null;

      if (node) {
        const stat = await vscode.workspace.fs.stat(node.resourceUri);
        if (stat.type === vscode.FileType.Directory) {
          targetFolder = node.resourceUri;
        } else {
          const parentPath = path.dirname(node.resourceUri.fsPath);
          targetFolder = vscode.Uri.file(parentPath);
        }
      } else {
        const selection = getSelectionForPanel(activePanelKey.value);

        if (selection.length > 0) {
          const selectedNode = selection[0];
          const stat = await vscode.workspace.fs.stat(selectedNode.resourceUri);

          if (stat.type === vscode.FileType.Directory) {
            targetFolder = selectedNode.resourceUri;
          } else {
            const parentPath = path.dirname(selectedNode.resourceUri.fsPath);
            targetFolder = vscode.Uri.file(parentPath);
          }
        } else {
          const activeProvider = getProviderByKey(activePanelKey.value) || topProvider;
          targetFolder = activeProvider.currentRootUri || activeProvider.rootUri;
        }
      }

      if (!targetFolder) {
        vscode.window.showWarningMessage("Cannot determine target folder");
        return;
      }

      await clipboardManager.paste(targetFolder, providers());
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.pasteToRootTop", async () => {
      if (!topProvider) return;
      const targetFolder = topProvider.currentRootUri || topProvider.rootUri;
      if (targetFolder) {
        await clipboardManager.paste(targetFolder, providers());
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.pasteToRootBottom", async (node) => {
      const bottomProvider = providers().find((p) => p !== topProvider);
      if (!bottomProvider) return;
      const targetFolder = bottomProvider.currentRootUri || bottomProvider.rootUri;
      if (targetFolder) {
        await clipboardManager.paste(targetFolder, providers());
      }
    })
  );
}

module.exports = { registerClipboardCommands };