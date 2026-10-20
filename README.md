# Elementor Builder

A VS Code extension for scaffolding and managing Elementor widget projects in a local workspace.

## Overview

Elementor Builder gives you a project-focused workflow for creating Elementor widget plugin scaffolds, configuring namespaces, enabling feature modules, and organizing widget groups and controls in a structured UI.

The extension is designed around a setup wizard that only creates the project configuration after the user completes the required project metadata and namespace setup.

## Features

- Fluent UI sidebar with a Control Centre navigation
- Guided setup wizard for project name, version, namespace, feature flags, and namespace review
- Project defaults remain blank and disabled until the setup wizard is completed
- Manage widget groups and widget entries inside the project workspace
- Define Elementor-compatible control types and control metadata
- Enable project features such as PSR-4, Finder, controls, dynamic tags, theme conditions, theme locations, form fields, form actions, and context menus
- Save project state in a hidden workspace folder as `.elementor-builder/eb-project-*.json`
- Open the project configuration directly from the extension UI

## Setup workflow

1. Open the activity bar view or run the command palette command for the builder.
2. If no project has been created yet, use the setup wizard from the sidebar.
3. Complete the welcome, project details, project settings, namespace setup, and review screens.
4. Create the project to generate the project config file.
5. Manage widget groups and widgets from the builder UI.

## Project storage

The extension stores project configuration in a hidden workspace folder:

- `.elementor-builder/`
- Example file: `.elementor-builder/eb-project-my-plugin.json`

The config file is created only after the setup wizard completes successfully.

## Commands

The extension contributes the following commands:

- `Elementor Builder: Open Sidebar`
- `Elementor Builder: Setup Workspace`
- `Elementor Builder: Open Workspace Project`
- `Elementor Builder: Open Control Centre`
- `Elementor Builder: Add Group`
- `Elementor Builder: Add Widget`

## Requirements

- VS Code 1.138+
- Node.js and npm

## Development

Install dependencies and run the project in development mode:

```powershell
npm install
npm run watch
```

Run the extension test suite:

```powershell
npm test
```

## Notes

This extension is intended for rapid Elementor widget and plugin scaffold creation inside VS Code, with project setup intentionally gated until the user completes the wizard flow.
