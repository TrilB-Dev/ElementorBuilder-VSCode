import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { localize } from './localization';
import type { BuilderProject, TabKey, WidgetControl, WidgetSection } from './types';
import { createDefaultProject, createDefaultWidget, hasProjectBeenCreated, makeWidgetGroup } from './types';

export const PROJECT_CONFIG_DIR = '.elementor-builder';

let projectOutputChannel: vscode.OutputChannel | undefined;

export function getProjectOutputChannel(): vscode.OutputChannel {
  if (!projectOutputChannel) {
    projectOutputChannel = vscode.window.createOutputChannel('Elementor Builder');
  }

  return projectOutputChannel;
}

function logProjectOutput(message: string, details?: unknown): void {
  const channel = getProjectOutputChannel();
  channel.appendLine(`[${new Date().toISOString()}] ${message}`);
  if (details !== undefined) {
    channel.appendLine(JSON.stringify(details, null, 2));
  }
}

function sanitizeProjectName(value: string): string {
  const sanitized = (value || 'project').trim();
  return sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^[0-9]+/, '') || 'project';
}

function cleanNamespace(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.endsWith('\\') ? trimmed : `${trimmed}\\`;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function getActiveWorkspaceFileUri(): vscode.Uri | undefined {
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (!activeUri || activeUri.scheme === 'output' || activeUri.scheme === 'vscode-output' || activeUri.scheme === 'extension-output' || activeUri.scheme !== 'file') {
    return undefined;
  }

  return activeUri;
}

export function getProjectRootFileName(projectName?: string): string {
  const safeName = sanitizeProjectName(projectName || 'project');
  return `eb-project-${safeName}.json`;
}

function ensureProjectFolder(baseDir: string): string {
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    logProjectOutput('Created project folder.', { baseDir });
    return baseDir;
  } catch (error) {
    console.error('[Elementor Builder] Failed to create project folder:', {
      baseDir,
      error
    });
    logProjectOutput('Failed to create project folder.', { baseDir, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    logProjectOutput('Wrote project file.', { filePath });
  } catch (error) {
    console.error('[Elementor Builder] Failed to write project file:', {
      filePath,
      error
    });
    logProjectOutput('Failed to write project file.', { filePath, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function failProjectStep(stepName: string, cause: string): never {
  const message = `Project creation failed at ${stepName}: ${cause}`;
  console.error(`[Elementor Builder] ${message}`);
  logProjectOutput(message, { stepName, cause });
  throw new Error(message);
}

function verifyDirectoryExists(dirPath: string, stepName: string): void {
  if (!fs.existsSync(dirPath)) {
    failProjectStep(stepName, `The directory was not created at ${dirPath}.`);
  }
}

function verifyFileExists(filePath: string, stepName: string): void {
  if (!fs.existsSync(filePath)) {
    failProjectStep(stepName, `The file was not created at ${filePath}.`);
  }
}

export function resolveWorkspaceFolderByName(workspaceFolderName?: string): vscode.WorkspaceFolder | undefined {
  if (!workspaceFolderName || !workspaceFolderName.trim()) {
    return undefined;
  }

  const normalizedTarget = workspaceFolderName.trim().toLowerCase();
  const folders = vscode.workspace.workspaceFolders ?? [];

  return folders.find((candidate) => {
    const candidateName = candidate.name.trim().toLowerCase();
    const candidateBase = path.basename(candidate.uri.fsPath).trim().toLowerCase();
    return candidateName === normalizedTarget || candidateBase === normalizedTarget;
  });
}

export function getCurrentWorkspaceFolder(workspaceFolder?: vscode.WorkspaceFolder, workspaceFolderName?: string): vscode.WorkspaceFolder | undefined {
  if (workspaceFolder) {
    return workspaceFolder;
  }

  const namedMatch = resolveWorkspaceFolderByName(workspaceFolderName);
  if (namedMatch) {
    return namedMatch;
  }

  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    const message = 'No workspace folders are open in the current VS Code window. Falling back to the process directory.';
    console.warn(`[Elementor Builder] ${message}`);
    logProjectOutput(message, { workspaceFolders: [] });
    return undefined;
  }

  const activeUri = getActiveWorkspaceFileUri();
  if (activeUri) {
    const detected = vscode.workspace.getWorkspaceFolder(activeUri) ?? folders.find((candidate) => {
      const candidatePath = path.normalize(candidate.uri.fsPath).replace(/[\\/]+$/, '');
      const activePath = path.normalize(activeUri.fsPath).replace(/[\\/]+$/, '');
      return activePath === candidatePath || activePath.startsWith(`${candidatePath}${path.sep}`);
    });

    if (detected) {
      return detected;
    }
  }

  const preferredProjectFolder = findWorkspaceFolderWithProjectConfig(folders);
  if (preferredProjectFolder) {
    return preferredProjectFolder;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  const message = 'Multiple workspace folders are open but no active file can resolve a target folder; defaulting to the first workspace folder in the current window.';
  console.warn(`[Elementor Builder] ${message}`, {
    workspaceFolders: folders.map((candidate) => candidate.uri.fsPath),
    activeFile: activeUri?.fsPath
  });
  logProjectOutput(message, {
    workspaceFolders: folders.map((candidate) => candidate.uri.fsPath),
    activeFile: activeUri?.fsPath
  });
  return folders[0];
}

function detectExistingProjectConfigPath(baseDir: string, projectName?: string): string | undefined {
  if (!fs.existsSync(baseDir)) {
    return undefined;
  }

  const matchingEntries = fs.readdirSync(baseDir)
    .filter((entry) => /^eb-project-.*\.json$/i.test(entry))
    .map((entry) => ({
      name: entry,
      path: path.join(baseDir, entry),
      mtimeMs: fs.statSync(path.join(baseDir, entry)).mtimeMs
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (!matchingEntries.length) {
    return undefined;
  }

  const sanitizedProjectName = projectName ? sanitizeProjectName(projectName) : undefined;
  if (sanitizedProjectName) {
    const preferredMatch = matchingEntries.find((entry) => {
      const baseName = path.basename(entry.name, '.json');
      return baseName === `eb-project-${sanitizedProjectName}`;
    });

    if (preferredMatch) {
      return preferredMatch.path;
    }
  }

  return matchingEntries[0].path;
}

function findWorkspaceFolderWithProjectConfig(folders: readonly vscode.WorkspaceFolder[]): vscode.WorkspaceFolder | undefined {
  for (const folder of folders) {
    const projectDir = path.join(folder.uri.fsPath, PROJECT_CONFIG_DIR);
    if (!fs.existsSync(projectDir)) {
      continue;
    }

    const projectFiles = fs.readdirSync(projectDir).filter((entry) => /^eb-project-.*\.json$/i.test(entry));
    if (projectFiles.length > 0) {
      return folder;
    }
  }

  return undefined;
}

export function projectWizard(workspaceFolder?: vscode.WorkspaceFolder, workspaceFolderName?: string): boolean {
  const resolvedFolder = getCurrentWorkspaceFolder(workspaceFolder, workspaceFolderName);
  const basePath = resolvedFolder?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
  const configDir = path.join(basePath, PROJECT_CONFIG_DIR);

  if (!fs.existsSync(configDir)) {
    return false;
  }

  const projectFiles = fs.readdirSync(configDir)
    .filter((entry) => /^eb-project-.*\.json$/i.test(entry))
    .map((entry) => ({
      name: entry,
      path: path.join(configDir, entry),
      mtimeMs: fs.statSync(path.join(configDir, entry)).mtimeMs
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const entry of projectFiles) {
    try {
      const parsed = JSON.parse(fs.readFileSync(entry.path, 'utf8')) as Record<string, unknown>;
      if (parsed.ProjectWizardComplete === true || parsed.projectWizardComplete === true) {
        return true;
      }
    } catch {
      // Ignore unreadable or malformed project files and continue checking the next candidate.
    }
  }

  return false;
}

export function getProjectConfigPath(workspaceFolder?: vscode.WorkspaceFolder, projectName?: string, workspaceFolderName?: string): string {
  const folderUri = getCurrentWorkspaceFolder(workspaceFolder, workspaceFolderName)?.uri;
  const basePath = folderUri ? folderUri.fsPath : process.cwd();
  const configDir = path.join(basePath, PROJECT_CONFIG_DIR);
  const fallbackName = projectName ? getProjectRootFileName(projectName) : getProjectRootFileName('PluginName');
  const fallbackPath = path.join(configDir, fallbackName);
  const activeUri = getActiveWorkspaceFileUri();

  if (!workspaceFolder && !workspaceFolderName && !folderUri) {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const preferredProjectFolder = findWorkspaceFolderWithProjectConfig(workspaceFolders);
    if (preferredProjectFolder) {
      const preferredConfigPath = detectExistingProjectConfigPath(path.join(preferredProjectFolder.uri.fsPath, PROJECT_CONFIG_DIR), projectName);
      if (preferredConfigPath) {
        return preferredConfigPath;
      }
    }
  }

  if (!folderUri && (vscode.workspace.workspaceFolders?.length ?? 0) > 1) {
    const fallbackFolder = vscode.workspace.workspaceFolders?.[0];
    if (fallbackFolder) {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      const fallbackDir = path.join(fallbackFolder.uri.fsPath, PROJECT_CONFIG_DIR);
      const detectedPath = detectExistingProjectConfigPath(fallbackDir, projectName);
      if (detectedPath) {
        return detectedPath;
      }
      console.warn('[Elementor Builder] Falling back to the first workspace folder when no active file can resolve a target window.', {
        workspaceFolders: workspaceFolders.map((candidate) => candidate.uri.fsPath),
        activeFile: activeUri?.fsPath
      });
      return path.join(fallbackDir, fallbackName);
    }
  }

  const detectedPath = detectExistingProjectConfigPath(configDir, projectName);
  return detectedPath ?? fallbackPath;
}

export function prepareProjectWorkspaceFolder(workspaceFolder?: vscode.WorkspaceFolder, projectName?: string, workspaceFolderName?: string): string {
  const resolvedFolder = getCurrentWorkspaceFolder(workspaceFolder, workspaceFolderName);
  if (!resolvedFolder) {
    const message = 'Open a workspace folder in the current VS Code window before creating an Elementor Builder project.';
    console.error('[Elementor Builder] No workspace folder is available for project creation.', { workspaceFolders: vscode.workspace.workspaceFolders ?? [] });
    logProjectOutput(message, { workspaceFolders: vscode.workspace.workspaceFolders ?? [] });
    throw new Error(message);
  }

  const configDir = path.join(resolvedFolder.uri.fsPath, PROJECT_CONFIG_DIR);
  ensureProjectFolder(configDir);
  logProjectOutput('Prepared project workspace folder.', {
    workspaceFolder: resolvedFolder.uri.fsPath,
    projectDir: configDir,
    projectName: projectName || '(not set)'
  });
  return configDir;
}

export function ensureProjectConfig(workspaceFolder?: vscode.WorkspaceFolder, projectName?: string): string {
  const configPath = getProjectConfigPath(workspaceFolder, projectName);
  return configPath;
}

const sanitizeNamespace = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const normalized = trimmed.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized
    .split('/')
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9_\\-]/g, ''))
    .join('\\');
};

const sanitizePrefix = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'elementor';
  }

  return trimmed
    .replace(/[^a-zA-Z0-9_-]+/g, '')
    .replace(/^[^a-zA-Z]+/, '')
    .trim() || 'elementor';
};

const sanitizeTextDomain = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'elementor-builder';
  }

  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'elementor-builder';
};

const pickWorkspaceFolder = async (): Promise<vscode.WorkspaceFolder | undefined> => {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage(localize('workspaceRequired'));
    return undefined;
  }

  if (folders.length === 1) {
    return folders[0];
  }

  return vscode.window.showWorkspaceFolderPick({
    placeHolder: localize('selectWorkspaceFolder')
  });
};

const promptForValue = async (
  title: string,
  prompt: string,
  value: string,
  placeholder: string,
  validate?: (input: string) => string | undefined
): Promise<string | undefined> => {
  const result = await vscode.window.showInputBox({
    title,
    prompt,
    value,
    placeHolder: placeholder,
    validateInput: (input) => validate ? validate(input) : undefined
  });

  if (result === undefined) {
    return undefined;
  }

  return result.trim();
};

const confirmProjectSetup = async (project: ReturnType<typeof createDefaultProject>): Promise<boolean> => {
  const summary = [
    `Project Name: ${project.projectName}`,
    `Project Version: ${project.projectVersion}`,
    `Project Namespace: ${project.phpNamespace}`,
    `Widgets Namespace: ${project.widgetNamespace}`,
    `Template Namespace: ${project.templateNamespace}`,
    `Project Prefix: ${project.projectPrefix}`,
    `Text Domain: ${project.textDomain}`
  ].join('\n');

  const action = await vscode.window.showInformationMessage(
    'Review your Elementor Builder workspace setup before saving.',
    { modal: true, detail: summary },
    'Save',
    'Cancel'
  );

  return action === 'Save';
};

export const runWorkspaceSetupWizard = async (): Promise<void> => {
  const output = vscode.window.createOutputChannel('Elementor Builder');
  output.show(true);
  output.appendLine(`[${new Date().toISOString()}] Starting Elementor Builder setup wizard.`);

  const workspaceFolder = await pickWorkspaceFolder();
  if (!workspaceFolder) {
    output.appendLine(`[${new Date().toISOString()}] Setup wizard cancelled because no workspace folder was selected.`);
    return;
  }

  output.appendLine(`[${new Date().toISOString()}] Selected workspace folder: ${workspaceFolder.uri.fsPath}`);

  const projectDir = prepareProjectWorkspaceFolder(workspaceFolder, 'setup');
  output.appendLine(`[${new Date().toISOString()}] Prepared workspace project directory: ${projectDir}`);

  const project = loadProjectConfig(workspaceFolder);

  const projectName = await promptForValue(
    'Elementor Builder: Project name',
    'Enter the project name.',
    project.projectName || 'My Elementor Project',
    'My Elementor Project',
    (value) => value.trim() ? undefined : 'Project name is required.'
  );

  if (projectName === undefined) {
    return;
  }

  const projectVersion = await promptForValue(
    'Elementor Builder: Project version',
    'Enter the package version.',
    project.projectVersion || '1.0.0',
    '1.0.0',
    (value) => /^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/.test(value.trim()) ? undefined : 'Use semantic versioning such as 1.0.0.'
  );

  if (projectVersion === undefined) {
    return;
  }

  const projectNamespace = await promptForValue(
    'Elementor Builder: Project namespace',
    'Enter the PHP namespace for the project.',
    project.phpNamespace || 'MyPlugin\\Elementor',
    'MyPlugin\\Elementor',
    (value) => value.trim() ? undefined : 'Project namespace is required.'
  );

  if (projectNamespace === undefined) {
    return;
  }

  const widgetNamespace = await promptForValue(
    'Elementor Builder: Widgets namespace',
    'Enter the namespace used for generated widget classes.',
    project.widgetNamespace || `${sanitizeNamespace(projectNamespace, 'MyPlugin\\Elementor')}\\Widgets`,
    'MyPlugin\\Elementor\\Widgets'
  );

  if (widgetNamespace === undefined) {
    return;
  }

  const templateNamespace = await promptForValue(
    'Elementor Builder: Template namespace',
    'Enter the namespace used for widget template files.',
    project.templateNamespace || `${sanitizeNamespace(projectNamespace, 'MyPlugin\\Elementor')}\\Templates`,
    'MyPlugin\\Elementor\\Templates'
  );

  if (templateNamespace === undefined) {
    return;
  }

  const projectPrefix = await promptForValue(
    'Elementor Builder: Project prefix',
    'Enter a prefix used for generated class names and identifiers.',
    project.projectPrefix || sanitizePrefix(projectName),
    'myplugin',
    (value) => value.trim() ? undefined : 'Project prefix is required.'
  );

  if (projectPrefix === undefined) {
    return;
  }

  const textDomain = await promptForValue(
    'Elementor Builder: Text domain',
    'Enter the WordPress text domain for translations.',
    project.textDomain || sanitizeTextDomain(projectName),
    'my-plugin',
    (value) => value.trim() ? undefined : 'Text domain is required.'
  );

  if (textDomain === undefined) {
    return;
  }

  const updatedProject = {
    ...project,
    projectName,
    projectVersion,
    phpNamespace: sanitizeNamespace(projectNamespace, 'MyPlugin\\Elementor'),
    widgetNamespace: sanitizeNamespace(widgetNamespace, `${sanitizeNamespace(projectNamespace, 'MyPlugin\\Elementor')}\\Widgets`),
    templateNamespace: sanitizeNamespace(templateNamespace, `${sanitizeNamespace(projectNamespace, 'MyPlugin\\Elementor')}\\Templates`),
    projectPrefix: sanitizePrefix(projectPrefix),
    textDomain: sanitizeTextDomain(textDomain)
  };

  const canSave = await confirmProjectSetup(updatedProject);
  if (!canSave) {
    output.appendLine(`[${new Date().toISOString()}] Setup wizard cancelled before save.`);
    return;
  }

  const configPath = saveProjectConfig(updatedProject, workspaceFolder);
  output.appendLine(`[${new Date().toISOString()}] Wizard project save complete.`);
  output.appendLine(JSON.stringify({ workspaceFolder: workspaceFolder.uri.fsPath, configPath, projectName }, null, 2));

  const generatedConfigName = getProjectRootFileName(projectName);
  vscode.window.showInformationMessage(
    `Elementor Builder workspace configuration saved to ${workspaceFolder.uri.fsPath}\\.elementor-builder\\${generatedConfigName}`,
    'OK'
  );
};

function normalizeLegacyProject(raw: Partial<BuilderProject>, fallback: BuilderProject): BuilderProject {
  const project = createDefaultProject();
  const legacyRaw = raw as Partial<BuilderProject> & { classPrefix?: string; };
  const defaultWidget = createDefaultWidget(project.widgetGroups[0]?.id ?? 'group-custom');
  const fallbackSections = Array.isArray(raw.sections) ? raw.sections : defaultWidget.sections;
  const widgets = Array.isArray(raw.widgets) && raw.widgets.length > 0 ? raw.widgets : [
    { ...defaultWidget, ...raw, sections: fallbackSections }
  ];

  const widgetGroups = Array.isArray(raw.widgetGroups) && raw.widgetGroups.length > 0
    ? raw.widgetGroups
    : [];

  return {
    ...project,
    ...fallback,
    ...raw,
    projectName: raw.projectName || fallback.projectName || project.projectName,
    projectWizardComplete: raw.projectWizardComplete === true || fallback.projectWizardComplete === true,
    phpNamespace: raw.phpNamespace || fallback.phpNamespace || project.phpNamespace,
    widgetNamespace: raw.widgetNamespace || fallback.widgetNamespace || project.widgetNamespace,
    templateNamespace: raw.templateNamespace || fallback.templateNamespace || project.templateNamespace,
    projectPrefix: raw.projectPrefix || legacyRaw.classPrefix || fallback.projectPrefix || project.projectPrefix,
    textDomain: raw.textDomain || fallback.textDomain || project.textDomain,
    widgetGroups,
    widgets: widgets.map((widget, index) => ({
      ...defaultWidget,
      ...widget,
      id: widget.id || `widget-${index + 1}`,
      groupId: widget.groupId || widgetGroups[0]?.id || defaultWidget.groupId,
      sections: Array.isArray(widget.sections) && widget.sections.length > 0 ? widget.sections : defaultWidget.sections
    })),
    sections: Array.isArray(raw.sections) && raw.sections.length > 0 ? raw.sections : widgets[0]?.sections || project.sections
  };
}

function normalizeNestedProject(raw: Record<string, unknown>, fallback: BuilderProject): BuilderProject {
  const projectName = (raw.ProjectName as string) || (raw.projectName as string) || fallback.projectName;
  const projectConfig = (raw.ProjectConfig as Record<string, string | undefined>) || {};
  const projectSettings = (raw.ProjectSettings as Record<string, boolean | undefined>) || {};
  const groups = raw.widgets as Record<string, { title?: string; widgets?: string[]; widget?: Record<string, Record<string, unknown>> }> | undefined;

  const groupedWidgets: BuilderProject['widgetGroups'] = [];
  const flattenedWidgets: BuilderProject['widgets'] = [];

  if (groups) {
    Object.entries(groups).forEach(([groupKey, groupValue]) => {
      const typedGroupValue = groupValue as Record<string, unknown> & { icon?: string } | undefined;
      const text = typedGroupValue?.title ? String(typedGroupValue.title) : groupKey;
      const group = { ...makeWidgetGroup(text), icon: String(typedGroupValue?.icon ?? 'eicon-posts-ticker') };
      groupedWidgets.push(group);

      const entries = Array.isArray(groupValue?.widgets) ? groupValue.widgets : Object.keys(groupValue?.widget ?? {});
      entries.forEach((widgetReference) => {
        const widgetName = String(widgetReference).replace(/\.json$/i, '');
        const widgetPath = path.join(path.dirname(getProjectConfigPath()), 'widgets', `${widgetName}.json`);
        if (!fs.existsSync(widgetPath)) {
          return;
        }

        try {
          const widgetFile = JSON.parse(fs.readFileSync(widgetPath, 'utf8')) as Record<string, unknown>;
          const sections: WidgetSection[] = [];
          const widgetControls = widgetFile.widgetControls as Record<string, Record<string, unknown>> | undefined;
          Object.entries(widgetControls ?? {}).forEach(([sectionKey, sectionValue]) => {
            const sectionObject = (sectionValue ?? {}) as Record<string, unknown>;
            const controls = Object.entries((sectionObject.controls as Record<string, Record<string, unknown>> | undefined) ?? {}).map(([controlName, controlValue]) => {
              const control = controlValue ?? {};
              const tabValue = (control.tab as TabKey | undefined) ?? 'content';
              return {
                id: String(control.id ?? `${controlName}-${Date.now()}`),
                name: controlName,
                label: String(control.label ?? controlName),
                type: String(control.type ?? 'text'),
                description: String(control.description ?? ''),
                defaultValue: String(control.defaultValue ?? ''),
                placeholder: String(control.placeholder ?? ''),
                inputType: String(control.inputType ?? 'text'),
                title: String(control.title ?? ''),
                language: String(control.language ?? ''),
                rows: String(control.rows ?? ''),
                alpha: Boolean(control.alpha === true),
                enableSelectors: Boolean(control.enableSelectors === true),
                selectors: String(control.selectors ?? ''),
                options: String(control.options ?? ''),
                condition: String(control.condition ?? ''),
                conditions: Array.isArray(control.conditions)
                  ? (control.conditions as Array<Record<string, unknown>>).map((entry) => ({
                    id: String(entry.id ?? ''),
                    equalityCheck: Boolean(entry.equalityCheck === true),
                    control: String(entry.control ?? ''),
                    value: Array.isArray(entry.value) ? entry.value.map((value) => String(value)) : (typeof entry.value === 'string' ? [entry.value] : [])
                  }))
                  : [],
                tab: tabValue,
                showLabel: control.showLabel !== false,
                labelBlock: control.labelBlock !== false,
                separator: (control.separator as 'default' | 'before' | 'after') ?? 'default',
                min: String(control.min ?? ''),
                max: String(control.max ?? ''),
                step: String(control.step ?? ''),
                repeaterFields: Array.isArray(control.repeaterFields) ? control.repeaterFields as never[] : []
              };
            });

            sections.push({
              id: `${sectionKey}-${Date.now()}`,
              name: sectionKey.replace(/-section$/, ''),
              label: String(sectionObject.sectionLabel ?? sectionKey),
              tab: sectionKey.includes('style') ? 'style' : 'content',
              controls
            });
          });

          flattenedWidgets.push({
            id: `${widgetName}-${Date.now()}`,
            name: widgetName,
            title: String(widgetFile.widgetTitle ?? widgetName),
            className: widgetName
              .split(/[_-]+/)
              .filter(Boolean)
              .map(part => part.charAt(0).toUpperCase() + part.slice(1))
              .join('_'),
            icon: String(widgetFile.widgetIcon ?? 'eicon-text'),
            textDomain: String(projectConfig.TextDomain ?? fallback.textDomain),
            groupId: group.id,
            sections
          });
        } catch {
          // ignore invalid widget files during project load
        }
      });
    });
  }

  return {
    ...fallback,
    projectName: projectName || fallback.projectName,
    projectVersion: String((raw.ProjectVersion as string) ?? fallback.projectVersion),
    projectWizardComplete: raw.ProjectWizardComplete === true || raw.projectWizardComplete === true || fallback.projectWizardComplete === true,
    phpNamespace: cleanNamespace(projectConfig.ProjectNamespace, fallback.phpNamespace),
    widgetNamespace: cleanNamespace(projectConfig.WidgetNamespace ?? projectConfig.WidgetsNamespace, fallback.widgetNamespace),
    templateNamespace: cleanNamespace(projectConfig.TemplateNamespace ?? projectConfig.TemplateNamespace, fallback.templateNamespace),
    finderNamespace: cleanNamespace(projectConfig.FinderNamespace, fallback.finderNamespace),
    controlsNamespace: cleanNamespace(projectConfig.ControlsNamespace, fallback.controlsNamespace),
    tagsNamespace: cleanNamespace(projectConfig.TagsNamespace, fallback.tagsNamespace),
    themeConditionsNamespace: cleanNamespace(projectConfig.ThemeConditionsNamespace, fallback.themeConditionsNamespace),
    themeLocationsNamespace: cleanNamespace(projectConfig.ThemeLocationsNamespace, fallback.themeLocationsNamespace),
    formFieldsNamespace: cleanNamespace(projectConfig.FormFieldsNamespace, fallback.formFieldsNamespace),
    formActionsNamespace: cleanNamespace(projectConfig.FormActionsNamespace, fallback.formActionsNamespace),
    contextMenusNamespace: cleanNamespace(projectConfig.ContextMenusNamespace, fallback.contextMenusNamespace),
    projectPrefix: asString(projectConfig.ProjectPrefix, fallback.projectPrefix),
    textDomain: asString(projectConfig.TextDomain, fallback.textDomain),
    projectSettings: {
      psr4Enabled: projectSettings.psr4Enabled ?? fallback.projectSettings.psr4Enabled,
      widgetsEnabled: projectSettings.widgetsEnabled ?? projectSettings.enableWidgets ?? fallback.projectSettings.widgetsEnabled,
      enableFinder: projectSettings.enableFinder ?? fallback.projectSettings.enableFinder,
      enableControls: projectSettings.enableControls ?? fallback.projectSettings.enableControls,
      enableDynamicTags: projectSettings.enableDynamicTags ?? fallback.projectSettings.enableDynamicTags,
      enableThemeConditions: projectSettings.enableThemeConditions ?? fallback.projectSettings.enableThemeConditions,
      enableThemeLocations: projectSettings.enableThemeLocations ?? fallback.projectSettings.enableThemeLocations,
      enableFormFields: projectSettings.enableFormFields ?? fallback.projectSettings.enableFormFields,
      enableFormActions: projectSettings.enableFormActions ?? fallback.projectSettings.enableFormActions,
      enableContextMenus: projectSettings.enableContextMenus ?? fallback.projectSettings.enableContextMenus
    },
    widgetGroups: groupedWidgets.length > 0 ? groupedWidgets : fallback.widgetGroups,
    widgets: flattenedWidgets.length > 0 ? flattenedWidgets : fallback.widgets,
    sections: flattenedWidgets[0]?.sections ?? fallback.sections
  };
}

export function loadProjectConfig(workspaceFolder?: vscode.WorkspaceFolder, projectName?: string): BuilderProject {
  const configPath = getProjectConfigPath(workspaceFolder, projectName);

  if (!fs.existsSync(configPath)) {
    return createDefaultProject();
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fallback = createDefaultProject();

    if (parsed && (parsed.ProjectName || parsed.ProjectConfig || parsed.widgets && typeof parsed.widgets === 'object' && !Array.isArray(parsed.widgets))) {
      return normalizeNestedProject(parsed, fallback);
    }

    return normalizeLegacyProject(parsed as Partial<BuilderProject>, fallback);
  } catch {
    return createDefaultProject();
  }
}

export function saveProjectConfig(project: BuilderProject, workspaceFolder?: vscode.WorkspaceFolder, workspaceFolderName?: string): string {
  const channel = getProjectOutputChannel();
  channel.show(true);

  const resolvedFolder = getCurrentWorkspaceFolder(workspaceFolder, workspaceFolderName);
  if (!resolvedFolder) {
    const message = 'Open a workspace folder in the current VS Code window before creating an Elementor Builder project.';
    console.error('[Elementor Builder] No workspace folder is available for project creation.', { workspaceFolders: vscode.workspace.workspaceFolders ?? [] });
    logProjectOutput(message, { workspaceFolders: vscode.workspace.workspaceFolders ?? [] });
    throw new Error(message);
  }

  const folderUri = resolvedFolder.uri;
  const basePath = folderUri.fsPath;
  const activeFilePath = getActiveWorkspaceFileUri()?.fsPath;

  if ((vscode.workspace.workspaceFolders?.length ?? 0) > 1 && !workspaceFolder && !activeFilePath) {
    const fallbackFolder = vscode.workspace.workspaceFolders?.[0];
    if (fallbackFolder) {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      const message = 'Save is falling back to the first workspace folder in the current window.';
      console.warn(`[Elementor Builder] ${message}`, {
        workspaceFolders: workspaceFolders.map((candidate) => candidate.uri.fsPath),
        activeFile: activeFilePath
      });
      logProjectOutput(message, {
        workspaceFolders: workspaceFolders.map((candidate) => candidate.uri.fsPath),
        activeFile: activeFilePath
      });
      const dir = prepareProjectWorkspaceFolder(fallbackFolder, project.projectName || 'PluginName');
      const fallbackPath = path.join(dir, getProjectRootFileName((project.projectName || 'PluginName').trim() || 'PluginName'));
      writeJsonFile(fallbackPath, project);
      logProjectOutput('Project save completed with workspace fallback.', { configPath: fallbackPath, workspaceFolder: fallbackFolder.uri.fsPath });
      return fallbackPath;
    }
  }

  const configDir = prepareProjectWorkspaceFolder(resolvedFolder, project.projectName || 'PluginName', workspaceFolderName);

  const displayProjectName = (project.projectName || 'PluginName').trim() || 'PluginName';
  const configPath = path.join(configDir, getProjectRootFileName(displayProjectName));
  const settings = project.projectSettings ?? createDefaultProject().projectSettings;
  logProjectOutput('Beginning project file creation.', {
    workspaceFolder: basePath,
    projectName: displayProjectName,
    configPath,
    enabledModules: settings
  });

  try {
    verifyDirectoryExists(configDir, 'Project folder creation');
    logProjectOutput('Project folder creation confirmed.', { configDir });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error while checking the workspace project folder.';
    failProjectStep('Project folder creation', message.replace(/^Project creation failed at Project folder creation: /, ''));
  }

  const moduleDirs = [
    'templates',
    settings.enableDynamicTags ? 'dynamic-tags' : null,
    settings.enableFormFields ? 'form-fields' : null,
    settings.enableFormActions ? 'form-actions' : null,
    settings.enableFinder ? 'finder-categories' : null,
    settings.enableControls ? 'controls' : null,
    settings.enableThemeConditions ? 'theme-conditions' : null,
    settings.enableThemeLocations ? 'theme-locations' : null,
    settings.enableContextMenus ? 'context-menus' : null,
    settings.widgetsEnabled ? 'widgets' : null
  ].filter((value): value is string => Boolean(value));

  for (const dirName of moduleDirs) {
    const dirPath = path.join(configDir, dirName);
    try {
      ensureProjectFolder(dirPath);
      verifyDirectoryExists(dirPath, `Module folder creation (${dirName})`);
      logProjectOutput(`Folder created and verified: ${dirName}`, { dirPath });
    } catch (error) {
      const stepName = `Module folder creation (${dirName})`;
      const detail = error instanceof Error ? error.message : 'Unknown error while creating a module folder.';
      failProjectStep(stepName, detail.replace(/^Project creation failed at .*?: /, ''));
    }
  }

  if (settings.widgetsEnabled) {
    const widgetTemplateDir = path.join(configDir, 'widgets', 'templates');
    const widgetContentDir = path.join(configDir, 'widgets', 'templates', 'content');
    try {
      ensureProjectFolder(widgetTemplateDir);
      ensureProjectFolder(widgetContentDir);
      verifyDirectoryExists(widgetTemplateDir, 'Widget template folder creation');
      verifyDirectoryExists(widgetContentDir, 'Widget template content folder creation');
      logProjectOutput('Widget template folders created and verified.', { widgetTemplateDir, widgetContentDir });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error while creating widget template folders.';
      failProjectStep('Widget template folder creation', detail.replace(/^Project creation failed at .*?: /, ''));
    }
  }

  logProjectOutput('Created project module folders.', { configDir, moduleDirs, widgetsEnabled: settings.widgetsEnabled });

  const rootProject = {
    ProjectName: displayProjectName,
    ProjectVersion: project.projectVersion,
    ProjectWizardComplete: true,
    ProjectSettings: {
      psr4Enabled: settings.psr4Enabled,
      widgetsEnabled: settings.widgetsEnabled,
      enableFinder: settings.enableFinder,
      enableControls: settings.enableControls,
      enableDynamicTags: settings.enableDynamicTags,
      enableThemeConditions: settings.enableThemeConditions,
      enableThemeLocations: settings.enableThemeLocations,
      enableFormFields: settings.enableFormFields,
      enableFormActions: settings.enableFormActions,
      enableContextMenus: settings.enableContextMenus
    },
    ProjectConfig: {
      ProjectNamespace: cleanNamespace(project.phpNamespace, ''),
      WidgetsNamespace: cleanNamespace(project.widgetNamespace, ''),
      TemplateNamespace: cleanNamespace(project.templateNamespace, ''),
      FinderNamespace: cleanNamespace(project.finderNamespace, ''),
      ControlsNamespace: cleanNamespace(project.controlsNamespace, ''),
      TagsNamespace: cleanNamespace(project.tagsNamespace, ''),
      ThemeConditionsNamespace: cleanNamespace(project.themeConditionsNamespace, ''),
      ThemeLocationsNamespace: cleanNamespace(project.themeLocationsNamespace, ''),
      FormFieldsNamespace: cleanNamespace(project.formFieldsNamespace, ''),
      FormActionsNamespace: cleanNamespace(project.formActionsNamespace, ''),
      ContextMenusNamespace: cleanNamespace(project.contextMenusNamespace, ''),
      ProjectPrefix: project.projectPrefix,
      TextDomain: project.textDomain
    },
    ProjectAssets: {
      registerScripts: (project.projectAssets?.scripts ?? []).map((asset) => ({
        name: asset.name,
        src: asset.src,
        dependsOn: asset.dependsOn,
        version: asset.version,
        inFooter: asset.inFooter
      })),
      registerStyles: (project.projectAssets?.styles ?? []).map((asset) => ({
        name: asset.name,
        src: asset.src,
        dependsOn: asset.dependsOn,
        version: asset.version
      }))
    },
    widgets: {},
    dynamicTags: [],
    finderCategories: [],
    controls: [],
    themeConditions: [],
    themeLocations: [],
    formFields: [],
    formActions: [],
    contextMenus: []
  };

  const widgetGroups = project.widgetGroups.length > 0 ? project.widgetGroups : [];
  const widgetIndex: Record<string, { title: string; icon: string; widgets: string[] }> = {};

  for (const group of widgetGroups) {
    const groupWidgets = project.widgets.filter((widget) => widget.groupId === group.id);
    const widgetRefs: string[] = [];
    for (const widget of groupWidgets) {
      const widgetFileName = `${widget.name || widget.title || 'widget'}.json`;
      const widgetDir = path.join(configDir, 'widgets');
      ensureProjectFolder(widgetDir);
      const widgetFilePath = path.join(widgetDir, widgetFileName);
      logProjectOutput('Preparing widget file.', { widgetFilePath, widgetName: widget.name, group: group.slug });
      const serializeControlForSave = (control: WidgetControl) => {
        const normalizedConditions = Array.isArray(control.conditions)
          ? control.conditions
              .filter((entry) => typeof entry === 'object' && entry !== null)
              .map((entry) => ({
                id: typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                equalityCheck: entry.equalityCheck === true,
                control: typeof entry.control === 'string' ? entry.control : '',
                value: Array.isArray(entry.value) ? entry.value.map((value) => String(value)) : (typeof entry.value === 'string' ? [entry.value] : [])
              }))
              .filter((entry) => entry.control.trim().length > 0 || entry.value.length > 0)
          : [];

        const baseControl = {
          type: control.type,
          label: control.label,
          description: control.description,
          labelBlock: control.labelBlock,
          showLabel: control.showLabel,
          separator: control.separator ?? 'default',
          defaultValue: control.defaultValue,
          condition: control.condition ?? '',
          conditions: normalizedConditions,
          enableSelectors: Boolean(control.enableSelectors === true),
          selectors: control.selectors ?? '',
          dynamicContent: Boolean(control.dynamicContent === true),
          frontendAvailable: Boolean(control.frontendAvailable === true),
          enableAI: Boolean(control.enableAI === true),
          aiType: control.aiType ?? '',
          aiLanguage: control.aiLanguage ?? '',
          aiCategory: control.aiCategory ?? ''
        };

        const typeSpecificFields: Record<string, unknown> = {};

        if (control.placeholder) {
          typeSpecificFields.placeholder = control.placeholder;
        }

        if (control.inputType && control.type === 'text') {
          typeSpecificFields.inputType = control.inputType;
        }

        if (control.language && ['code', 'wysiwyg'].includes(control.type)) {
          typeSpecificFields.language = control.language;
        }

        if (control.rows && ['textarea', 'code', 'wysiwyg', 'repeater'].includes(control.type)) {
          typeSpecificFields.rows = control.rows;
        }

        if (control.alpha !== undefined && control.type === 'color') {
          typeSpecificFields.alpha = Boolean(control.alpha === true);
        }

        if (control.options && ['select', 'select2', 'choose', 'visual_choice', 'font'].includes(control.type)) {
          typeSpecificFields.options = control.options;
        }

        if (control.min && ['number', 'slider', 'dimensions'].includes(control.type)) {
          typeSpecificFields.min = control.min;
        }

        if (control.max && ['number', 'slider', 'dimensions'].includes(control.type)) {
          typeSpecificFields.max = control.max;
        }

        if (control.step && ['number', 'slider'].includes(control.type)) {
          typeSpecificFields.step = control.step;
        }

        if (control.pickerOptions && control.type === 'date_time') {
          typeSpecificFields.pickerOptions = control.pickerOptions;
        }

        if (control.type === 'switcher') {
          typeSpecificFields.labelOn = control.labelOn ?? 'On';
          typeSpecificFields.labelOff = control.labelOff ?? 'Off';
          typeSpecificFields.returnValue = control.returnValue ?? 'yes';
        }

        return {
          ...baseControl,
          ...typeSpecificFields
        };
      };

      const widgetPayload = {
        widgetName: widget.name,
        widgetTitle: widget.title,
        widgetDescription: widget.description ?? '',
        widgetIcon: widget.icon,
        widgetCategories: group.slug,
        widgetKeywords: widget.keywords ?? [widget.name, group.slug, 'widget'],
        widgetHelpUrl: '',
        widgetUpscaleData: '',
        widgetDependencies: { scripts: [], styles: [] },
        widgetInnerWrapper: '',
        widgetDynamicContent: '',
        widgetTemplate: widget.name,
        widgetContentTemplate: widget.name,
        widgetControls: Object.fromEntries((widget.sections ?? []).map((section) => [
          `${section.name}-section`,
          {
            sectionLabel: section.label,
            sectionConditions: {},
            controls: Object.fromEntries((section.controls ?? []).map((control) => [
              control.name || `${control.type}_${Date.now()}`,
              serializeControlForSave(control)
            ]))
          }
        ]))
      };
      writeJsonFile(widgetFilePath, widgetPayload);
      widgetRefs.push(widget.name || widget.title || 'widget');
    }
    widgetIndex[group.slug || group.id] = { title: group.text, icon: group.icon ?? 'eicon-posts-ticker', widgets: widgetRefs };
  }

  rootProject.widgets = widgetIndex;

  const entityFolderMap: Record<string, string> = {
    controls: 'controls',
    contextMenus: 'context-menus',
    dynamicTags: 'dynamic-tags',
    finderCategories: 'finder-categories',
    formFields: 'form-fields',
    formActions: 'form-actions',
    themeConditions: 'theme-conditions',
    themeLocations: 'theme-locations'
  };

  const rawProject = project as unknown as Record<string, unknown>;

  Object.entries(entityFolderMap).forEach(([key, folderName]) => {
    const list = Array.isArray(rawProject[key]) ? (rawProject[key] as Array<Record<string, unknown>>) : [];
    const folderPath = path.join(configDir, folderName);
    if (list.length === 0) {
      return;
    }

    ensureProjectFolder(folderPath);
    const names: string[] = [];
    list.forEach((item) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const rawName = String(entry.name ?? entry.title ?? 'item');
      const safeName = rawName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
      const payload = {
        ...((entry.data as Record<string, unknown>) ?? {}),
        name: rawName,
        description: String(entry.description ?? ''),
        id: String(entry.id ?? safeName)
      };
      const filePath = path.join(folderPath, `${safeName}.json`);
      writeJsonFile(filePath, payload);
      names.push(rawName);
    });
    (rootProject as Record<string, unknown>)[key] = names;
  });

  try {
    writeJsonFile(configPath, rootProject);
    verifyFileExists(configPath, 'Project file creation');
    logProjectOutput('Project file creation confirmed.', { configPath });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error while writing the project file.';
    failProjectStep('Project file creation', detail.replace(/^Project creation failed at .*?: /, ''));
  }

  return configPath;
}
