const vscode = require("vscode");
const fs = require("fs").promises; // <-- use async fs
const path = require("path");

class FileNode extends vscode.TreeItem {
  constructor(filePath, collapsible) {
    super(path.basename(filePath), collapsible);
    this.filePath = filePath;
    this.resourceUri = vscode.Uri.file(filePath);
    this.contextValue = "fileNode";

    this.command = {
      command: "vscode.open",
      title: "Open",
      arguments: [this.resourceUri]
    };
  }
}

class FileTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.rootPath = null; // locked folder
  }

  setRoot(path) {
    this.rootPath = path;
    this.refresh();
  }

  unlock() {
    this.rootPath = null;
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(node) {
    return node;
  }

  // Async lazy loading
  async getChildren(node) {
    const base =
      node?.filePath ||
      this.rootPath ||
      (vscode.workspace.workspaceFolders?.[0]?.uri.fsPath);

    if (!base) return [];

    try {
      const names = await fs.readdir(base);
      const items = [];

      for (const name of names) {
        try {
          const full = path.join(base, name);
          const stat = await fs.stat(full);

          // Collapse directories, none for files
          const collapsible = stat.isDirectory()
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

          items.push(new FileNode(full, collapsible));
        } catch (e) {
          // skip unreadable files
          console.error("Error reading file", name, e);
        }
      }

      return items;
    } catch (e) {
      console.error("Error reading folder", base, e);
      return [];
    }
  }
}

module.exports = { FileTreeProvider, FileNode };