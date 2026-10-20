import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getWebviewLocalization } from './localization';
import { createDefaultProject, hasProjectBeenCreated } from './types';
import { getCurrentWorkspaceFolder, loadProjectConfig, projectWizard, saveProjectConfig } from './projectConfig';

const getNonce = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return nonce;
};

export class ControlCentrePanel {
  private static instance: ControlCentrePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly extensionPath: string;
  private disposables: vscode.Disposable[] = [];

  public static get currentPanel(): ControlCentrePanel | undefined {
    return ControlCentrePanel.instance;
  }

  public postMessage(message: any): void {
    if (this.panel.webview) {
      this.panel.webview.postMessage(message);
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.extensionPath = extensionUri.fsPath;
    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.disposables.push(
      vscode.window.onDidChangeActiveColorTheme(theme => {
        this.postTheme(theme.kind);
      })
    );
    this.disposables.push(
      this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message))
    );
  }

  public static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (ControlCentrePanel.instance) {
      ControlCentrePanel.instance.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'elementorBuilderControlCentre',
      'Elementor Builder Control Centre',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
      }
    );

    ControlCentrePanel.instance = new ControlCentrePanel(panel, context.extensionUri);
  }

  public dispose() {
    ControlCentrePanel.instance = undefined;

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      try {
        disposable?.dispose();
      } catch {
        // ignore
      }
    }

    this.panel.dispose();
  }

  private update() {
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'controlCentreView.js')
    );
    const initialTheme = this.getThemeMode(vscode.window.activeColorTheme.kind);
    const localizedStrings = JSON.stringify(getWebviewLocalization());
    const project = loadProjectConfig();
    const resolvedWorkspace = getCurrentWorkspaceFolder();
    const workspaceFolderName = resolvedWorkspace?.name ?? vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace folder';
    const hasProject = projectWizard();
    const projectName = hasProject ? project.projectName : '';
    const projectSettings = hasProject ? project.projectSettings : createDefaultProject().projectSettings;

    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'unsafe-inline' https:`,
      `font-src ${webview.cspSource} https: data:`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource} https:`
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Elementor Builder Control Centre</title>
  <style>
    html, body {
      padding: 0;
      margin: 0;
      height: 100%;
      width: 100%;
      background-color: var(--vscode-editor-background, #1f1f1f);
      color: var(--vscode-editor-foreground, #d4d4d4);
      font-family: "Segoe UI", sans-serif;
    }

    #root {
      height: 100%;
      width: 100%;
    }

    .fallback-shell {
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      padding: 24px;
      background: var(--vscode-editor-background, #1f1f1f);
      color: var(--vscode-editor-foreground, #d4d4d4);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .fallback-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
      padding-bottom: 12px;
      font-weight: 600;
    }

    .fallback-panel {
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 12px;
      background: var(--vscode-sideBar-background, #252526);
      padding: 18px;
    }

    .fallback-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .fallback-box {
      border: 1px solid var(--vscode-panel-border, #3c3c3c);
      border-radius: 10px;
      padding: 12px;
      background: rgba(255,255,255,0.02);
    }
  </style>
</head>
<body>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" />
  <div id="root">
    <div class="fallback-shell">
      <div class="fallback-header">
        <span>Elementor Builder Control Centre</span>
        <span>Ready</span>
      </div>
      <div class="fallback-grid">
        <div class="fallback-panel">
          <h3 style="margin:0 0 8px 0;">Project</h3>
          <p style="margin:0; color: var(--vscode-descriptionForeground, #9d9d9d);">Configure the builder metadata, widget groups, and generated Elementor component setup.</p>
        </div>
        <div class="fallback-panel">
          <h3 style="margin:0 0 8px 0;">Controls</h3>
          <p style="margin:0; color: var(--vscode-descriptionForeground, #9d9d9d);">Add responsive widgets, content controls, and advanced styling controls.</p>
        </div>
      </div>
      <div class="fallback-box">
        The Control Centre is loading the interactive builder view...
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    window.__elementorBuilderInitialState = {
      theme: '${initialTheme}',
      hasProject: ${hasProject},
      projectName: ${JSON.stringify(projectName)},
      workspaceFolderName: ${JSON.stringify(workspaceFolderName)},
      widgetCount: ${project.widgets.length ?? 0},
      project: ${JSON.stringify(project)},
      projectSettings: ${JSON.stringify(projectSettings)}
    };
    window.__elementorBuilderVsCodeApi = vscodeApi;
    window.__elementorBuilderL10n = ${localizedStrings};
    window.__elementorBuilderAppMounted = false;
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
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
    if (!this.panel.webview) {
      return;
    }
    this.panel.webview.postMessage({
      type: 'theme',
      theme: this.getThemeMode(kind)
    });
  }

  private async handleMessage(rawMessage: unknown) {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return;
    }

    const message = rawMessage as { type?: string; payload?: unknown; state?: unknown };
    if (message.type === 'delete-widget-category') {
      await this.handleDeleteWidgetCategory(message.payload);
      return;
    }

    if (message.type === 'save-project') {
      await this.handleSaveProject(message.state ?? message.payload);
      return;
    }

    if (message.type === 'save-control-definition') {
      await this.handleSaveControlDefinition(message.payload);
      return;
    }

    if (message.type === 'save-dynamic-tag-definition') {
      await this.handleSaveDynamicTagDefinition(message.payload);
      return;
    }

    if (message.type === 'save-form-action-definition') {
      await this.handleSaveFormActionDefinition(message.payload);
      return;
    }

    if (message.type === 'save-form-field-definition') {
      await this.handleSaveFormFieldDefinition(message.payload);
      return;
    }

    if (message.type === 'save-theme-condition-definition') {
      await this.handleSaveThemeConditionDefinition(message.payload);
      return;
    }

    if (message.type === 'save-theme-location-definition') {
      await this.handleSaveThemeLocationDefinition(message.payload);
      return;
    }

    if (message.type === 'save-finder-category-definition') {
      await this.handleSaveFinderCategoryDefinition(message.payload);
      return;
    }

    if (message.type === 'select-image-file') {
      await this.handleSelectImageFile(message.payload);
    }
  }

  private async handleSelectImageFile(payload: unknown) {
    try {
      const request = typeof payload === 'object' && payload !== null ? payload as { optionId?: string } : undefined;
      const workspaceFolder = getCurrentWorkspaceFolder();
      const defaultFolder = workspaceFolder?.uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;

      const file = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri: defaultFolder,
        openLabel: 'Select image',
        filters: {
          Images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
        }
      });

      if (!file || file.length === 0) {
        return;
      }

      const selectedUri = file[0];
      const resolvedPath = workspaceFolder
        ? path.relative(workspaceFolder.uri.fsPath, selectedUri.fsPath)
        : selectedUri.fsPath;

      this.panel.webview.postMessage({
        type: 'image-file-selected',
        optionId: request?.optionId ?? null,
        value: resolvedPath.replace(/\\/g, '/')
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The image file could not be selected.';
      console.error('[Elementor Builder] Image selector failed.', error);
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleDeleteWidgetCategory(payload: unknown) {
    try {
      const request = typeof payload === 'object' && payload !== null ? payload as {
        categoryId?: string;
        deleteWidgets?: boolean;
        removedWidgets?: Array<{ name?: string; title?: string }>;
      } : undefined;

      if (!request?.deleteWidgets || !request.categoryId || !Array.isArray(request.removedWidgets) || request.removedWidgets.length === 0) {
        return;
      }

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        return;
      }

      const widgetDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder', 'widgets');
      if (!fs.existsSync(widgetDir)) {
        return;
      }

      for (const widget of request.removedWidgets) {
        const widgetName = (widget.name ?? widget.title ?? '').trim();
        if (!widgetName) {
          continue;
        }

        const filePath = path.join(widgetDir, `${widgetName}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The widget category delete action could not finish.';
      console.error('[Elementor Builder] Widget category files could not be deleted.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveProject(payload: unknown) {
    try {
      const project = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : undefined;

      if (!project || typeof project !== 'object') {
        const messageText = 'No project data was provided for the wizard save action.';
        console.error('[Elementor Builder] save-project message did not include project state.', { payload });
        this.panel.webview.postMessage({ type: 'save-error', error: messageText });
        vscode.window.showErrorMessage(messageText);
        return;
      }

      const workspaceFolder = getCurrentWorkspaceFolder();
      const configPath = saveProjectConfig(project as any, workspaceFolder);
      console.log('[Elementor Builder] Saved project config from wizard.', { configPath });
      this.panel.webview.postMessage({ type: 'saved', configPath });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Project could not be saved.';
      console.error('[Elementor Builder] Wizard project save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveControlDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        controlName?: string;
        operation?: 'add' | 'remove';
        controlData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving control definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const controlName = (message.controlName ?? '').trim();
      if (!controlName) {
        return;
      }

      const fileName = `${controlName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_control'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.controlData) {
        fs.writeFileSync(filePath, JSON.stringify(message.controlData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The control definition could not be saved.';
      console.error('[Elementor Builder] Control definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveDynamicTagDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        dynamicTagName?: string;
        operation?: 'add' | 'remove';
        dynamicTagData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving dynamic tag definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const dynamicTagName = (message.dynamicTagName ?? '').trim();
      if (!dynamicTagName) {
        return;
      }

      const fileName = `${dynamicTagName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'dynamic_tag'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.dynamicTagData) {
        fs.writeFileSync(filePath, JSON.stringify(message.dynamicTagData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The dynamic tag definition could not be saved.';
      console.error('[Elementor Builder] Dynamic tag definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveFormActionDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        formActionName?: string;
        formActionData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving form action definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const formActionName = (message.formActionName ?? '').trim();
      if (!formActionName) {
        return;
      }

      const fileName = `${formActionName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'form_action'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.formActionData) {
        fs.writeFileSync(filePath, JSON.stringify(message.formActionData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The form action definition could not be saved.';
      console.error('[Elementor Builder] Form action definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveFormFieldDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        formFieldName?: string;
        operation?: 'add' | 'remove';
        formFieldData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving form field definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const formFieldName = (message.formFieldName ?? '').trim();
      if (!formFieldName) {
        return;
      }

      const fileName = `${formFieldName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'form_field'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.formFieldData) {
        fs.writeFileSync(filePath, JSON.stringify(message.formFieldData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The form field definition could not be saved.';
      console.error('[Elementor Builder] Form field definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveThemeConditionDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        themeConditionName?: string;
        operation?: 'add' | 'remove';
        themeConditionData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving theme condition definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const themeConditionName = (message.themeConditionName ?? '').trim();
      if (!themeConditionName) {
        return;
      }

      const fileName = `${themeConditionName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'theme_condition'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.themeConditionData) {
        fs.writeFileSync(filePath, JSON.stringify(message.themeConditionData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The theme condition definition could not be saved.';
      console.error('[Elementor Builder] Theme condition definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveThemeLocationDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        themeLocationName?: string;
        operation?: 'add' | 'remove';
        themeLocationData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving theme location definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const themeLocationName = (message.themeLocationName ?? '').trim();
      if (!themeLocationName) {
        return;
      }

      const fileName = `${themeLocationName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'theme_location'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.themeLocationData) {
        fs.writeFileSync(filePath, JSON.stringify(message.themeLocationData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The theme location definition could not be saved.';
      console.error('[Elementor Builder] Theme location definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }

  private async handleSaveFinderCategoryDefinition(payload: unknown) {
    try {
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const message = payload as {
        project?: Record<string, unknown>;
        finderCategoryName?: string;
        operation?: 'add' | 'remove';
        finderCategoryData?: Record<string, unknown> | null;
      };

      const workspaceFolder = getCurrentWorkspaceFolder();
      if (!workspaceFolder) {
        throw new Error('Open a workspace folder before saving finder category definitions.');
      }

      const projectDir = path.join(workspaceFolder.uri.fsPath, '.elementor-builder');
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      const finderCategoryName = (message.finderCategoryName ?? '').trim();
      if (!finderCategoryName) {
        return;
      }

      const fileName = `${finderCategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'finder_category'}.json`;
      const filePath = path.join(projectDir, fileName);

      if (message.operation === 'remove') {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } else if (message.finderCategoryData) {
        fs.writeFileSync(filePath, JSON.stringify(message.finderCategoryData, null, 2));
      }

      if (message.project) {
        saveProjectConfig(message.project as any, workspaceFolder);
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'The finder category definition could not be saved.';
      console.error('[Elementor Builder] Finder category definition save failed.', error);
      this.panel.webview.postMessage({ type: 'save-error', error: messageText });
      vscode.window.showErrorMessage(messageText);
    }
  }
}
