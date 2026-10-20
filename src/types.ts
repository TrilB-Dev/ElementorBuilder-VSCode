export type TabKey = 'content' | 'style' | 'advanced' | 'layout';

export interface WidgetControlCondition {
  id: string;
  equalityCheck: boolean;
  control: string;
  value: string[];
}

export interface WidgetControl {
  id: string;
  name: string;
  label: string;
  type: string;
  description: string;
  defaultValue: string;
  placeholder: string;
  inputType?: string;
  multiple?: boolean;
  title?: string;
  language?: string;
  rows?: string;
  columns?: string;
  toggle?: boolean;
  alpha?: boolean;
  pickerOptions?: string;
  options?: string;
  condition?: string;
  conditions?: WidgetControlCondition[];
  labelOn?: string;
  labelOff?: string;
  returnValue?: string;
  enableSelectors?: boolean;
  selectors?: string;
  dynamicContent?: boolean;
  frontendAvailable?: boolean;
  enableAI?: boolean;
  aiType?: string;
  aiLanguage?: string;
  aiCategory?: string;
  tab: TabKey;
  showLabel: boolean;
  labelBlock: boolean;
  separator: 'default' | 'before' | 'after';
  min: string;
  max: string;
  step: string;
  repeaterFields: WidgetControl[];
}

export interface WidgetSection {
  id: string;
  name: string;
  label: string;
  tab: TabKey;
  controls: WidgetControl[];
}

export interface WidgetGroup {
  id: string;
  text: string;
  slug: string;
  icon?: string;
}

export interface ElementorWidget {
  id: string;
  name: string;
  title: string;
  description?: string;
  className: string;
  icon: string;
  textDomain: string;
  groupId: string;
  sections: WidgetSection[];
  keywords?: string[];
}

export interface ProjectSettings {
  psr4Enabled: boolean;
  widgetsEnabled: boolean;
  enableFinder: boolean;
  enableControls: boolean;
  enableDynamicTags: boolean;
  enableThemeConditions: boolean;
  enableThemeLocations: boolean;
  enableFormFields: boolean;
  enableFormActions: boolean;
  enableContextMenus: boolean;
}

export interface ProjectAssetEntry {
  id: string;
  name: string;
  src: string;
  dependsOn: string;
  version: string;
  inFooter: boolean;
}

export interface ProjectAssetCollection {
  scripts: ProjectAssetEntry[];
  styles: ProjectAssetEntry[];
}

export interface ProjectEntityEntry {
  id: string;
  name: string;
  description: string;
  data?: Record<string, unknown>;
}

export interface BuilderProject {
  projectName: string;
  projectVersion: string;
  projectWizardComplete?: boolean;
  phpNamespace: string;
  widgetNamespace: string;
  templateNamespace: string;
  finderNamespace: string;
  controlsNamespace: string;
  tagsNamespace: string;
  themeConditionsNamespace: string;
  themeLocationsNamespace: string;
  formFieldsNamespace: string;
  formActionsNamespace: string;
  contextMenusNamespace: string;
  projectPrefix: string;
  /** @deprecated Use projectPrefix instead. */
  classPrefix?: string;
  textDomain: string;
  projectSettings: ProjectSettings;
  widgetGroups: WidgetGroup[];
  widgets: ElementorWidget[];
  projectAssets?: ProjectAssetCollection;
  controls?: ProjectEntityEntry[];
  contextMenus?: ProjectEntityEntry[];
  dynamicTags?: ProjectEntityEntry[];
  finderCategories?: ProjectEntityEntry[];
  formFields?: ProjectEntityEntry[];
  formActions?: ProjectEntityEntry[];
  themeConditions?: ProjectEntityEntry[];
  themeLocations?: ProjectEntityEntry[];
  widgetName?: string;
  className?: string;
  title?: string;
  icon?: string;
  sections?: WidgetSection[];
}

export const compactGroupSlug = (value: string): string => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '')
  .replace(/^[-_]+|[-_]+$/g, '') || 'group';

export const hasProjectBeenCreated = (project?: Partial<BuilderProject>): boolean => {
  if (!project) {
    return false;
  }

  const projectName = typeof project.projectName === 'string' ? project.projectName.trim() : '';
  const widgetGroupCount = Array.isArray(project.widgetGroups) ? project.widgetGroups.length : 0;
  const widgetCount = Array.isArray(project.widgets) ? project.widgets.length : 0;
  const wizardComplete = project.projectWizardComplete === true;

  return Boolean(projectName || widgetGroupCount > 0 || widgetCount > 0 || wizardComplete);
};

export const CONTROL_ARGUMENTS: string[] = [
  'label',
  'description',
  'default',
  'placeholder',
  'input_type',
  'title',
  'language',
  'rows',
  'columns',
  'toggle',
  'alpha',
  'picker_options',
  'options',
  'condition',
  'selectors',
  'dynamic',
  'frontend_available',
  'ai',
  'return_value',
  'label_on',
  'label_off',
  'show_label',
  'label_block',
  'min',
  'max',
  'step',
  'range',
  'size_units',
  'device_args',
  'fields_options',
  'exclude',
  'include',
  'frontend_available',
  'render_type',
  'separator',
  'tab'
];

export const GROUP_CONTROL_TYPES: string[] = [
  'typography',
  'border',
  'background',
  'box_shadow',
  'text_shadow',
  'image_size',
  'image_dimensions',
  'dimensions',
  'position',
  'filter',
  'transform',
  'animation',
  'hover_animation'
];

export const CONTROL_TYPE_GROUPS: Record<string, string[]> = {
  standard: [
    'text',
    'textarea',
    'number',
    'select',
    'select2',
    'switcher',
    'checkbox',
    'radio',
    'color',
    'media',
    'gallery',
    'url',
    'wysiwyg',
    'code',
    'hidden',
    'html',
    'icon',
    'slider',
    'range',
    'choose',
    'visual_choice',
    'font',
    'heading',
    'raw_html',
    'notice',
    'prompt',
    'divider',
    'button',
    'date_time'
  ],
  group: [
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
    'image_size'
  ],
  popovers: ['popover_toggle'],
  responsive: ['device_visibility', 'position', 'dimensions', 'image_dimensions', 'image_size'],
  tabs: ['tabs']
};

export const CONTROL_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'select2', label: 'Select 2' },
  { value: 'switcher', label: 'Switcher' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'color', label: 'Color' },
  { value: 'media', label: 'Media' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'url', label: 'URL' },
  { value: 'wysiwyg', label: 'WYSIWYG' },
  { value: 'code', label: 'Code' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'html', label: 'HTML' },
  { value: 'icon', label: 'Icon' },
  { value: 'slider', label: 'Slider' },
  { value: 'range', label: 'Range' },
  { value: 'choose', label: 'Choose' },
  { value: 'visual_choice', label: 'Visual Choice' },
  { value: 'font', label: 'Font' },
  { value: 'typography', label: 'Typography' },
  { value: 'background', label: 'Background' },
  { value: 'border', label: 'Border' },
  { value: 'box_shadow', label: 'Box Shadow' },
  { value: 'text_shadow', label: 'Text Shadow' },
  { value: 'filter', label: 'Filter' },
  { value: 'transform', label: 'Transform' },
  { value: 'animation', label: 'Animation' },
  { value: 'hover_animation', label: 'Hover Animation' },
  { value: 'motion_fx', label: 'Motion FX' },
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'position', label: 'Position' },
  { value: 'image_dimensions', label: 'Image Dimensions' },
  { value: 'image_size', label: 'Image Size' },
  { value: 'entry_animation', label: 'Entry Animation' },
  { value: 'device_visibility', label: 'Device Visibility' },
  { value: 'custom_css', label: 'Custom CSS' },
  { value: 'repeater', label: 'Repeater' },
  { value: 'section', label: 'Section' },
  { value: 'tabs', label: 'Tabs' },
  { value: 'popover_toggle', label: 'Popover Toggle' },
  { value: 'query', label: 'Query' },
  { value: 'template', label: 'Template' },
  { value: 'oembed', label: 'OEmbed' },
  { value: 'divider', label: 'Divider' },
  { value: 'button', label: 'Button' },
  { value: 'date_time', label: 'Date & Time' },
  { value: 'heading', label: 'Heading' },
  { value: 'raw_html', label: 'Raw HTML' },
  { value: 'notice', label: 'Notice' },
  { value: 'prompt', label: 'Prompt' }
];

export function makeWidgetGroup(text: string): WidgetGroup {
  const normalized = text.trim() || 'Custom';
  const slug = compactGroupSlug(normalized);
  return {
    id: `group-${slug || 'custom'}`,
    text: normalized,
    slug: slug || 'custom',
    icon: 'eicon-posts-ticker'
  };
}

export function createDefaultWidget(groupId = 'group-custom'): ElementorWidget {
  const defaultSections: WidgetSection[] = [
    {
      id: 'content-section',
      name: 'content_section',
      label: 'Content',
      tab: 'content',
      controls: [
        {
          id: 'widget_title',
          name: 'widget_title',
          label: 'Widget Title',
          type: 'text',
          description: '',
          defaultValue: '',
          placeholder: 'Type your widget title',
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
        }
      ]
    }
  ];

  const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const uniqueName = `trilbdev_widget_${uniqueSuffix}`;

  return {
    id: `widget-${uniqueSuffix}`,
    name: uniqueName,
    title: 'Trilbdev Widget',
    className: uniqueName
      .split(/[_-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('_'),
    icon: 'eicon-text',
    textDomain: 'trilbdev',
    groupId,
    sections: defaultSections
  };
}

export function createDefaultProject(): BuilderProject {
  return {
    projectName: '',
    projectVersion: '',
    projectWizardComplete: false,
    phpNamespace: '',
    widgetNamespace: '',
    templateNamespace: '',
    finderNamespace: '',
    controlsNamespace: '',
    tagsNamespace: '',
    themeConditionsNamespace: '',
    themeLocationsNamespace: '',
    formFieldsNamespace: '',
    formActionsNamespace: '',
    contextMenusNamespace: '',
    projectPrefix: '',
    textDomain: '',
    projectSettings: {
      psr4Enabled: false,
      widgetsEnabled: false,
      enableFinder: false,
      enableControls: false,
      enableDynamicTags: false,
      enableThemeConditions: false,
      enableThemeLocations: false,
      enableFormFields: false,
      enableFormActions: false,
      enableContextMenus: false
    },
    widgetGroups: [],
    widgets: [],
    projectAssets: {
      scripts: [],
      styles: []
    },
    controls: [],
    contextMenus: [],
    dynamicTags: [],
    finderCategories: [],
    formFields: [],
    formActions: [],
    themeConditions: [],
    themeLocations: [],
    widgetName: '',
    className: '',
    title: '',
    icon: '',
    sections: []
  };
}
