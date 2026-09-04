const vscode = require("vscode");
const path = require("path");

class FileDragAndDropController {
  constructor(provider) {
    this.provider = provider;
    this.dropMimeTypes = [
      "application/vnd.code.tree.explorer2.topExplorer",
      "application/vnd.code.tree.explorer2.bottomExplorer"
    ];
    this.dragMimeTypes = [
      "application/vnd.code.tree.explorer2.topExplorer",
      "application/vnd.code.tree.explorer2.bottomExplorer"
    ];
  }

  async handleDrag(sourceNodes, dataTransfer) {
    const uris = sourceNodes.map((n) => n.resourceUri);
    const paths = uris.map((uri) => uri.fsPath);

    dataTransfer.set(
      "application/vnd.code.tree.explorer",
      new vscode.DataTransferItem(paths.join("|"))
    );

    const uriList = uris.map((uri) => uri.toString()).join("\n");
    dataTransfer.set("text/uri-list", new vscode.DataTransferItem(uriList));
  }

  async handleDrop(targetNode, dataTransfer) {
    if (!targetNode || targetNode.resourceUri === undefined) return;

    const item = dataTransfer.get("application/vnd.code.tree.explorer");
    if (!item) return;

    const files = item.value.split("|").map((p) => vscode.Uri.file(p));
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

module.exports = FileDragAndDropController;