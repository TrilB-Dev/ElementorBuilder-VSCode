import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createDefaultWidget, hasProjectBeenCreated, makeWidgetGroup } from './types';
import { getCurrentWorkspaceFolder, getProjectRootFileName, loadProjectConfig, projectWizard, saveProjectConfig } from './projectConfig';
import { localize } from './localization';

export async function handleSidebarWebviewMessage(message: unknown, webviewView: vscode.WebviewView): Promise<void> {
  if (!message || typeof message !== 'object') {
    return;
  }

  const typedMessage = message as { command?: string; type?: string; state?: unknown; payload?: unknown; project?: unknown; workspaceFolderName?: string };
  const action = typedMessage.command ?? typedMessage.type;

  switch (action) {
    case 'getSetupStatus': {
      webviewView.webview.postMessage({
        type: 'elementorBuilder.setSetupWizardCompleted',
        payload: { completed: projectWizard() }
      });
      return;
    }
    case 'save-project': {
      const project = typedMessage.state ?? typedMessage.payload ?? typedMessage.project;
      if (!project || typeof project !== 'object') {
        const messageText = 'No project data was provided for the wizard save action.';
        console.error('[Elementor Builder] save-project message did not include project state.', { message });
        webviewView.webview.postMessage({ type: 'save-error', error: messageText });
        vscode.window.showErrorMessage(messageText);
        return;
      }

      try {
        const workspaceFolder = getCurrentWorkspaceFolder(undefined, typedMessage.workspaceFolderName);
        const configPath = saveProjectConfig(project as any, workspaceFolder, typedMessage.workspaceFolderName);
        console.log('[Elementor Builder] Saved project config from sidebar webview.', { configPath, workspaceFolderName: typedMessage.workspaceFolderName });
        webviewView.webview.postMessage({ type: 'saved', configPath });
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Project could not be saved.';
        console.error('[Elementor Builder] Sidebar project save failed.', error);
        webviewView.webview.postMessage({ type: 'save-error', error: messageText });
        vscode.window.showErrorMessage(messageText);
      }
      return;
    }
    case 'openControlCentre':
      await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.openControlCentre');
      return;
    case 'openProjectFile': {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const projectDir = workspaceFolder
        ? path.join(workspaceFolder.uri.fsPath, '.elementor-builder')
        : path.join(process.cwd(), '.elementor-builder');

      if (!fs.existsSync(projectDir)) {
        vscode.window.showInformationMessage(localize('noProjectCreated'));
        return;
      }

      const projectFiles = fs.existsSync(projectDir)
        ? fs.readdirSync(projectDir).filter((name) => name.startsWith('eb-project-') && name.endsWith('.json'))
        : [];
      const projectName = loadProjectConfig().projectName || 'project';
      const fallbackProjectName = getProjectRootFileName(projectName);
      const projectPath = projectFiles[0]
        ? path.join(projectDir, projectFiles[0])
        : path.join(projectDir, fallbackProjectName);

      if (!fs.existsSync(projectPath)) {
        vscode.window.showInformationMessage(localize('noProjectCreated'));
        return;
      }

      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(projectPath));
      return;
    }
    case 'setupWorkspace':
      await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.setupWorkspace');
      return;
    case 'openQuickStart':
      return;
    case 'openExamples':
      return;
    default:
      return;
  }
}

class ElementorBuilderMainWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'elementor-builder-main';
  private _webviewView?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('Elementor Builder: resolveWebviewView called for', webviewView.viewType);
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        await handleSidebarWebviewMessage(message, webviewView);
      },
      undefined,
      []
    );

    // Listen for theme changes
    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(theme => {
      this.postTheme(theme.kind);
    });

    // Listen for configuration changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(() => {
      if (this._webviewView) {
        this._webviewView.webview.postMessage({
          type: 'elementorBuilder.setSetupWizardCompleted',
          payload: { completed: projectWizard() }
        });
      }
    });

    webviewView.onDidDispose(() => {
      themeChangeDisposable.dispose();
      configChangeDisposable.dispose();
    });
  }

  private getThemeMode(kind: vscode.ColorThemeKind): 'light' | 'dark' | 'highContrast' {
    switch (kind) {
      case vscode.ColorThemeKind.HighContrast:
      case vscode.ColorThemeKind.HighContrastLight:
        return 'highContrast';
      case vscode.ColorThemeKind.Dark:
        return 'dark';
      case vscode.ColorThemeKind.Light:
      default:
        return 'light';
    }
  }

  private postTheme(kind: vscode.ColorThemeKind) {
    if (!this._webviewView?.webview) {
      return;
    }
    this._webviewView.webview.postMessage({
      type: 'theme',
      theme: this.getThemeMode(kind)
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    console.log('Elementor Builder: generating HTML for webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js'));

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    const initialTheme = this.getThemeMode(vscode.window.activeColorTheme.kind);
    const projectSummary = this.getProjectSummary();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline' https:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Elementor Builder</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" />
      </head>
      <body>
        <div id="root">
          <div style="padding: 20px; color: blue; background: lightgray; font-size: 18px; border: 2px solid red;">
            <h2>LOADING: Webview initialized</h2>
            <p>If you see this, React hasn't mounted yet.</p>
            <p>Check webview developer tools console for errors.</p>
          </div>
        </div>
        <script nonce="${nonce}">
          const vscodeApi = acquireVsCodeApi();
          window.__elementorBuilderInitialState = {
            theme: '${initialTheme}',
            hasProject: ${projectSummary.hasProject},
            projectName: ${JSON.stringify(projectSummary.projectName ?? '')},
            workspaceFolderName: ${JSON.stringify(projectSummary.workspaceFolderName ?? 'No workspace folder')},
            widgetCount: ${projectSummary.widgetCount ?? 0}
          };
          window.__elementorBuilderVsCodeApi = vscodeApi;
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private getProjectSummary(): { hasProject: boolean; projectName?: string; workspaceFolderName?: string; widgetCount: number } {
    try {
      const project = loadProjectConfig();
      const resolvedWorkspace = getCurrentWorkspaceFolder();
      const hasProject = projectWizard();

      if (!hasProject) {
        return {
          hasProject: false,
          workspaceFolderName: resolvedWorkspace?.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace folder',
          widgetCount: 0
        };
      }

      return {
        hasProject: true,
        projectName: project.projectName,
        workspaceFolderName: resolvedWorkspace?.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace folder',
        widgetCount: project.widgets.length
      };
    } catch {
      return {
        hasProject: false,
        workspaceFolderName: vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace folder',
        widgetCount: 0
      };
    }
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

class ElementorBuilderGroupItem extends vscode.TreeItem {
  constructor(public readonly group: { id: string; text: string; slug: string }) {
    super(group.text, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'elementorBuilderGroup';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.command = {
      command: 'trilbdev-elementor-builder-vscode.renameWidgetGroup',
      title: localize('renameWidgetGroup'),
      arguments: [this]
    };
  }
}

class ElementorBuilderWidgetItem extends vscode.TreeItem {
  constructor(public readonly widget: { id: string; name: string; title: string; groupId: string }) {
    super(widget.title || widget.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'elementorBuilderWidget';
    this.iconPath = new vscode.ThemeIcon('symbol-field');
    this.command = {
      command: 'trilbdev-elementor-builder-vscode.renameWidget',
      title: localize('renameWidget'),
      arguments: [this]
    };
  }
}

type ElementorBuilderTreeItem = ElementorBuilderGroupItem | ElementorBuilderWidgetItem;

class ElementorBuilderWidgetTreeProvider implements vscode.TreeDataProvider<ElementorBuilderTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ElementorBuilderTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ElementorBuilderTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ElementorBuilderTreeItem): HTMLElementBuilderTreeItem[] {
    const project = loadProjectConfig();

    if (!element) {
      if (project.widgetGroups.length === 0) {
        return [new ElementorBuilderGroupItem({ id: 'empty', text: 'No widget groups yet', slug: 'empty' })];
      }

      return project.widgetGroups.map((group) => new ElementorBuilderGroupItem(group));
    }

    if (element instanceof ElementorBuilderGroupItem) {
      const groupId = element.group.id;
      return project.widgets
        .filter((widget) => widget.groupId === groupId)
        .map((widget) => new ElementorBuilderWidgetItem(widget));
    }

    return [];
  }
}

type HTMLElementBuilderTreeItem = ElementorBuilderTreeItem;

export const registerElementorBuilderCommandsView = (context: vscode.ExtensionContext) => {
  const projectProvider = new ElementorBuilderWidgetTreeProvider();
  const mainProvider = new ElementorBuilderMainWebviewProvider(context.extensionUri);

  const mainRegistration = vscode.window.registerWebviewViewProvider(ElementorBuilderMainWebviewProvider.viewType, mainProvider);
  const projectRegistration = vscode.window.registerTreeDataProvider('elementor-builder-widgets', projectProvider);
  const projectView = vscode.window.createTreeView('elementor-builder-widgets', {
    treeDataProvider: projectProvider,
    showCollapseAll: true,
    canSelectMany: false
  });

  const refreshProjectCmd = vscode.commands.registerCommand('elementorBuilder.refreshWidgetTree', () => projectProvider.refresh());

  const addWidgetGroupCmd = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.addWidgetGroup', async () => {
    const project = loadProjectConfig();
    const nextGroup = makeWidgetGroup(`Group ${project.widgetGroups.length + 1}`);
    const nextProject = { ...project, widgetGroups: [...project.widgetGroups, nextGroup] };
    saveProjectConfig(nextProject);
    await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.openControlCentre');
    projectProvider.refresh();
  });

  const addWidgetCmd = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.addWidget', async () => {
    const project = loadProjectConfig();
    const targetGroup = project.widgetGroups[0] ?? makeWidgetGroup('Custom');
    const nextWidget = createDefaultWidget(targetGroup.id);
    const nextProject = {
      ...project,
      widgetGroups: project.widgetGroups.length > 0 ? project.widgetGroups : [targetGroup],
      widgets: [...project.widgets, { ...nextWidget, groupId: targetGroup.id }]
    };
    saveProjectConfig(nextProject);
    await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.openControlCentre');
    projectProvider.refresh();
  });

  const openProjectFileCmd = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.openProjectFile', async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const projectDir = workspaceFolder
      ? path.join(workspaceFolder.uri.fsPath, '.elementor-builder')
      : path.join(process.cwd(), '.elementor-builder');
    const projectFiles = fs.existsSync(projectDir)
      ? fs.readdirSync(projectDir).filter((name) => name.startsWith('eb-project-') && name.endsWith('.json'))
      : [];
    const projectPath = projectFiles[0]
      ? path.join(projectDir, projectFiles[0])
      : path.join(projectDir, getProjectRootFileName(loadProjectConfig().projectName || 'project'));

    if (!fs.existsSync(projectPath)) {
      const created = await vscode.window.showInformationMessage(
        'No workspace project has been created yet. Create one now?',
        'Create Project',
        'Cancel'
      );
      if (created === 'Create Project') {
        const project = loadProjectConfig();
        saveProjectConfig(project);
      }
      return;
    }

    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(projectPath));
  });

  const renameWidgetGroupCmd = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.renameWidgetGroup', async (item?: ElementorBuilderGroupItem) => {
    if (!item) {
      return;
    }

    const project = loadProjectConfig();
    const group = project.widgetGroups.find((entry) => entry.id === item.group.id);
    if (!group) {
      return;
    }

    const nextValue = await vscode.window.showInputBox({
      prompt: localize('renameWidgetGroupPrompt'),
      value: group.text,
      placeHolder: localize('groupNamePlaceholder')
    });

    if (nextValue === undefined) {
      return;
    }

    const trimmed = nextValue.trim();
    if (!trimmed) {
      return;
    }

    const updatedProject = {
      ...project,
      widgetGroups: project.widgetGroups.map((entry) => entry.id === group.id
        ? { ...entry, text: trimmed, slug: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'custom' }
        : entry)
    };

    saveProjectConfig(updatedProject);
    projectProvider.refresh();
  });

  const renameWidgetCmd = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.renameWidget', async (item?: ElementorBuilderWidgetItem) => {
    if (!item) {
      return;
    }

    const project = loadProjectConfig();
    const widget = project.widgets.find((entry) => entry.id === item.widget.id);
    if (!widget) {
      return;
    }

    const nextValue = await vscode.window.showInputBox({
      prompt: localize('renameWidgetPrompt'),
      value: widget.title || widget.name,
      placeHolder: localize('widgetNamePlaceholder')
    });

    if (nextValue === undefined) {
      return;
    }

    const trimmed = nextValue.trim();
    if (!trimmed) {
      return;
    }

    const nextName = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || widget.name;
    const nextClassName = trimmed
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('_') || widget.className;

    const updatedProject = {
      ...project,
      widgets: project.widgets.map((entry) => entry.id === widget.id
        ? { ...entry, name: nextName, title: trimmed, className: nextClassName }
        : entry)
    };

    saveProjectConfig(updatedProject);
    projectProvider.refresh();
  });

  context.subscriptions.push(
    mainRegistration,
    projectRegistration,
    projectView,
    refreshProjectCmd,
    addWidgetGroupCmd,
    addWidgetCmd,
    openProjectFileCmd,
    renameWidgetGroupCmd,
    renameWidgetCmd
  );

  return { projectProvider };
};
