import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as vscode from 'vscode';

import { ControlCentrePanel } from '../controlCentrePanel';
import { generateWidgetPhp } from '../elementorBuilderPanel';
import { handleSidebarWebviewMessage } from '../elementorBuilderSidebarView';
import { getWebviewApi } from '../webview/controlCentre';
import { getStoredProjectPage } from '../webview/controlCentre/Sidebar';
import { updateProjectAssetCollection } from '../webview/controlCentre/ProjectAssets';
import { getControlActionOptions, getControlTypeOptions, updateProjectControlCollection } from '../webview/controlCentre/ProjectControls';
import { getDynamicTagActionOptions, updateProjectDynamicTagCollection } from '../webview/controlCentre/ProjectDynamicTags';
import { getFormActionOptions, updateProjectFormActionCollection } from '../webview/controlCentre/ProjectFormActions';
import { getFormFieldActionOptions, updateProjectFormFieldCollection } from '../webview/controlCentre/ProjectFormFields';
import { getFinderCategoryActionOptions, updateProjectFinderCategoryCollection } from '../webview/controlCentre/ProjectFinder';
import { getThemeConditionActionOptions, updateProjectThemeConditionCollection } from '../webview/controlCentre/ProjectThemeConditions';
import { getThemeLocationActionOptions, updateProjectThemeLocationCollection } from '../webview/controlCentre/ProjectThemeLocations';
import { controlTypeDefinitions, getPickerOptionDefaultValue, getWidgetCategoryActionOptions, resolvePickerOptionMeta, sanitizeWidgetCategoryName, updateProjectWidgetCategoryCollection } from '../webview/controlCentre/ProjectWidgets';
import { getElementorIconOptions, normalizeElementorIconClass } from '../webview/elementorIcons';
import { compactGroupSlug } from '../types';
import { ensureProjectConfig, getActiveWorkspaceFileUri, getCurrentWorkspaceFolder, getProjectConfigPath, loadProjectConfig, prepareProjectWorkspaceFolder, projectWizard, saveProjectConfig } from '../projectConfig';
import { hasProjectBeenCreated } from '../types';
import {
	CONTROL_ARGUMENTS,
	CONTROL_TYPES,
	GROUP_CONTROL_TYPES,
	createDefaultProject
} from '../types';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	setup(async () => {
		ensureProjectConfig();
		const extension = vscode.extensions.all.find((candidate) => candidate.packageJSON?.name === 'trilbdev-elementor-builder-vscode');
		if (extension && !extension.isActive) {
			await extension.activate();
		}
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('elementor icon normalization preserves the Elementor prefix and exposes the available icon set', () => {
		assert.strictEqual(normalizeElementorIconClass('text'), 'eicon-text');
		assert.strictEqual(normalizeElementorIconClass('eicon-posts-ticker'), 'eicon-posts-ticker');
		assert.strictEqual(normalizeElementorIconClass('editor-link'), 'eicon-editor-link');
		assert.ok(getElementorIconOptions().includes('eicon-editor-link'));
		assert.ok(getElementorIconOptions().includes('eicon-text'));
	});

	test('project page selection persists so saves keep the user on the current page', () => {
		const originalStorage = globalThis.sessionStorage;
		Object.defineProperty(globalThis, 'sessionStorage', {
			value: {
				getItem: () => 'projectAssets',
				setItem: () => undefined
			},
			configurable: true,
			writable: true
		});

		try {
			assert.strictEqual(getStoredProjectPage(), 'projectAssets');
		} finally {
			Object.defineProperty(globalThis, 'sessionStorage', {
				value: originalStorage,
				configurable: true,
				writable: true
			});
		}
	});

	test('project asset collection persists script and style entries before the config is written', () => {
		const project = createDefaultProject();
		const withScript = updateProjectAssetCollection(project, 'script', {
			name: 'main-script',
			src: '/assets/js/main.js',
			dependsOn: 'jquery',
			version: '1.0.0',
			inFooter: true
		});
		const withStyles = updateProjectAssetCollection(withScript, 'style', {
			name: 'main-style',
			src: '/assets/css/main.css',
			dependsOn: '',
			version: '2.0.0',
			inFooter: false
		});

		assert.strictEqual(withStyles.projectAssets?.scripts.length, 1);
		assert.strictEqual(withStyles.projectAssets?.styles.length, 1);
		assert.strictEqual(withStyles.projectAssets?.scripts[0]?.name, 'main-script');
		assert.strictEqual(withStyles.projectAssets?.styles[0]?.name, 'main-style');
		assert.strictEqual(withStyles.projectAssets?.styles[0]?.src, '/assets/css/main.css');
	});

	test('uses the live VS Code postMessage bridge instead of a no-op fallback', () => {
		const liveApi = { postMessage: () => undefined } as const;
		const originalWindow = (globalThis as any).window;
		Object.defineProperty(globalThis, 'window', {
			value: { __elementorBuilderVsCodeApi: liveApi },
			configurable: true,
			writable: true
		});

		try {
			const resolved = getWebviewApi();
			assert.strictEqual(resolved, liveApi);
		} finally {
			Object.defineProperty(globalThis, 'window', {
				value: originalWindow,
				configurable: true,
				writable: true
			});
		}
	});

	test('control management uses the Elementor add/remove model with radio-group actions', () => {
		const actions = getControlActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Control');
		assert.strictEqual(actions[1].label, 'Remove Control');
	});

	test('control type metadata and collection updates match the Elementor schema contract', () => {
		const types = getControlTypeOptions();
		assert.ok(types.some((entry) => entry.value === 'text' && entry.label === 'Text'));
		assert.ok(types.some((entry) => entry.value === 'select' && entry.label === 'Select'));
		assert.ok(types.some((entry) => entry.value === 'switcher' && entry.label === 'Switcher'));

		const project = createDefaultProject();
		const nextProject = updateProjectControlCollection(project, {
			id: '',
			name: 'My Heading',
			description: 'Primary heading control',
			type: 'text',
			action: 'add'
		});

		assert.strictEqual(nextProject.controls?.length, 1);
		assert.strictEqual(nextProject.controls?.[0]?.name, 'my_heading');
		assert.strictEqual(nextProject.controls?.[0]?.description, 'Primary heading control');
	});

	test('select controls manage default selection via option rows instead of a standalone default field', () => {
		const selectFields = controlTypeDefinitions.select.fields.map((field) => field.key) as string[];
		const select2Fields = controlTypeDefinitions.select2.fields.map((field) => field.key) as string[];

		assert.ok(!selectFields.includes('defaultValue'));
		assert.ok(!select2Fields.includes('defaultValue'));
		assert.ok(selectFields.includes('options'));
		assert.ok(select2Fields.includes('options'));
	});

	test('code controls export language and rows without placeholder output', () => {
		const project = createDefaultProject();
		project.widgets = [{
			id: 'widget-1',
			name: 'test_widget',
			title: 'Test Widget',
			className: 'Test_Widget',
			icon: 'eicon-code',
			textDomain: 'test',
			groupId: 'group-1',
			sections: [{
				id: 'section-1',
				name: 'content',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'code-1',
					name: 'code_snippet',
					label: 'Code snippet',
					type: 'code',
					description: 'Example code control',
					defaultValue: '<div>hi</div>',
					placeholder: '',
					language: 'php',
					rows: '12',
					options: '',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.ok(code.includes("'language' => 'php'"));
		assert.ok(code.includes("'rows' => 12"));
		assert.ok(!code.includes("'placeholder' => '"));
	});

	test('dynamic, frontend, and AI control metadata are exported in the generated Elementor config', () => {
		const project = createDefaultProject();
		project.widgets = [{
			id: 'widget-1',
			name: 'test_widget',
			title: 'Test Widget',
			className: 'Test_Widget',
			icon: 'eicon-code',
			textDomain: 'test',
			groupId: 'group-1',
			sections: [{
				id: 'section-1',
				name: 'content',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'ai-1',
					name: 'custom_code',
					label: 'Custom code',
					type: 'code',
					description: 'Code that also supports AI help.',
					defaultValue: 'console.log("hi")',
					placeholder: '',
					language: 'javascript',
					rows: '8',
					options: '',
					condition: '',
					dynamicContent: true,
					frontendAvailable: true,
					enableAI: true,
					aiType: 'code',
					aiLanguage: 'html',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.ok(code.includes("'dynamic' => true"));
		assert.ok(code.includes("'frontend_available' => true"));
		assert.ok(code.includes("'ai' => ["));
		assert.ok(code.includes("'type' => 'code'"));
		assert.ok(code.includes("'language' => 'html'"));
	});

	test('grouped select controls serialize nested option groups into Elementor arrays', () => {
		const project = createDefaultProject();
		project.widgets = [{
			id: 'widget-1',
			name: 'test_widget',
			title: 'Test Widget',
			className: 'Test_Widget',
			icon: 'eicon-select',
			textDomain: 'test',
			groupId: 'group-1',
			sections: [{
				id: 'section-1',
				name: 'content',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'select-1',
					name: 'layout',
					label: 'Layout',
					type: 'select',
					description: 'Choose layout',
					defaultValue: 'default',
					placeholder: '',
					inputType: 'text',
					title: '',
					language: '',
					rows: '',
					options: 'layout_group: Layout\n  one: One\n  two: Two',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.ok(code.includes("'layout_group' => ["));
		assert.ok(code.includes("'label' => 'Layout'"));
		assert.ok(code.includes("'one' => 'One'"));
		assert.ok(code.includes("'two' => 'Two'"));
	});

	test('dynamic tag management uses the same add/remove model and Elementor group metadata', () => {
		const actions = getDynamicTagActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Dynamic Tag');
		assert.strictEqual(actions[1].label, 'Remove Dynamic Tag');
	});

	test('form action management is add-only and matches the Elementor action metadata shape', () => {
		const actions = getFormActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add']);
		assert.strictEqual(actions[0].label, 'Add Form Action');

		const project = createDefaultProject();
		const nextProject = updateProjectFormActionCollection(project, {
			id: '',
			name: 'Send Email',
			title: 'Send Email',
			description: 'Send the submitted form by email.',
			group: 'email',
			action: 'add'
		});

		assert.strictEqual(nextProject.formActions?.length, 1);
		assert.strictEqual(nextProject.formActions?.[0]?.name, 'send_email');
		assert.strictEqual(nextProject.formActions?.[0]?.description, 'Send the submitted form by email.');
		assert.strictEqual(nextProject.formActions?.[0]?.data?.group, 'email');
	});

	test('form field management uses the Elementor add/remove model and field metadata', () => {
		const actions = getFormFieldActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Form Field');
		assert.strictEqual(actions[1].label, 'Remove Form Field');

		const project = createDefaultProject();
		const nextProject = updateProjectFormFieldCollection(project, {
			id: '',
			name: 'Phone Number',
			title: 'Phone Number',
			description: 'Collect a contact number.',
			fieldType: 'tel',
			required: true,
			action: 'add'
		});

		assert.strictEqual(nextProject.formFields?.length, 1);
		assert.strictEqual(nextProject.formFields?.[0]?.name, 'phone_number');
		assert.strictEqual(nextProject.formFields?.[0]?.description, 'Collect a contact number.');
		assert.strictEqual(nextProject.formFields?.[0]?.data?.field_type, 'tel');
		assert.strictEqual(nextProject.formFields?.[0]?.data?.required, true);
	});

	test('dynamic tag collection updates match the Elementor schema contract', () => {
		const project = createDefaultProject();
		const nextProject = updateProjectDynamicTagCollection(project, {
			id: '',
			name: 'Site Name',
			title: 'Site Name',
			description: 'Returns the site name.',
			group: 'site',
			categories: ['text'],
			action: 'add'
		});

		assert.strictEqual(nextProject.dynamicTags?.length, 1);
		assert.strictEqual(nextProject.dynamicTags?.[0]?.name, 'site_name');
		assert.strictEqual(nextProject.dynamicTags?.[0]?.description, 'Returns the site name.');
		assert.strictEqual(nextProject.dynamicTags?.[0]?.data?.group, 'site');
		assert.deepStrictEqual(nextProject.dynamicTags?.[0]?.data?.categories, ['text']);
	});

	test('theme condition management uses the Elementor add/remove model and condition metadata', () => {
		const actions = getThemeConditionActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Theme Condition');
		assert.strictEqual(actions[1].label, 'Remove Theme Condition');

		const project = createDefaultProject();
		const nextProject = updateProjectThemeConditionCollection(project, {
			id: '',
			name: 'Archive Page',
			title: 'Archive Page',
			description: 'Display on archive pages.',
			group: 'archive',
			conditionType: 'archive',
			action: 'add'
		});

		assert.strictEqual(nextProject.themeConditions?.length, 1);
		assert.strictEqual(nextProject.themeConditions?.[0]?.name, 'archive_page');
		assert.strictEqual(nextProject.themeConditions?.[0]?.description, 'Display on archive pages.');
		assert.strictEqual(nextProject.themeConditions?.[0]?.data?.group, 'archive');
		assert.strictEqual(nextProject.themeConditions?.[0]?.data?.condition_type, 'archive');
	});

	test('theme location management uses the Elementor add/remove model and location metadata', () => {
		const actions = getThemeLocationActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Theme Location');
		assert.strictEqual(actions[1].label, 'Remove Theme Location');

		const project = createDefaultProject();
		const nextProject = updateProjectThemeLocationCollection(project, {
			id: '',
			name: 'Header Location',
			title: 'Header Location',
			description: 'Registers the header template area.',
			location: 'header',
			action: 'add'
		});

		assert.strictEqual(nextProject.themeLocations?.length, 1);
		assert.strictEqual(nextProject.themeLocations?.[0]?.name, 'header_location');
		assert.strictEqual(nextProject.themeLocations?.[0]?.description, 'Registers the header template area.');
		assert.strictEqual(nextProject.themeLocations?.[0]?.data?.location, 'header');
	});

	test('finder category management uses the Elementor add/remove model and category metadata', () => {
		const actions = getFinderCategoryActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Finder Category');
		assert.strictEqual(actions[1].label, 'Remove Finder Category');

		const project = createDefaultProject();
		const nextProject = updateProjectFinderCategoryCollection(project, {
			id: '',
			name: 'My Tools',
			title: 'My Tools',
			description: 'Custom tools for the Elementor finder.',
			icon: 'eicon-tools',
			keywords: 'tools,admin',
			action: 'add'
		});

		assert.strictEqual(nextProject.finderCategories?.length, 1);
		assert.strictEqual(nextProject.finderCategories?.[0]?.name, 'my_tools');
		assert.strictEqual(nextProject.finderCategories?.[0]?.description, 'Custom tools for the Elementor finder.');
		assert.strictEqual(nextProject.finderCategories?.[0]?.data?.icon, 'eicon-tools');
		assert.deepStrictEqual(nextProject.finderCategories?.[0]?.data?.keywords, ['tools', 'admin']);
	});

	test('a fresh project starts empty and does not auto-create a default widget group', () => {
		const project = createDefaultProject();
		assert.deepStrictEqual(project.widgetGroups, []);
		assert.deepStrictEqual(project.widgets, []);
	});

	test('widget category management uses the Elementor add/remove category model and persists the category payload', () => {
		const actions = getWidgetCategoryActionOptions();
		assert.deepStrictEqual(actions.map((action) => action.value), ['add', 'remove']);
		assert.strictEqual(actions[0].label, 'Add Widget Category');
		assert.strictEqual(actions[1].label, 'Remove Widget Category');

		const project = createDefaultProject();
		const nextProject = updateProjectWidgetCategoryCollection(project, {
			id: '',
			categoryName: 'General',
			categoryTitle: 'General',
			categoryIcon: 'eicon-posts-ticker',
			action: 'add'
		});

		assert.strictEqual(nextProject.widgetGroups?.length, 1);
		assert.strictEqual(nextProject.widgetGroups?.[0]?.slug, 'general');
		assert.strictEqual(nextProject.widgetGroups?.[0]?.text, 'General');
		assert.strictEqual(nextProject.widgetGroups?.[0]?.id, 'group-general');
		assert.strictEqual(nextProject.widgetGroups?.[0]?.icon, 'eicon-posts-ticker');
		assert.strictEqual(nextProject.widgets?.length, 0);
	});

	test('widget category names are normalized to underscore slugs and reject invalid characters', () => {
		assert.strictEqual(sanitizeWidgetCategoryName('My Travel & Tours'), 'my_travel_tours');
		assert.strictEqual(sanitizeWidgetCategoryName('  SPECIAL   CATS  '), 'special_cats');
		assert.strictEqual(sanitizeWidgetCategoryName('CategoryName'), 'categoryname');
		assert.strictEqual(sanitizeWidgetCategoryName('my category 123'), 'my_category_123');
		assert.ok(/^[a-z0-9_]+$/.test(sanitizeWidgetCategoryName('My New Category!')));
	});

	test('deleting a widget category can preserve widgets or remove them with the delete toggle', () => {
		const project = createDefaultProject();
		project.widgetGroups = [{ id: 'group-general', slug: 'general', text: 'General' }, { id: 'group-custom', slug: 'custom', text: 'Custom' }];
		project.widgets = [
			{ id: 'widget-1', name: 'example_widget', title: 'Example Widget', description: 'Example', icon: 'eicon-text', textDomain: 'elementor', groupId: 'group-general', className: 'Example_Widget', sections: [], keywords: ['example'] },
			{ id: 'widget-2', name: 'other_widget', title: 'Other Widget', description: 'Other', icon: 'eicon-text', textDomain: 'elementor', groupId: 'group-custom', className: 'Other_Widget', sections: [], keywords: ['other'] }
		];

		const keepWidgets = updateProjectWidgetCategoryCollection(project, {
			selectedWidgetCategoryId: 'group-general',
			action: 'remove',
			deleteWidgets: false,
			categoryName: 'general'
		});

		assert.strictEqual(keepWidgets.widgetGroups.some((group) => group.id === 'group-general'), false);
		assert.strictEqual(keepWidgets.widgets.some((widget) => widget.id === 'widget-1'), true);
		assert.strictEqual(keepWidgets.widgets.find((widget) => widget.id === 'widget-1')?.groupId, 'group-custom');

		const removeWidgets = updateProjectWidgetCategoryCollection(project, {
			selectedWidgetCategoryId: 'group-general',
			action: 'remove',
			deleteWidgets: true,
			categoryName: 'general'
		});

		assert.strictEqual(removeWidgets.widgetGroups.some((group) => group.id === 'group-general'), false);
		assert.strictEqual(removeWidgets.widgets.some((widget) => widget.id === 'widget-1'), false);
	});

	test('uses the displayed workspace root name to target the active project folder', () => {
		const firstFolder = { uri: vscode.Uri.file(path.join(os.tmpdir(), 'eb-workspace-one')), name: 'workspace-one', index: 0 } as vscode.WorkspaceFolder;
		const secondFolder = { uri: vscode.Uri.file(path.join(os.tmpdir(), 'eb-workspace-two')), name: 'workspace-two', index: 1 } as vscode.WorkspaceFolder;
		const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			value: [firstFolder, secondFolder],
			configurable: true,
			writable: true
		});

		try {
			const resolvedFolder = getCurrentWorkspaceFolder(undefined, 'workspace-two');
			assert.ok(resolvedFolder);
			assert.strictEqual(resolvedFolder.uri.fsPath, secondFolder.uri.fsPath);
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalWorkspaceFolders,
				configurable: true,
				writable: true
			});
		}
	});

	test('openControlCentre command is registered and executes without error', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('trilbdev-elementor-builder-vscode.openControlCentre'));

		await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.openControlCentre');
		assert.ok(true);
	});

	test('saves the project in the hidden .elementor-builder directory with project settings metadata', () => {
		const project = createDefaultProject();
		project.projectName = 'PluginName';
		const configPath = saveProjectConfig(project);
		assert.ok(configPath.includes('.elementor-builder'));
		assert.ok(configPath.endsWith('eb-project-pluginname.json'));

		const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
		assert.ok(raw.ProjectSettings && typeof raw.ProjectSettings === 'object');
		assert.strictEqual((raw.ProjectSettings as Record<string, unknown>).psr4Enabled, false);
		assert.strictEqual((raw.ProjectSettings as Record<string, unknown>).widgetsEnabled, false);
		assert.strictEqual((raw.ProjectSettings as Record<string, unknown>).enableFinder, false);
		assert.strictEqual((raw.ProjectSettings as Record<string, unknown>).enableControls, false);
		assert.ok((raw.widgets as Record<string, unknown>).general === undefined || Array.isArray((raw.widgets as Record<string, unknown>).general));
	});

	test('uses a lower-case sanitized project name when building the config filename', () => {
		const project = createDefaultProject();
		project.projectName = 'My Elementor Plugin';
		const configPath = saveProjectConfig(project);
		assert.ok(configPath.endsWith('eb-project-myelementorplugin.json'));
	});

	test('detects an existing saved project JSON file when no project name is supplied', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-detect-existing-'));
		const workspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder;
		const project = createDefaultProject();
		project.projectName = 'Existing Project';
		project.projectVersion = '2.0.0';
		const configDir = path.join(tempDir, '.elementor-builder');
		fs.mkdirSync(configDir, { recursive: true });
		const expectedPath = path.join(configDir, 'eb-project-existingproject.json');
		fs.writeFileSync(expectedPath, JSON.stringify(project, null, 2));

		try {
			assert.strictEqual(path.normalize(getProjectConfigPath(workspaceFolder)).toLowerCase(), path.normalize(expectedPath).toLowerCase());
			const loaded = loadProjectConfig(workspaceFolder);
			assert.strictEqual(loaded.projectName, 'Existing Project');
			assert.strictEqual(loaded.projectVersion, '2.0.0');
		} finally {
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('sidebar save-project webview messages create the project files in the active workspace', async () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-sidebar-message-'));
		const sentMessages: Array<{ type?: string; error?: string; configPath?: string }> = [];
		const projectConfigModule = require('../projectConfig') as {
			saveProjectConfig: typeof import('../projectConfig').saveProjectConfig;
			getCurrentWorkspaceFolder: typeof import('../projectConfig').getCurrentWorkspaceFolder;
		};
		const originalSaveProjectConfig = projectConfigModule.saveProjectConfig;
		const originalGetCurrentWorkspaceFolder = projectConfigModule.getCurrentWorkspaceFolder;
		const configPath = path.join(tempDir, '.elementor-builder', 'eb-project-sidebarmessage.json');

		projectConfigModule.getCurrentWorkspaceFolder = () => ({
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder);
		projectConfigModule.saveProjectConfig = ((project, _workspaceFolder) => {
			fs.mkdirSync(path.dirname(configPath), { recursive: true });
			fs.writeFileSync(configPath, JSON.stringify(project, null, 2));
			return configPath;
		}) as typeof import('../projectConfig').saveProjectConfig;

		const messageTarget = {
			webview: {
				postMessage: (message: { type?: string; error?: string; configPath?: string }) => sentMessages.push(message)
			}
		} as unknown as vscode.WebviewView;

		try {
			const project = createDefaultProject();
			project.projectName = 'My Project';
			project.projectVersion = '1.0.0';
			project.phpNamespace = 'MyPlugin\\Elementor';
			project.projectPrefix = 'myproject';
			project.textDomain = 'my-project';

			await handleSidebarWebviewMessage({ type: 'save-project', state: project }, messageTarget);

			assert.ok(fs.existsSync(configPath), 'The sidebar webview should save the project to disk.');
			assert.ok(sentMessages.some((message) => message.type === 'saved' && message.configPath === configPath));
		} finally {
			projectConfigModule.getCurrentWorkspaceFolder = originalGetCurrentWorkspaceFolder;
			projectConfigModule.saveProjectConfig = originalSaveProjectConfig;
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('save-project messages from the wizard are processed from message.state and create files in the workspace', async () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-message-state-'));
		const sentMessages: Array<{ type?: string; error?: string; configPath?: string }> = [];
		const projectConfigModule = require('../projectConfig') as {
			saveProjectConfig: typeof import('../projectConfig').saveProjectConfig;
			getCurrentWorkspaceFolder: typeof import('../projectConfig').getCurrentWorkspaceFolder;
		};
		const originalSaveProjectConfig = projectConfigModule.saveProjectConfig;
		const originalGetCurrentWorkspaceFolder = projectConfigModule.getCurrentWorkspaceFolder;
		const configPath = path.join(tempDir, '.elementor-builder', 'eb-project-wizardmessagetest.json');

		projectConfigModule.getCurrentWorkspaceFolder = () => ({
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder);
		projectConfigModule.saveProjectConfig = ((project, _workspaceFolder) => {
			fs.mkdirSync(path.dirname(configPath), { recursive: true });
			fs.writeFileSync(configPath, JSON.stringify(project, null, 2));
			return configPath;
		}) as typeof import('../projectConfig').saveProjectConfig;

		const panel = {
			webview: {
				postMessage: (message: { type?: string; error?: string; configPath?: string }) => sentMessages.push(message),
				asWebviewUri: (uri: vscode.Uri) => uri,
				cspSource: 'vscode-resource:',
				onDidReceiveMessage: (_listener: unknown) => ({ dispose: () => undefined })
			},
			onDidDispose: () => undefined,
			reveal: () => undefined
		} as unknown as vscode.WebviewPanel;

		try {
			const instance = new (ControlCentrePanel as any)(panel, vscode.Uri.file(tempDir));
			const project = createDefaultProject();
			project.projectName = 'Wizard Message Test';
			project.projectVersion = '1.0.0';
			project.phpNamespace = 'MyPlugin\\Elementor';
			project.projectPrefix = '';
			project.textDomain = 'wizard-message-test';

			await instance.handleMessage({ type: 'save-project', state: project });

			assert.ok(fs.existsSync(configPath), 'The project config should be created from the wizard save message.');
			assert.ok(sentMessages.some((message) => message.type === 'saved' && message.configPath === configPath));
		} finally {
			projectConfigModule.getCurrentWorkspaceFolder = originalGetCurrentWorkspaceFolder;
			projectConfigModule.saveProjectConfig = originalSaveProjectConfig;
			fs.rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test('creates the actual project config, module folders, and widget files in the workspace', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-files-'));
		const workspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder;

		const project = createDefaultProject();
		project.projectName = 'ActualCreate';
		project.projectVersion = '1.0.0';
		project.phpNamespace = 'MyPlugin\\Elementor';
		project.projectPrefix = 'eb_';
		project.textDomain = 'my-plugin';
		project.projectSettings = {
			psr4Enabled: true,
			widgetsEnabled: true,
			enableFinder: true,
			enableControls: true,
			enableDynamicTags: true,
			enableThemeConditions: true,
			enableThemeLocations: true,
			enableFormFields: true,
			enableFormActions: true,
			enableContextMenus: true
		};
		project.widgetGroups = [{ id: 'group-main', slug: 'main', text: 'Main' }];
		project.widgets = [{
			id: 'widget-1',
			groupId: 'group-main',
			name: 'hero_banner',
			title: 'Hero Banner',
			className: 'Hero_Banner',
			icon: 'eicon-banner',
			textDomain: 'my-plugin',
			sections: [{
				id: 'section-content',
				name: 'content',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'heading_text',
					name: 'heading_text',
					label: 'Heading Text',
					type: 'text',
					description: 'Hero heading',
					defaultValue: 'Welcome',
					placeholder: 'Enter heading',
					options: '',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];
		project.sections = project.widgets[0].sections;

		const configPath = saveProjectConfig(project, workspaceFolder);
		const projectRoot = path.join(tempDir, '.elementor-builder');
		const widgetFilePath = path.join(projectRoot, 'widgets', 'hero_banner.json');
		const configData = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
		const widgetData = JSON.parse(fs.readFileSync(widgetFilePath, 'utf8')) as Record<string, unknown>;

		assert.ok(fs.existsSync(projectRoot));
		assert.ok(fs.existsSync(configPath));
		assert.ok(fs.existsSync(path.join(projectRoot, 'dynamic-tags')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'finder-categories')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'controls')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'theme-conditions')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'theme-locations')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'form-fields')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'form-actions')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'context-menus')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'widgets')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'widgets', 'templates')));
		assert.ok(fs.existsSync(path.join(projectRoot, 'widgets', 'templates', 'content')));
		assert.ok(fs.existsSync(widgetFilePath));
		assert.strictEqual(configData.ProjectName, 'ActualCreate');
		assert.strictEqual((configData.ProjectSettings as Record<string, unknown>).widgetsEnabled, true);
		assert.ok((widgetData.widgetControls as Record<string, unknown>)['content-section']);
		assert.strictEqual((widgetData.widgetTitle as string), 'Hero Banner');

		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('control serialization keeps only the fields relevant to the selected control type', () => {
		const project = createDefaultProject();
		project.widgetGroups = [{ id: 'group-accesspress', slug: 'accesspress', text: 'AccessPress', icon: 'eicon-posts-ticker' }];
		project.widgets = [{
			id: 'widget-1',
			name: 'login_form',
			title: 'Login Form',
			className: 'Login_Form',
			icon: 'eicon-lock',
			textDomain: 'elementor',
			groupId: 'group-accesspress',
			sections: [{
				id: 'section-1',
				name: 'content',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'testing-field',
					name: 'testing_field',
					label: 'Testing Field',
					type: 'text',
					description: 'This is a Test control field',
					defaultValue: '',
					placeholder: 'Enter your value Here',
					inputType: 'text',
					title: 'testing',
					language: 'javascript',
					rows: '4',
					alpha: false,
					enableSelectors: false,
					selectors: '',
					options: '',
					condition: '',
					min: '',
					max: '',
					step: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					repeaterFields: []
				}]
			}]
		}];

		const configPath = saveProjectConfig(project);
		const projectRoot = path.dirname(configPath);
		const widgetFilePath = path.join(projectRoot, 'widgets', 'login_form.json');
		const widgetData = JSON.parse(fs.readFileSync(widgetFilePath, 'utf8')) as Record<string, unknown>;
		const controlData = ((widgetData.widgetControls as Record<string, unknown>)['content-section'] as Record<string, unknown>).controls as Record<string, unknown>;
		const serialized = controlData.testing_field as Record<string, unknown>;

		assert.deepStrictEqual(Object.keys(serialized).sort(), ['condition', 'defaultValue', 'description', 'enableSelectors', 'inputType', 'label', 'labelBlock', 'placeholder', 'selectors', 'separator', 'showLabel', 'type'].sort());
		assert.ok(!('default' in serialized));
		assert.ok(!('language' in serialized));
		assert.ok(!('alpha' in serialized));
		assert.ok(!('title' in serialized));
		assert.ok(!('rows' in serialized));
		assert.ok(!('min' in serialized));
	});

	test('addWidgetGroup command updates project state and keeps control center routing', async () => {
		saveProjectConfig(createDefaultProject());
		const before = loadProjectConfig().widgetGroups.length;

		await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.addWidgetGroup');

		const after = loadProjectConfig().widgetGroups.length;
		assert.strictEqual(after, before + 1);
	});

	test('addWidget command updates project state and keeps control center routing', async () => {
		saveProjectConfig(createDefaultProject());
		const before = loadProjectConfig().widgets.length;

		await vscode.commands.executeCommand('trilbdev-elementor-builder-vscode.addWidget');

		const after = loadProjectConfig().widgets.length;
		assert.strictEqual(after, before + 1);
	});

	test('Project defaults are empty unless Elementor requires a value', () => {
		const project = createDefaultProject();
		assert.strictEqual(project.projectName, '');
		assert.strictEqual(project.projectVersion, '');
		assert.strictEqual(project.phpNamespace, '');
		assert.strictEqual(project.textDomain, '');
		assert.strictEqual(project.widgetGroups.length, 0);
		assert.strictEqual(project.widgets.length, 0);
		assert.strictEqual(project.projectSettings.psr4Enabled, false);
		assert.strictEqual(project.projectSettings.widgetsEnabled, false);
		assert.strictEqual(project.projectSettings.enableFinder, false);
		assert.strictEqual(project.projectSettings.enableControls, false);
		assert.strictEqual(project.projectSettings.enableDynamicTags, false);
		assert.strictEqual(project.projectSettings.enableThemeConditions, false);
		assert.strictEqual(project.projectSettings.enableThemeLocations, false);
		assert.strictEqual(project.projectSettings.enableFormFields, false);
		assert.strictEqual(project.projectSettings.enableFormActions, false);
		assert.strictEqual(project.projectSettings.enableContextMenus, false);
	});
	test('Project save fails clearly when no workspace folder is open', () => {
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		try {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: [],
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: undefined,
				configurable: true,
				writable: true
			});

			assert.throws(() => saveProjectConfig(createDefaultProject()), /Open a workspace folder/i);
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: originalEditor,
				configurable: true,
				writable: true
			});
		}
	});
	test('Blank project setup is not created until the wizard completes', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-hidden-'));
		const workspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder;

		const configPath = getProjectConfigPath(workspaceFolder);
		assert.strictEqual(fs.existsSync(path.dirname(configPath)), false);
		assert.strictEqual(fs.existsSync(configPath), false);
		const loaded = loadProjectConfig(workspaceFolder);
		assert.strictEqual(loaded.projectName, '');
		assert.strictEqual(fs.existsSync(path.dirname(configPath)), false);
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('workspace setup prepares the hidden project folder before saving the config', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-setup-folder-'));
		const workspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: 'temp-project',
			index: 0
		} as vscode.WorkspaceFolder;

		const configDir = prepareProjectWorkspaceFolder(workspaceFolder, 'Wizard Start');
		assert.ok(configDir.endsWith(path.join('.elementor-builder')));
		assert.ok(fs.existsSync(configDir));
		assert.ok(fs.existsSync(path.join(configDir, 'eb-project-wizardstart.json')) === false, 'The config file should not be written until the final project save step.');
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('Project creation saves into the active workspace folder when no explicit folder is supplied', () => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-current-workspace-'));
		const workspaceFolder = {
			uri: vscode.Uri.file(tempDir),
			name: 'current-workspace',
			index: 0
		} as vscode.WorkspaceFolder;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			value: [workspaceFolder],
			configurable: true,
			writable: true
		});
		Object.defineProperty(vscode.window, 'activeTextEditor', {
			value: { document: { uri: vscode.Uri.file(path.join(tempDir, 'plugin.php')) } },
			configurable: true,
			writable: true
		});

		const project = createDefaultProject();
		project.projectName = 'CurrentWorkspace';
		const configPath = saveProjectConfig(project);
		const expectedPrefix = path.join(tempDir, '.elementor-builder');
		assert.ok(path.normalize(configPath).toLowerCase().startsWith(path.normalize(expectedPrefix).toLowerCase()));
		assert.ok(fs.existsSync(path.join(tempDir, '.elementor-builder')));

		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			value: originalFolders,
			configurable: true,
			writable: true
		});
		Object.defineProperty(vscode.window, 'activeTextEditor', {
			value: originalEditor,
			configurable: true,
			writable: true
		});
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	test('ignores VS Code output panes when resolving the active workspace', () => {
		const firstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-output-first-'));
		const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-output-second-'));
		const firstFolder = { uri: vscode.Uri.file(firstDir), name: 'first-output', index: 0 } as vscode.WorkspaceFolder;
		const secondFolder = { uri: vscode.Uri.file(secondDir), name: 'second-output', index: 1 } as vscode.WorkspaceFolder;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		try {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: [firstFolder, secondFolder],
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: {
					document: {
						uri: vscode.Uri.from({ scheme: 'vscode-output', path: 'Microsoft Entra External ID' })
					}
				},
				configurable: true,
				writable: true
			});

			assert.strictEqual(getActiveWorkspaceFileUri(), undefined);
			assert.strictEqual(getCurrentWorkspaceFolder()?.uri.fsPath, firstFolder.uri.fsPath);
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: originalEditor,
				configurable: true,
				writable: true
			});
			fs.rmSync(firstDir, { recursive: true, force: true });
			fs.rmSync(secondDir, { recursive: true, force: true });
		}
	});

	test('Project creation falls back to the first workspace folder when no active file resolves the current window target', () => {
		const firstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-window-first-'));
		const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-window-second-'));
		const firstFolder = { uri: vscode.Uri.file(firstDir), name: 'first-window', index: 0 } as vscode.WorkspaceFolder;
		const secondFolder = { uri: vscode.Uri.file(secondDir), name: 'second-window', index: 1 } as vscode.WorkspaceFolder;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		try {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: [firstFolder, secondFolder],
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: undefined,
				configurable: true,
				writable: true
			});

			const currentFolder = getCurrentWorkspaceFolder();
			assert.strictEqual(currentFolder?.uri.fsPath, firstFolder.uri.fsPath);

			const project = createDefaultProject();
			project.projectName = 'FallbackFolder';
			const configPath = saveProjectConfig(project);
			const expectedPrefix = path.join(firstDir, '.elementor-builder');
			assert.ok(path.normalize(configPath).toLowerCase().startsWith(path.normalize(expectedPrefix).toLowerCase()));
			assert.ok(fs.existsSync(path.join(firstDir, '.elementor-builder')));
			assert.ok(!fs.existsSync(path.join(secondDir, '.elementor-builder')));
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: originalEditor,
				configurable: true,
				writable: true
			});
			fs.rmSync(firstDir, { recursive: true, force: true });
			fs.rmSync(secondDir, { recursive: true, force: true });
		}
	});

	test('Project creation uses the active workspace folder when multiple folders are open', () => {
		const firstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-first-workspace-'));
		const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-second-workspace-'));
		const firstFolder = { uri: vscode.Uri.file(firstDir), name: 'first-workspace', index: 0 } as vscode.WorkspaceFolder;
		const secondFolder = { uri: vscode.Uri.file(secondDir), name: 'second-workspace', index: 1 } as vscode.WorkspaceFolder;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		const originalGetWorkspaceFolder = vscode.workspace.getWorkspaceFolder;
		try {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: [firstFolder, secondFolder],
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: { document: { uri: vscode.Uri.file(path.join(secondDir, 'child.php')) } },
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.workspace, 'getWorkspaceFolder', {
				value: (uri: vscode.Uri) => uri.fsPath.startsWith(secondDir) ? secondFolder : firstFolder,
				configurable: true,
				writable: true
			});

			const detected = getCurrentWorkspaceFolder(secondFolder);
			assert.strictEqual(detected?.uri.fsPath, secondFolder.uri.fsPath);

			const project = createDefaultProject();
			project.projectName = 'MultiWorkspace';
			const configPath = saveProjectConfig(project, secondFolder);
			const expectedPrefix = path.join(secondDir, '.elementor-builder');
			assert.ok(path.normalize(configPath).toLowerCase().startsWith(path.normalize(expectedPrefix).toLowerCase()));
			assert.ok(fs.existsSync(path.join(secondDir, '.elementor-builder')));
			assert.ok(!fs.existsSync(path.join(firstDir, '.elementor-builder')));
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: originalEditor,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.workspace, 'getWorkspaceFolder', {
				value: originalGetWorkspaceFolder,
				configurable: true,
				writable: true
			});
			fs.rmSync(firstDir, { recursive: true, force: true });
			fs.rmSync(secondDir, { recursive: true, force: true });
		}
	});

	test('prefers the workspace folder that already contains a saved project when no editor resolves a target folder', () => {
		const firstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-preferred-first-'));
		const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-preferred-second-'));
		const firstFolder = { uri: vscode.Uri.file(firstDir), name: 'first-preferred', index: 0 } as vscode.WorkspaceFolder;
		const secondFolder = { uri: vscode.Uri.file(secondDir), name: 'second-preferred', index: 1 } as vscode.WorkspaceFolder;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalEditor = vscode.window.activeTextEditor;
		try {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: [firstFolder, secondFolder],
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: undefined,
				configurable: true,
				writable: true
			});

			const project = createDefaultProject();
			project.projectName = 'Existing Project';
			fs.mkdirSync(path.join(secondDir, '.elementor-builder'), { recursive: true });
			fs.writeFileSync(path.join(secondDir, '.elementor-builder', 'eb-project-existingproject.json'), JSON.stringify(project, null, 2));

			const resolved = getCurrentWorkspaceFolder();
			assert.ok(resolved);
			assert.strictEqual(path.normalize(resolved.uri.fsPath).toLowerCase(), path.normalize(secondDir).toLowerCase());
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			Object.defineProperty(vscode.window, 'activeTextEditor', {
				value: originalEditor,
				configurable: true,
				writable: true
			});
			fs.rmSync(firstDir, { recursive: true, force: true });
			fs.rmSync(secondDir, { recursive: true, force: true });
		}
	});

	test('Project wizard completion is stored in the config file and detected by the shared projectWizard check', () => {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-project-wizard-'));
		const originalFolders = vscode.workspace.workspaceFolders;
		const workspaceFolder = { uri: vscode.Uri.file(tempRoot), name: 'wizard-test', index: 0 } as vscode.WorkspaceFolder;
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			value: [workspaceFolder],
			configurable: true,
			writable: true
		});

		try {
			const project = createDefaultProject();
			project.projectName = 'Wizard Project';
			project.projectVersion = '1.2.3';
			const configPath = saveProjectConfig(project, workspaceFolder);
			const saved = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
			assert.strictEqual(saved.ProjectWizardComplete, true);
			assert.strictEqual(projectWizard(workspaceFolder), true);
		} finally {
			Object.defineProperty(vscode.workspace, 'workspaceFolders', {
				value: originalFolders,
				configurable: true,
				writable: true
			});
			fs.rmSync(tempRoot, { recursive: true, force: true });
		}
	});

	test('counts a project as created when widget groups or widgets exist even without a project name', () => {
		const project = createDefaultProject();
		assert.strictEqual(hasProjectBeenCreated(project), false);

		project.widgetGroups.push({
			id: 'group-one',
			slug: 'group-one',
			text: 'Group One'
		});
		assert.strictEqual(hasProjectBeenCreated(project), true);

		const widgetProject = createDefaultProject();
		widgetProject.widgets.push({
			id: 'widget-one',
			name: 'widget-one',
			title: 'Widget One',
			className: 'Widget_One',
			icon: 'eicon-text',
			textDomain: 'elementor-builder',
			groupId: 'group-one',
			sections: []
		});
		assert.strictEqual(hasProjectBeenCreated(widgetProject), true);
	});

	test('Group slugs preserve underscores and hyphens', () => {
		assert.strictEqual(compactGroupSlug('My_Group-Name'), 'my_group-name');
		assert.strictEqual(compactGroupSlug('My Group Name'), 'mygroupname');
		assert.strictEqual(compactGroupSlug('  --__   test  '), 'test');
	});

	test('generateWidgetPhp serializes structured condition rows into Elementor condition arrays', () => {
		const project = createDefaultProject();
		project.widgetName = 'demo_widget';
		project.className = 'Demo_Widget';
		project.title = 'Demo Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'demo_widget',
			className: 'Demo_Widget',
			title: 'Demo Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'content-section',
				name: 'content_section',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'text_control',
					name: 'text_control',
					label: 'Text color',
					type: 'color',
					description: 'Example',
					defaultValue: '#ff0000',
					placeholder: '',
					enableSelectors: true,
					selectors: '{{WRAPPER}} .demo => color: {{VALUE}};\n{{WRAPPER}} .demo:hover => color: {{VALUE}};',
					options: '',
					condition: '',
					conditions: [{
						id: 'condition-1',
						equalityCheck: true,
						control: 'layout',
						value: ['boxed', 'wide']
					}],
					tab: 'style',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'condition'\s*=>\s*\[/);
		assert.match(code, /'name'\s*=>\s*'layout'/);
		assert.match(code, /'operator'\s*=>\s*'==='/);
		assert.match(code, /'value'\s*=>\s*\[/);
		assert.match(code, /'boxed'/);
		assert.match(code, /'wide'/);
	});

	test('generateWidgetPhp serializes selectors into Elementor selector arrays', () => {
		const project = createDefaultProject();
		project.widgetName = 'demo_widget';
		project.className = 'Demo_Widget';
		project.title = 'Demo Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'demo_widget',
			className: 'Demo_Widget',
			title: 'Demo Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'content-section',
				name: 'content_section',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'text_control',
					name: 'text_control',
					label: 'Text color',
					type: 'color',
					description: 'Example',
					defaultValue: '#ff0000',
					placeholder: '',
					enableSelectors: true,
					selectors: '{{WRAPPER}} .demo => color: {{VALUE}};\n{{WRAPPER}} .demo:hover => color: {{VALUE}};',
					options: '',
					condition: '',
					tab: 'style',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'selectors'\s*=>\s*\[/);
		assert.match(code, /'\{\{WRAPPER\}\} \.demo'\s*=>\s*'color: \{\{VALUE\}\};'/);
	});

	test('generateWidgetPhp includes alpha toggle for color controls', () => {
		const project = createDefaultProject();
		project.widgetName = 'color_widget';
		project.className = 'Color_Widget';
		project.title = 'Color Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'color_widget',
			className: 'Color_Widget',
			title: 'Color Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'content-section',
				name: 'content_section',
				label: 'Content',
				tab: 'content',
				controls: [{
					id: 'color_control',
					name: 'color_control',
					label: 'Accent color',
					type: 'color',
					description: 'Pick a color',
					defaultValue: '#ff0000',
					placeholder: '',
					alpha: true,
					options: '',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'alpha'\s*=>\s*true/);
	});

	test('generateWidgetPhp serializes choose control options with icon and title metadata', () => {
		const project = createDefaultProject();
		project.widgetName = 'choose_widget';
		project.className = 'Choose_Widget';
		project.title = 'Choose Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'choose_widget',
			className: 'Choose_Widget',
			title: 'Choose Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'choose-section',
				name: 'choose_section',
				label: 'Choose',
				tab: 'style',
				controls: [{
					id: 'choose_control',
					name: 'choose_control',
					label: 'Alignment',
					type: 'choose',
					description: 'Pick a layout.',
					defaultValue: 'left',
					placeholder: '',
					options: 'left:\n  title: Left\n  icon: eicon-text-align-left\nright:\n  title: Right\n  icon: eicon-text-align-right',
					condition: '',
					tab: 'style',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'left'\s*=>\s*\[\s*'title'\s*=>\s*'Left',\s*'icon'\s*=>\s*'eicon-text-align-left'/s);
		assert.match(code, /'right'\s*=>\s*\[\s*'title'\s*=>\s*'Right',\s*'icon'\s*=>\s*'eicon-text-align-right'/s);
	});

	test('generateWidgetPhp serializes font control options and default selection', () => {
		const project = createDefaultProject();
		project.widgetName = 'font_widget';
		project.className = 'Font_Widget';
		project.title = 'Font Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'font_widget',
			className: 'Font_Widget',
			title: 'Font Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'font-section',
				name: 'font_section',
				label: 'Font',
				tab: 'style',
				controls: [{
					id: 'font_control',
					name: 'font_control',
					label: 'Font',
					type: 'font',
					description: 'Choose a font family.',
					defaultValue: 'Poppins',
					placeholder: '',
					options: 'Poppins: Poppins\nMontserrat: Montserrat\nArial: Arial',
					condition: '',
					tab: 'style',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'default'\s*=>\s*'Poppins'/);
		assert.match(code, /'Poppins'\s*=>\s*'Poppins'/);
		assert.match(code, /'Montserrat'\s*=>\s*'Montserrat'/);
	});

	test('generateWidgetPhp serializes date time picker options from flatpickr config', () => {
		const project = createDefaultProject();
		project.widgetName = 'date_widget';
		project.className = 'Date_Widget';
		project.title = 'Date Widget';
		project.icon = 'eicon-calendar';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'date_widget',
			className: 'Date_Widget',
			title: 'Date Widget',
			icon: 'eicon-calendar',
			textDomain: 'demo',
			sections: [{
				id: 'date-section',
				name: 'date_section',
				label: 'Date',
				tab: 'content',
				controls: [{
					id: 'date_control',
					name: 'date_control',
					label: 'Date',
					type: 'date_time',
					description: 'Select a date and time.',
					defaultValue: '2026-10-13 10:30',
					placeholder: 'Choose a date',
					pickerOptions: 'enableTime: true\ntime_24hr: true\nminuteIncrement: 15',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'picker_options'\s*=>\s*\[/);
		assert.match(code, /'enableTime'\s*=>\s*true/);
		assert.match(code, /'time_24hr'\s*=>\s*true/);
		assert.match(code, /'minuteIncrement'\s*=>\s*15/);
	});

	test('generateWidgetPhp preserves a combined flatpickr position value', () => {
		const project = createDefaultProject();
		project.widgetName = 'date_widget';
		project.className = 'Date_Widget';
		project.title = 'Date Widget';
		project.icon = 'eicon-calendar';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'date_widget',
			className: 'Date_Widget',
			title: 'Date Widget',
			icon: 'eicon-calendar',
			textDomain: 'demo',
			sections: [{
				id: 'date-section',
				name: 'date_section',
				label: 'Date',
				tab: 'content',
				controls: [{
					id: 'date_control',
					name: 'date_control',
					label: 'Date',
					type: 'date_time',
					description: 'Select a date and time.',
					defaultValue: '2026-10-13 10:30',
					placeholder: 'Choose a date',
					pickerOptions: 'position: below right',
					condition: '',
					tab: 'content',
					showLabel: true,
					labelBlock: true,
					separator: 'default',
					min: '',
					max: '',
					step: '',
					repeaterFields: []
				}]
			}]
		}];

		const code = generateWidgetPhp(project);
		assert.match(code, /'position'\s*=>\s*'below right'/);
	});

	test('flatpickr defaultDate metadata switches to textarea for multiple and range modes', () => {
		assert.strictEqual(
			resolvePickerOptionMeta('defaultDate', [{ id: 'mode-row', optionKey: 'mode', value: 'multiple', valueType: 'select' }]),
			'textarea'
		);
		assert.strictEqual(
			resolvePickerOptionMeta('defaultDate', [{ id: 'mode-row', optionKey: 'mode', value: 'range', valueType: 'select' }]),
			'textarea'
		);
		assert.strictEqual(
			getPickerOptionDefaultValue('defaultDate', [{ id: 'mode-row', optionKey: 'mode', value: 'multiple', valueType: 'select' }]),
			'2026-10-13, 2026-10-20'
		);
		assert.strictEqual(
			getPickerOptionDefaultValue('defaultDate', [{ id: 'mode-row', optionKey: 'mode', value: 'range', valueType: 'select' }]),
			'2026-10-13 to 2026-10-20'
		);
	});

	test('Includes the official Elementor control set and generator constants', () => {
		const requiredTypes = [
			'text',
			'textarea',
			'number',
			'select',
			'select2',
			'switcher',
			'color',
			'media',
			'url',
			'wysiwyg',
			'icon',
			'slider',
			'choose',
			'font',
			'typography',
			'background',
			'border',
			'box_shadow',
			'text_shadow',
			'filter',
			'transform',
			'animation',
			'hover_animation',
			'motion_fx',
			'dimensions',
			'position',
			'image_dimensions',
			'image_size',
			'entry_animation',
			'device_visibility',
			'custom_css',
			'repeater',
			'query',
			'template',
			'oembed',
			'divider',
			'popover_toggle',
			'tabs',
			'button',
			'date_time'
		];

		for (const value of requiredTypes) {
			assert.ok(CONTROL_TYPES.some((type) => type.value === value), `Expected control type ${value} to be included.`);
		}

		for (const value of ['label', 'description', 'default', 'placeholder', 'options', 'condition', 'selectors', 'dynamic', 'return_value', 'show_label', 'label_block', 'input_type', 'title', 'label_on', 'label_off']) {
			assert.ok(CONTROL_ARGUMENTS.includes(value), `Expected argument ${value} to be included.`);
		}

		assert.ok(CONTROL_ARGUMENTS.includes('return_value'), 'Expected switcher controls to expose a return value argument.');
		assert.ok(CONTROL_ARGUMENTS.includes('label_on'), 'Expected switcher controls to expose an on-label argument.');
		assert.ok(CONTROL_ARGUMENTS.includes('label_off'), 'Expected switcher controls to expose an off-label argument.');

		for (const value of ['typography', 'border', 'background', 'box_shadow', 'text_shadow', 'image_size']) {
			assert.ok(GROUP_CONTROL_TYPES.includes(value), `Expected group control ${value} to be included.`);
		}

		const project = createDefaultProject();
		project.widgetName = 'demo_widget';
		project.className = 'Demo_Widget';
		project.title = 'Demo Widget';
		project.icon = 'eicon-text';
		project.textDomain = 'demo';
		project.widgets = [{
			...project.widgets[0],
			name: 'demo_widget',
			className: 'Demo_Widget',
			title: 'Demo Widget',
			icon: 'eicon-text',
			textDomain: 'demo',
			sections: [{
				id: 'content-section',
				name: 'content_section',
				label: 'Content',
				tab: 'content',
				controls: [
					{
						id: 'typography_control',
						name: 'typography_control',
						label: 'Typography',
						type: 'typography',
						description: '',
						defaultValue: '',
						placeholder: '',
						options: '',
						condition: '',
						tab: 'style',
						showLabel: true,
						labelBlock: true,
						separator: 'default',
						min: '',
						max: '',
						step: '',
						repeaterFields: []
					},
					{
						id: 'background_control',
						name: 'background_control',
						label: 'Background',
						type: 'background',
						description: '',
						defaultValue: '',
						placeholder: '',
						options: '',
						condition: '',
						tab: 'style',
						showLabel: true,
						labelBlock: true,
						separator: 'default',
						min: '',
						max: '',
						step: '',
						repeaterFields: []
					}
				]
			}]
		}];
		project.sections = project.widgets[0]?.sections ?? [];

		const code = generateWidgetPhp(project);

		assert.ok(code.includes('use Elementor\\Widget_Base;'));
		assert.ok(code.includes('use Elementor\\Controls_Manager;'));
		assert.ok(code.includes('use Elementor\\Group_Control_Typography;'));
		assert.ok(code.includes('use Elementor\\Group_Control_Background;'));
		assert.ok(code.includes('Controls_Manager::TYPOGRAPHY'));
		assert.ok(code.includes('Controls_Manager::BACKGROUND'));
	});
});
