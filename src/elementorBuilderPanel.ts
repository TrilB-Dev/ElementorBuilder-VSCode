import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BuilderProject, TabKey, WidgetControl, WidgetSection } from './types';
import { getCurrentWorkspaceFolder, loadProjectConfig, saveProjectConfig } from './projectConfig';

function escapePhpString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatPhpValue(value: unknown, indentLevel = 0): string {
  const indent = ' '.repeat(indentLevel * 4);

  if (value === undefined || value === null || value === '') {
    return "''";
  }

  if (typeof value === 'string') {
    return `'${escapePhpString(value)}'`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const nextIndent = ' '.repeat((indentLevel + 1) * 4);
    return '[\n' + value.map((entry) => nextIndent + formatPhpValue(entry, indentLevel + 1)).join(',\n') + '\n' + indent + ']';
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return '[]';
  }

  const nextIndent = ' '.repeat((indentLevel + 1) * 4);
  const content = entries
    .map(([key, entry]) => nextIndent + "'" + escapePhpString(key) + "' => " + formatPhpValue(entry, indentLevel + 1))
    .join(',\n');

  return '[\n' + content + '\n' + indent + ']';
}

function getTabConstant(tab: TabKey): string {
  const map: Record<TabKey, string> = {
    content: '\\Elementor\\Controls_Manager::TAB_CONTENT',
    style: '\\Elementor\\Controls_Manager::TAB_STYLE',
    advanced: '\\Elementor\\Controls_Manager::TAB_ADVANCED',
    layout: '\\Elementor\\Controls_Manager::TAB_LAYOUT'
  };

  return map[tab] ?? '\\Elementor\\Controls_Manager::TAB_CONTENT';
}

function getControlTypeConstant(type: string): string {
  const map: Record<string, string> = {
    text: '\\Elementor\\Controls_Manager::TEXT',
    textarea: '\\Elementor\\Controls_Manager::TEXTAREA',
    number: '\\Elementor\\Controls_Manager::NUMBER',
    select: '\\Elementor\\Controls_Manager::SELECT',
    select2: '\\Elementor\\Controls_Manager::SELECT2',
    switcher: '\\Elementor\\Controls_Manager::SWITCHER',
    checkbox: '\\Elementor\\Controls_Manager::CHECKBOX',
    radio: '\\Elementor\\Controls_Manager::RADIO',
    color: '\\Elementor\\Controls_Manager::COLOR',
    media: '\\Elementor\\Controls_Manager::MEDIA',
    gallery: '\\Elementor\\Controls_Manager::GALLERY',
    url: '\\Elementor\\Controls_Manager::URL',
    wysiwyg: '\\Elementor\\Controls_Manager::WYSIWYG',
    code: '\\Elementor\\Controls_Manager::CODE',
    hidden: '\\Elementor\\Controls_Manager::HIDDEN',
    html: '\\Elementor\\Controls_Manager::HTML',
    icon: '\\Elementor\\Controls_Manager::ICON',
    slider: '\\Elementor\\Controls_Manager::SLIDER',
    range: '\\Elementor\\Controls_Manager::RANGE',
    choose: '\\Elementor\\Controls_Manager::CHOOSE',
    font: '\\Elementor\\Controls_Manager::FONT',
    date_time: '\\Elementor\\Controls_Manager::DATE_TIME',
    typography: '\\Elementor\\Controls_Manager::TYPOGRAPHY',
    background: '\\Elementor\\Controls_Manager::BACKGROUND',
    border: '\\Elementor\\Controls_Manager::BORDER',
    box_shadow: '\\Elementor\\Controls_Manager::BOX_SHADOW',
    text_shadow: '\\Elementor\\Controls_Manager::TEXT_SHADOW',
    filter: '\\Elementor\\Controls_Manager::FILTER',
    transform: '\\Elementor\\Controls_Manager::TRANSFORM',
    animation: '\\Elementor\\Controls_Manager::ANIMATION',
    hover_animation: '\\Elementor\\Controls_Manager::HOVER_ANIMATION',
    motion_fx: '\\Elementor\\Controls_Manager::MOTIONFX',
    dimensions: '\\Elementor\\Controls_Manager::DIMENSIONS',
    position: '\\Elementor\\Controls_Manager::POSITION',
    image_dimensions: '\\Elementor\\Controls_Manager::IMAGE_DIMENSIONS',
    image_size: '\\Elementor\\Controls_Manager::IMAGE_SIZE',
    entry_animation: '\\Elementor\\Controls_Manager::ANIMATION',
    device_visibility: '\\Elementor\\Controls_Manager::DEVICE_VISIBILITY',
    custom_css: '\\Elementor\\Controls_Manager::CUSTOM_CSS',
    repeater: '\\Elementor\\Controls_Manager::REPEATER',
    section: '\\Elementor\\Controls_Manager::SECTION',
    tabs: '\\Elementor\\Controls_Manager::TABS',
    popover_toggle: '\\Elementor\\Controls_Manager::POPOVER_TOGGLE',
    query: '\\Elementor\\Controls_Manager::QUERY',
    template: '\\Elementor\\Controls_Manager::TEMPLATE',
    oembed: '\\Elementor\\Controls_Manager::OEmbed',
    divider: '\\Elementor\\Controls_Manager::DIVIDER'
  };

  return map[type] ?? "'" + escapePhpString(type) + "'";
}

function parsePrimitive(rawValue: string): string | number | boolean {
  const value = rawValue.trim();
  if (value === '') {
    return '';
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  return rawValue;
}

function parseSelect2DefaultValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry)).filter(Boolean);
    }
  } catch {
    // ignore and fall back to simple comma parsing below
  }

  return trimmed
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((entry) => entry.trim().replace(/^['\"]|['\"]$/g, ''))
    .filter(Boolean);
}

function parseSelectors(value: string): Record<string, string> | undefined {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  const result: Record<string, string> = {};

  for (const line of lines) {
    const separatorIndex = line.indexOf('=>');
    if (separatorIndex < 0) {
      continue;
    }

    const selector = line.slice(0, separatorIndex).trim();
    const declaration = line.slice(separatorIndex + 2).trim();

    if (!selector || !declaration) {
      continue;
    }

    result[selector] = declaration;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseMetadataOptions(value: string): Record<string, Record<string, string>> | undefined {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line);

  if (lines.length === 0 || lines.every((line) => !line.trim())) {
    return undefined;
  }

  const result: Record<string, Record<string, string>> = {};
  let activeKey: string | null = null;
  let activeValues: Record<string, string> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/^\s+/.test(line)) {
      if (!activeKey || !activeValues) {
        continue;
      }

      const [key, ...rest] = trimmed.split(/\s*:\s*/);
      if (key && rest.length > 0) {
        activeValues[key] = rest.join(':');
      }
      continue;
    }

    const [key, ...rest] = trimmed.split(/\s*:\s*/);
    if (!key || !rest.length) {
      continue;
    }

    const nextLine = lines[lines.indexOf(line) + 1] ?? '';
    if (nextLine.trim() && /^\s+/.test(nextLine)) {
      activeKey = key;
      activeValues = {};
      result[key] = activeValues;
      continue;
    }

    activeKey = null;
    activeValues = null;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parsePickerOptions(value: string): Record<string, unknown> | undefined {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const line of lines) {
    const splitIndex = line.indexOf(':');
    const equalsIndex = line.indexOf('=');
    const separatorIndex = splitIndex >= 0 && (equalsIndex < 0 || splitIndex < equalsIndex)
      ? splitIndex
      : equalsIndex;

    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const raw = line.slice(separatorIndex + 1).trim();

    if (!key || !raw) {
      continue;
    }

    const normalized = raw.replace(/^['"]|['"]$/g, '');
    result[key] = parsePrimitive(normalized);
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function parseOptions(value: string): Record<string, unknown> | undefined {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line);

  if (lines.length === 0 || lines.every((line) => !line.trim())) {
    return undefined;
  }

  const result: Record<string, unknown> = {};
  let activeGroup: { key: string; options: Record<string, string> } | null = null;
  let activeChooseOptionKey: string | null = null;
  let activeChooseOption: Record<string, string> | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (/^\s+/.test(line)) {
      const currentKey = activeChooseOptionKey ?? activeGroup?.key;
      if (!currentKey) {
        continue;
      }

      const [key, ...rest] = trimmed.split(/\s*:\s*/);
      if (!key || rest.length === 0) {
        continue;
      }

      if (activeChooseOption) {
        activeChooseOption[key] = rest.join(':');
        continue;
      }

      if (activeGroup) {
        activeGroup.options[key] = rest.join(':');
      }
      continue;
    }

    const [key, ...rest] = trimmed.split(/\s*:\s*/);
    if (!key) {
      continue;
    }

    const nextLine = lines[index + 1] ?? '';
    const lineHasNestedOptions = Boolean(nextLine.trim()) && /^\s+/.test(nextLine);

    if (lineHasNestedOptions) {
      const nestedOptions: Record<string, string> = {};
      activeGroup = { key, options: nestedOptions };
      result[key] = {
        label: rest.join(':') || key,
        options: nestedOptions
      };
      activeChooseOptionKey = null;
      activeChooseOption = null;
      continue;
    }

    if (rest.length === 0 && nextLine.trim() && /^\s+/.test(nextLine)) {
      activeChooseOptionKey = key;
      activeChooseOption = {};
      result[key] = activeChooseOption;
      activeGroup = null;
      continue;
    }

    result[key] = rest.join(':') || key;
    activeGroup = null;
    activeChooseOptionKey = null;
    activeChooseOption = null;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function buildControlParams(control: WidgetControl): Record<string, unknown> {
  const params: Record<string, unknown> = {
    label: control.label || control.name,
    type: getControlTypeConstant(control.type)
  };

  const buildConditionParams = (): Record<string, unknown>[] | undefined => {
    const rows = Array.isArray(control.conditions) ? control.conditions : [];
    if (rows.length === 0) {
      return undefined;
    }

    return rows
      .filter((row) => row && (row.control || row.value?.length))
      .map((row) => ({
        name: row.control,
        operator: row.equalityCheck === false ? '!==' : '===',
        value: Array.isArray(row.value) && row.value.length > 0 ? row.value : ''
      }));
  };

  if (control.description) {
    params.description = control.description;
  }
  if (control.type !== 'code' && control.placeholder) {
    params.placeholder = control.placeholder;
  }
  if (control.type === 'text') {
    const inputType = String(control.inputType ?? 'text').trim();
    if (inputType) {
      params.input_type = inputType;
    }
    if (control.title) {
      params.title = control.title;
    }
  }
  if (control.type === 'code') {
    const language = String(control.language ?? '').trim();
    if (language) {
      params.language = language;
    }
    if (control.rows !== '') {
      params.rows = Number(control.rows) || 12;
    }
  }
  if (control.type === 'textarea' && control.rows !== '') {
    params.rows = Number(control.rows) || 4;
  }
  if (control.type === 'switcher') {
    const labelOn = String(control.labelOn ?? '').trim();
    const labelOff = String(control.labelOff ?? '').trim();
    const returnValue = String(control.returnValue ?? '').trim();

    if (labelOn) {
      params.label_on = labelOn;
    }
    if (labelOff) {
      params.label_off = labelOff;
    }
    if (returnValue) {
      params.return_value = parsePrimitive(returnValue);
    }
  }
  if (control.type === 'color' && typeof control.alpha === 'boolean') {
    params.alpha = control.alpha;
  }
  if (control.type === 'date_time') {
    const pickerOptions = parsePickerOptions(control.pickerOptions ?? '');
    if (pickerOptions) {
      params.picker_options = pickerOptions;
    }
  }
  if (control.type === 'select2' && control.multiple) {
    params.multiple = true;
    const defaults = parseSelect2DefaultValue(control.defaultValue);
    if (defaults.length > 0) {
      params.default = defaults.map((entry) => parsePrimitive(entry));
    }
  } else if (control.defaultValue !== '') {
    params.default = parsePrimitive(control.defaultValue);
  }
  const structuredConditions = buildConditionParams();
  if (structuredConditions) {
    params.condition = structuredConditions;
  } else if (control.condition) {
    try {
      params.condition = JSON.parse(control.condition);
    } catch {
      params.condition = control.condition;
    }
  }
  if (control.enableSelectors && control.selectors) {
    const selectors = parseSelectors(control.selectors);
    if (selectors) {
      params.selectors = selectors;
    }
  }
  if (control.dynamicContent === true) {
    params.dynamic = true;
  }
  if (control.frontendAvailable === true) {
    params.frontend_available = true;
  }
  if (control.enableAI === true) {
    const aiConfig: Record<string, unknown> = {};
    const aiType = String(control.aiType ?? '').trim();
    if (aiType) {
      aiConfig.type = aiType;
    }
    if (aiType === 'code' && control.aiLanguage) {
      aiConfig.language = control.aiLanguage;
    }
    if (aiType === 'media' && control.aiCategory) {
      aiConfig.category = control.aiCategory;
    }
    if (Object.keys(aiConfig).length > 0) {
      params.ai = aiConfig;
    }
  }
  if (control.showLabel !== true) {
    params.show_label = false;
  }
  if (control.labelBlock !== true) {
    params.label_block = false;
  }
  if (control.tab && control.tab !== 'content') {
    params.tab = getTabConstant(control.tab);
  }
  if (['select', 'select2', 'radio', 'font'].includes(control.type)) {
    const options = parseOptions(control.options ?? '');
    if (options) {
      params.options = options;
    }
  }

  if (control.type === 'choose') {
    if (typeof control.toggle === 'boolean') {
      params.toggle = control.toggle;
    }
    const options = parseMetadataOptions(control.options ?? '');
    if (options) {
      params.options = Object.entries(options).reduce<Record<string, unknown>>((carry, [key, value]) => {
        carry[key] = typeof value === 'object' && value !== null ? value : { title: String(value || key), icon: String(value || key) };
        return carry;
      }, {});
    }
  }
  if (control.type === 'visual_choice') {
    if (control.columns !== '') {
      params.columns = Number(control.columns) || 2;
    }
    if (typeof control.toggle === 'boolean') {
      params.toggle = control.toggle;
    }
    const options = parseMetadataOptions(control.options ?? '');
    if (options) {
      params.options = Object.entries(options).reduce<Record<string, unknown>>((carry, [key, value]) => {
        carry[key] = typeof value === 'object' && value !== null ? value : { title: String(value || key), image: String(value || key) };
        return carry;
      }, {});
    }
  }
  if (['number', 'slider', 'range'].includes(control.type)) {
    if (control.min !== '') {
      params.min = Number(control.min) || 0;
    }
    if (control.max !== '') {
      params.max = Number(control.max) || 100;
    }
    if (control.step !== '') {
      params.step = Number(control.step) || 1;
    }
  }
  if (control.type === 'repeater' && control.repeaterFields.length > 0) {
    params.fields = control.repeaterFields.map((field) => buildControlParams(field));
  }

  return params;
}

function buildSectionPhp(section: WidgetSection): string {
  const params: Record<string, unknown> = { label: section.label };
  if (section.tab !== 'content') {
    params.tab = getTabConstant(section.tab);
  }

  const controlLines = section.controls.map((control) => {
    const cp = buildControlParams(control);
    return "$this->add_control(\n    '" + escapePhpString(control.name) + "',\n    " + formatPhpValue(cp, 2) + "\n);";
  });

  return [
    "$this->start_controls_section(",
    "    '" + escapePhpString(section.name) + "',",
    "    " + formatPhpValue(params, 2),
    ");",
    '',
    ...controlLines,
    '',
    "$this->end_controls_section();"
  ].join('\n');
}

function getGroupControlUseClass(type: string): string | null {
  const map: Record<string, string> = {
    typography: 'Elementor\\Group_Control_Typography',
    background: 'Elementor\\Group_Control_Background',
    border: 'Elementor\\Group_Control_Border',
    box_shadow: 'Elementor\\Group_Control_Box_Shadow',
    text_shadow: 'Elementor\\Group_Control_Text_Shadow',
    filter: 'Elementor\\Group_Control_Css_Filter',
    transform: 'Elementor\\Group_Control_Transform',
    animation: 'Elementor\\Group_Control_Animation',
    hover_animation: 'Elementor\\Group_Control_Transition',
    motion_fx: 'Elementor\\Group_Control_Transition',
    dimensions: 'Elementor\\Group_Control_Dimensions',
    position: 'Elementor\\Group_Control_Position',
    image_size: 'Elementor\\Group_Control_Image_Size',
    image_dimensions: 'Elementor\\Group_Control_Image_Size'
  };

  return map[type] ?? null;
}

function getUseStatements(project: BuilderProject): string[] {
  const imports = new Set<string>(['use Elementor\\Widget_Base;', 'use Elementor\\Controls_Manager;']);

  for (const widget of project.widgets ?? []) {
    for (const section of widget.sections ?? []) {
      for (const control of section.controls ?? []) {
        const resolved = getGroupControlUseClass(control.type);
        if (resolved) {
          imports.add(`use ${resolved};`);
        }
      }
    }
  }

  if (project.sections) {
    for (const section of project.sections) {
      for (const control of section.controls ?? []) {
        const resolved = getGroupControlUseClass(control.type);
        if (resolved) {
          imports.add(`use ${resolved};`);
        }
      }
    }
  }

  return Array.from(imports);
}

export function generateWidgetPhp(project: BuilderProject): string {
  const widget = project.widgets?.[0] ?? {
    id: 'widget-default',
    name: project.widgetName ?? 'default_widget',
    title: project.title ?? 'Default Widget',
    className: project.className ?? 'Default_Widget',
    icon: project.icon ?? 'eicon-text',
    textDomain: project.textDomain ?? 'default',
    groupId: 'group-custom',
    sections: project.sections ?? []
  };

  const sections = (widget.sections ?? []).map((section) => buildSectionPhp(section)).join('\n\n');
  const useStatements = getUseStatements(project);

  return [
    '<?php',
    '',
    ...useStatements,
    '',
    `class ${widget.className} extends Widget_Base {`,
    '',
    '    public function get_name() {',
    `        return '${escapePhpString(widget.name)}';`,
    '    }',
    '',
    '    public function get_title() {',
    `        return __( '${escapePhpString(widget.title)}', '${escapePhpString(widget.textDomain)}' );`,
    '    }',
    '',
    '    public function get_icon() {',
    `        return '${escapePhpString(widget.icon)}';`,
    '    }',
    '',
    '    protected function register_controls() {',
    sections,
    '    }',
    '',
    '    protected function render() {',
    "        $settings = $this->get_settings_for_display();",
    '',
    "        echo '<div class=\"trilbdev-widget\">';",
    '',
    "        if ( ! empty( $settings['widget_title'] ) ) {",
    "            echo '<h3>' . esc_html( $settings['widget_title'] ) . '</h3>';",
    '        }',
    '',
    "        echo '</div>';",
    '    }',
    '}'
  ].join('\n');
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export class ElementorBuilderPanel {
  private static instance: ElementorBuilderPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly workspaceFolder?: vscode.WorkspaceFolder;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.workspaceFolder = workspaceFolder;
    this.bindMessages();
    this.refresh();
  }

  public static createOrShow(context: vscode.ExtensionContext): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const activeProject = loadProjectConfig(workspaceFolder);
    const existing = ElementorBuilderPanel.instance;

    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.One, true);
      existing.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'elementorBuilder',
      'Elementor Widget Builder',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
      }
    );

    ElementorBuilderPanel.instance = new ElementorBuilderPanel(panel, context.extensionUri, workspaceFolder);
    panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, activeProject);
  }

  private refresh(): void {
    const project = loadProjectConfig(this.workspaceFolder);
    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri, project);
  }

  private bindMessages(): void {
    this.panel.onDidDispose(() => {
      ElementorBuilderPanel.instance = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: any) => {
      switch (message.type) {
        case 'generate': {
          const project = message.state as BuilderProject;
          const code = generateWidgetPhp(project);
          const configPath = saveProjectConfig(project, this.workspaceFolder);
          this.panel.webview.postMessage({ type: 'code', code, configPath });
          break;
        }
        case 'save-project': {
          try {
            const project = message.state as BuilderProject;
            const currentWorkspaceFolder = getCurrentWorkspaceFolder(this.workspaceFolder);
            const configPath = saveProjectConfig(project, currentWorkspaceFolder);
            this.panel.webview.postMessage({ type: 'saved', configPath });
          } catch (error) {
            const messageText = error instanceof Error ? error.message : 'Project could not be saved.';
            this.panel.webview.postMessage({ type: 'save-error', error: messageText });
          }
          break;
        }
        case 'copy-code': {
          await vscode.env.clipboard.writeText(message.code as string);
          vscode.window.showInformationMessage('Widget PHP copied to clipboard.');
          break;
        }
        case 'insert-code': {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showWarningMessage('Open a PHP file before inserting the generated widget.');
            break;
          }
          editor.edit((editBuilder) => {
            editBuilder.replace(editor.selection, message.code as string);
          });
          break;
        }
        default:
          break;
      }
    });
  }
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, project: BuilderProject): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const nonce = getNonce();
  const stateJson = JSON.stringify(project).replace(/</g, '\\u003C').replace(/>/g, '\\u003E');

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline' https:; font-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource} https:;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Elementor Builder</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" />
    <style>
      html, body, #root { margin: 0; height: 100%; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }
      body { padding: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">
      window.__INITIAL_STATE__ = ${stateJson};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
}
