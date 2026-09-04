const vscode = require("vscode");
const path = require("path");

class ClipboardManager {
  constructor() {
    this.clipboard = null;
    this.mode = null; // 'copy' or 'cut'
  }

  async _pathExists(uri) {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  _buildCopyName(originalName, isDirectory, index) {
    if (isDirectory) {
      return index === 1
        ? `${originalName} Copy`
        : `${originalName} Copy ${index}`;
    }

    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    return index === 1
      ? `${base} Copy${ext}`
      : `${base} Copy ${index}${ext}`;
  }

  async _findAvailableCopyDestination(targetUri, originalName, isDirectory) {
    for (let index = 1; index < 10000; index += 1) {
      const candidateName = this._buildCopyName(originalName, isDirectory, index);
      const candidateUri = vscode.Uri.joinPath(targetUri, candidateName);
      if (!(await this._pathExists(candidateUri))) {
        return candidateUri;
      }
    }

    throw new Error("Could not generate a unique destination name");
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
    const action = this.mode === "cut" ? "Moved" : "Copied";
    let successCount = 0;
    let failureCount = 0;

    for (const sourceUri of sourceUris) {
      const fileName = path.basename(sourceUri.fsPath);
      let destUri = vscode.Uri.joinPath(targetUri, fileName);

      try {
        const sourceStat = await vscode.workspace.fs.stat(sourceUri);

        if (this.mode === "copy") {
          const destinationExists = await this._pathExists(destUri);
          if (sourceUri.fsPath === destUri.fsPath || destinationExists) {
            destUri = await this._findAvailableCopyDestination(
              targetUri,
              fileName,
              sourceStat.type === vscode.FileType.Directory
            );
          }
        }

        if (this.mode === "cut" && sourceUri.fsPath === destUri.fsPath) {
          failureCount += 1;
          continue;
        }

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

    providers.forEach((p) => p.refresh());

    if (successCount > 0 && failureCount === 0) {
      vscode.window.showInformationMessage(
        `${action} ${successCount} item${successCount === 1 ? "" : "s"}`
      );
      return;
    }

    if (successCount > 0 && failureCount > 0) {
      vscode.window.showWarningMessage(
        `${action} ${successCount} item${successCount === 1 ? "" : "s"}; ${failureCount} failed`
      );
      return;
    }

    vscode.window.showErrorMessage("Paste failed for all items");
  }

  clear() {
    this.clipboard = null;
    this.mode = null;
  }
}

module.exports = ClipboardManager;