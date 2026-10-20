import * as vscode from 'vscode';

export const localizationBundle = {
  openNavigation: 'Open Navigation',
  closeNavigation: 'Close Navigation',
  controlCentre: 'Control Centre',
  project: 'Project',
  settings: 'Settings',
  troubleshooting: 'Troubleshooting',
  projectName: 'Project name',
  version: 'Version',
  namespace: 'Namespace',
  enabledSettings: 'Enabled settings',
  noProjectSettingsEnabled: 'No project settings enabled',
  addGroup: 'Add group',
  widgets: 'Widgets',
  actions: 'Actions',
  noWidgetsInGroup: 'No widgets in this group yet.',
  widgetBuilder: 'Widget builder',
  widgetName: 'Widget name',
  widgetLabel: 'Widget label',
  section: 'Section',
  addControls: 'Add controls',
  noControlsAdded: 'No controls added yet. Choose a category and type above.',
  addSelectedControl: 'Add selected control',
  addWidget: 'Add widget',
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  startSetupWizard: 'Start Setup Wizard',
  projectSetup: 'Project setup',
  projectDetails: 'Project details',
  projectSettings: 'Project settings',
  namespaceSetup: 'Namespace setup',
  reviewAndCreate: 'Review and create',
  welcome: 'Welcome',
  back: 'Back',
  next: 'Next',
  create: 'Create',
  ready: 'Ready',
  dashboard: 'Dashboard',
  projectSettingsTitle: 'Project features',
  tools: 'Tools',
  readyText: 'The Control Centre is loading the interactive builder view...',
  projectReadyText: 'Configure the builder metadata, widget groups, and generated Elementor component setup.',
  controlsReadyText: 'Add responsive widgets, content controls, and advanced styling controls.',
  openProjectFile: 'Open Workspace Project',
  createProject: 'Create Project',
  openProjectFileTitle: 'Elementor Builder: Open Workspace Project',
  setupWorkspace: 'Elementor Builder: Setup Workspace',
  openSidebar: 'Elementor Builder: Open Sidebar',
  openControlCentre: 'Elementor Builder: Open Control Centre',
  addWidgetGroup: 'Elementor Builder: Add Group',
  addWidgetCommand: 'Elementor Builder: Add Widget',
  renameWidgetGroup: 'Rename Group',
  renameWidget: 'Rename Widget',
  workspaceRequired: 'Elementor Builder requires an open workspace folder.',
  selectWorkspaceFolder: 'Select the workspace folder to configure for Elementor Builder.',
  noProjectCreated: 'No workspace project has been created yet.',
  createProjectQuestion: 'No workspace project has been created yet. Create one now?',
  noActiveProject: 'No active project configured. Please set up a project first.',
  debugMessagePrefix: 'Debug request for project prepared. Please paste this into GitHub Copilot Chat: ',
  renameWidgetGroupPrompt: 'Rename widget group',
  groupNamePlaceholder: 'Group name',
  renameWidgetPrompt: 'Rename widget',
  widgetNamePlaceholder: 'Widget name',
  projectConfigPathMessage: 'Elementor Builder workspace configuration saved to',
  elementorBuilderControlCentreTitle: 'Elementor Builder Control Centre',
  elementorBuilderTitle: 'Elementor Builder'
} as const;

export type LocalizationKey = keyof typeof localizationBundle;

export const __ = (text: string, domain: string = 'elementorbuilder'): string => {
  if (!text) {
    return text;
  }

  const translation = vscode.l10n.t(text);
  if (translation && translation !== text) {
    return translation;
  }

  const domainKey = `${domain}:${text}`;
  const customCatalog = (globalThis as Record<string, unknown>).__elementorBuilderTranslationCatalog as Record<string, string> | undefined;
  if (customCatalog && customCatalog[domainKey]) {
    return customCatalog[domainKey];
  }

  return text;
};

export const localize = (key: LocalizationKey): string => __((localizationBundle[key] ?? key) as string, 'elementorbuilder');

export const getWebviewLocalization = (): Record<LocalizationKey, string> => {
  return Object.fromEntries(
    Object.keys(localizationBundle).map((key) => [key, localize(key as LocalizationKey)])
  ) as Record<LocalizationKey, string>;
};
