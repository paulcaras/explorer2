# Change Log

All notable changes to the "Explorer 2" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased] - 2026-03-05

### Added
- Panel-level actions in both explorer headers: `Paste Here` and `Reveal Current Folder in Finder`
- Conflict-safe copy naming on paste: `Name Copy`, `Name Copy 2`, and so on for files and folders
- Explorer-aware open command that preserves focus in Explorer 2 when opening files from the tree
- Persistent tree state tracking for each panel root: expanded folders and last opened file

### Changed
- Copy, cut, and paste commands now work from keyboard shortcuts and context menus using current Explorer 2 selection
- Paste target resolution now supports both file and folder selections
- New file and new folder commands now support creating items from the current panel root when no node is selected
- Tree item file-open behavior now routes through `paulcaras.explorer2.openFile` for state tracking and focus-safe open

### Fixed
- Fixed copy/paste failures when pasting into the same directory as the source item
- Fixed paste failures caused by destination name collisions by auto-generating an available copy name
- Fixed shortcut flow where opening a file from Explorer 2 moved focus away and prevented Explorer 2 keybindings from triggering

## [1.0.0] - 2026-02-28

### Added
- Dual independent file explorers with "Panel I" and "Panel II" views
- Complete file operations: create, delete, rename, cut, copy, paste, duplicate
- Drag and drop support between explorers
- Show/hide hidden files toggle
- Collapse/expand all functionality
- Navigate to parent folder capability
- Sync with active editor feature
- Reveal in Finder (macOS) integration
- Open in Chat integration
- Copy absolute and relative paths
- Open to left/right split editor panes
- File system watchers for auto-refresh
- Context-aware file icons based on file type
- Alphabetical sorting with folders first
- Persistent state restoration on reload
- Comprehensive keyboard shortcuts (F2 rename, Delete remove, Cmd+C/X/V copy/cut/paste)
- Configurable settings for hidden files, exclude patterns, and sort order