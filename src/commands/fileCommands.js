const vscode = require("vscode");
const path = require("path");
const { sanitizeRelativeInput } = require("../utils/path");
const { validateCreatePath, validateRenameName } = require("../utils/validation");

function registerFileCommands(
  context,
  { topProvider, bottomProvider, topTree, bottomTree, getProviderFromNode, resolveActionNodes }
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("paulcaras.explorer2.openFile", async (uri, sourcePanel) => {
      if (!uri) return;
      const provider = sourcePanel === topProvider.stateKey ? topProvider : bottomProvider;
      if (provider) {
        provider.setLastOpenedFile(uri);
      }

      await vscode.commands.executeCommand("vscode.open", uri, {
        preserveFocus: true,
        preview: false
      });
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.newFile", async (node) => {
      if (!topProvider) return;
      let targetFolder = null;

      if (node) {
        targetFolder = node.resourceUri;
      } else {
        const topFocused = topTree?.visible;
        const bottomFocused = bottomTree?.visible;

        if (topFocused) {
          targetFolder = topProvider.currentRootUri || topProvider.rootUri;
        } else if (bottomFocused) {
          targetFolder = bottomProvider.currentRootUri || bottomProvider.rootUri;
        } else {
          targetFolder = topProvider.currentRootUri || topProvider.rootUri;
        }
      }

      if (!targetFolder) {
        vscode.window.showWarningMessage("Cannot determine target folder");
        return;
      }

      const filePathInput = await vscode.window.showInputBox({
        prompt: "New file",
        placeHolder: "file.txt or src/utils/file.txt",
        validateInput: (value) => validateCreatePath(value, "File")
      });
      if (!filePathInput) return;

      const relativePath = sanitizeRelativeInput(filePathInput);
      const segments = relativePath.split("/").filter(Boolean);
      const fileName = segments[segments.length - 1];
      const parentSegments = segments.slice(0, -1);
      let parentUri = targetFolder;

      if (parentSegments.length) {
        parentUri = vscode.Uri.joinPath(targetFolder, ...parentSegments);
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
      if (!topProvider) return;
      let targetFolder = null;

      if (node) {
        targetFolder = node.resourceUri;
      } else {
        const topFocused = topTree?.visible;
        const bottomFocused = bottomTree?.visible;

        if (topFocused) {
          targetFolder = topProvider.currentRootUri || topProvider.rootUri;
        } else if (bottomFocused) {
          targetFolder = bottomProvider.currentRootUri || bottomProvider.rootUri;
        } else {
          targetFolder = topProvider.currentRootUri || topProvider.rootUri;
        }
      }

      if (!targetFolder) {
        vscode.window.showWarningMessage("Cannot determine target folder");
        return;
      }

      const folderPathInput = await vscode.window.showInputBox({
        prompt: "New folder",
        placeHolder: "folder-name or src/components/new-folder",
        validateInput: (value) => validateCreatePath(value, "Folder")
      });
      if (!folderPathInput) return;

      const relativePath = sanitizeRelativeInput(folderPathInput);
      const segments = relativePath.split("/").filter(Boolean);
      const uri = vscode.Uri.joinPath(targetFolder, ...segments);

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

    vscode.commands.registerCommand("paulcaras.explorer2.duplicate", async (node) => {
      if (!topProvider) return;
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

    vscode.commands.registerCommand("paulcaras.explorer2.rename", async (node) => {
      if (!topProvider) return;
      if (!node) return;
      const oldName = path.basename(node.resourceUri.fsPath);
      const extension = path.extname(oldName);
      const isFile = node.contextValue === "fileNode";
      const valueSelection =
        isFile && extension
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

    vscode.commands.registerCommand("paulcaras.explorer2.delete", async (node) => {
      if (!topProvider) return;
      if (!node) return;

      const nodes = resolveActionNodes(node);
      if (!nodes.length) return;

      const fileName = path.basename(node.resourceUri.fsPath);
      const message =
        nodes.length === 1
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

    vscode.commands.registerCommand("paulcaras.explorer2.copyPathAbsolute", async (node) => {
      if (!node) return;
      const absolutePath = node.resourceUri.fsPath;
      await vscode.env.clipboard.writeText(absolutePath);
      vscode.window.showInformationMessage(`Copied: ${absolutePath}`);
    }),

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

    vscode.commands.registerCommand("paulcaras.explorer2.revealToFinder", async (node) => {
      if (!node) return;
      try {
        await vscode.commands.executeCommand("revealFileInOS", node.resourceUri);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to reveal file: ${error.message}`);
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.openInChat", async (node) => {
      if (!node) return;
      const provider = getProviderFromNode(node);
      if (provider && node.resourceUri) {
        provider.setLastOpenedFile(node.resourceUri);
      }
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

    vscode.commands.registerCommand("paulcaras.explorer2.openToLeft", async (node) => {
      if (!node) return;
      const provider = getProviderFromNode(node);
      if (provider && node.resourceUri) {
        provider.setLastOpenedFile(node.resourceUri);
      }
      try {
        const doc = await vscode.workspace.openTextDocument(node.resourceUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    }),

    vscode.commands.registerCommand("paulcaras.explorer2.openToRight", async (node) => {
      if (!node) return;
      const provider = getProviderFromNode(node);
      if (provider && node.resourceUri) {
        provider.setLastOpenedFile(node.resourceUri);
      }
      try {
        const doc = await vscode.workspace.openTextDocument(node.resourceUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
      }
    })
  );
}

module.exports = { registerFileCommands };