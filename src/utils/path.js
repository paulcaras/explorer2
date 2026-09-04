const path = require("path");

function isPathUnderRoot(fileUri, rootUri) {
  if (!fileUri || !rootUri) return false;

  const filePath = path.normalize(fileUri.fsPath);
  const rootPath = path.normalize(rootUri.fsPath);

  if (filePath === rootPath) return true;

  const relative = path.relative(rootPath, filePath);
  return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function sanitizeRelativeInput(value) {
  return value.trim().replace(/\\/g, "/");
}

function uniqueByPath(nodes) {
  const seen = new Set();
  const result = [];

  for (const node of nodes) {
    const filePath = node?.resourceUri?.fsPath;
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    result.push(node);
  }

  return result;
}

function filterNestedSelections(nodes) {
  const sorted = uniqueByPath(nodes).sort(
    (a, b) => a.resourceUri.fsPath.length - b.resourceUri.fsPath.length
  );
  const keptPaths = [];
  const result = [];

  for (const node of sorted) {
    const currentPath = node.resourceUri.fsPath;
    const hasParentSelected = keptPaths.some((parentPath) =>
      currentPath.startsWith(`${parentPath}${path.sep}`)
    );
    if (hasParentSelected) continue;

    keptPaths.push(currentPath);
    result.push(node);
  }

  return result;
}

module.exports = {
  isPathUnderRoot,
  sanitizeRelativeInput,
  uniqueByPath,
  filterNestedSelections
};