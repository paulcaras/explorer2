const { sanitizeRelativeInput } = require("./path");

function validateCreatePath(value, kind) {
  const input = sanitizeRelativeInput(value);
  if (!input) return `${kind} name is required`;
  if (input.startsWith("/")) return "Use a relative path, not an absolute path";

  const segments = input.split("/").filter(Boolean);
  if (!segments.length) return `${kind} name is required`;
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return "Path cannot contain . or .. segments";
  }
  if (segments.some((segment) => /[<>:\"|?*]/.test(segment))) {
    return "Name contains invalid characters";
  }
  if (kind === "File" && input.endsWith("/")) {
    return "File path must include a file name";
  }

  return undefined;
}

function validateRenameName(value) {
  const name = value.trim();
  if (!name) return "Name is required";
  if (name === "." || name === "..") return "Invalid name";
  if (name.includes("/") || name.includes("\\")) return "Name cannot include path separators";
  if (/[<>:\"|?*]/.test(name)) return "Name contains invalid characters";
  return undefined;
}

module.exports = {
  validateCreatePath,
  validateRenameName
};