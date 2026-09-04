const vscode = require("vscode");

function getFileIcon(filePath, isDirectory) {
  void filePath;
  return isDirectory ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
}

module.exports = { getFileIcon };