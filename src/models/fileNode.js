const vscode = require("vscode");
const path = require("path");
const { getFileIcon } = require("../utils/icon");

class FileNode extends vscode.TreeItem {
  constructor(resourceUri, collapsible, isDirectory, name = null, sourcePanel = null) {
    const label = name || path.basename(resourceUri.fsPath);
    super(label, collapsible);
    this.resourceUri = resourceUri;
    this.id = resourceUri.fsPath;
    this.isDirectory = isDirectory;
    this.sourcePanel = sourcePanel;

    this.iconPath = getFileIcon(resourceUri.fsPath, isDirectory);

    this.command =
      collapsible === vscode.TreeItemCollapsibleState.None
        ? {
            command: "paulcaras.explorer2.openFile",
            title: "Open",
            arguments: [resourceUri, this.sourcePanel]
          }
        : undefined;

    this.contextValue =
      collapsible === vscode.TreeItemCollapsibleState.None ? "fileNode" : "folderNode";
  }
}

module.exports = FileNode;