import * as React from 'react';
import { Accordion, Badge, Button, Form, InputGroup, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ElementorWidget, type TabKey, type WidgetControl, type WidgetSection } from '../../types';
import { ElementorIconPicker } from '../ElementorIconPicker';

export type WidgetCategoryAction = 'add' | 'remove';

export type WidgetCategoryDraft = {
  id: string;
  categoryName: string;
  categoryTitle: string;
  categoryIcon: string;
  action: WidgetCategoryAction;
  selectedWidgetCategoryId: string;
  deleteWidgets?: boolean;
};

export type WidgetDraft = {
  id: string;
  categoryId: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  keywords: string;
  sections: WidgetSection[];
};

type SelectOptionRow = {
  id: string;
  label: string;
  name: string;
  title?: string;
  icon?: string;
  image?: string;
  isDefault: boolean;
};

type SelectOptionGroup = {
  id: string;
  label: string;
  name: string;
  options: SelectOptionRow[];
};

type SelectorRow = {
  id: string;
  selector: string;
  css: string;
};

type PickerOptionRow = {
  id: string;
  optionKey: string;
  value: string;
  valueType: 'text' | 'number' | 'boolean' | 'textarea' | 'function' | 'select' | 'position';
};

type ControlConditionRow = {
  id: string;
  equalityCheck: boolean;
  control: string;
  value: string[];
};

const createSelectOptionRow = (id: string, name = '', label = '', isDefault = false, title = '', icon = '', image = ''): SelectOptionRow => ({
  id,
  name,
  label,
  title,
  icon,
  image,
  isDefault
});

export const sanitizeWidgetCategoryName = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'custom';
};

const normalizeWidgetCategoryName = (value: string): string => sanitizeWidgetCategoryName(value);

const isValidWidgetCategoryName = (value: string): boolean => /^[a-z0-9_]+$/.test((value ?? '').trim());

const normalizeWidgetName = (value: string): string => {
  const name = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return name || 'custom_widget';
};

const getWidgetNameFromTitle = (value: string): string => normalizeWidgetName(value);

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '1rem'
};

const formFullWidthStyle: React.CSSProperties = {
  gridColumn: '1 / -1'
};

const formHelperTextStyle: React.CSSProperties = {
  color: 'var(--vscode-editor-foreground)'
};

const widgetModalDialogStyles = `
  .widget-modal-dialog {
    max-width: 90vw !important;
    width: 90vw !important;
  }
`;

export const controlTypeDefinitions = {
  select: {
    title: 'Select Control',
    description: 'Single-select dropdown with a list of options.',
    docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-select/',
    fields: [
      { key: 'options', label: 'Options', type: 'text', help: 'Define the available choices and mark the default directly on the selected option row.' }
    ]
  },
  select2: {
    title: 'Select2 Control',
    description: 'Enhanced dropdown for searchable or multi-select style option picking.',
    docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-select2/',
    fields: [
      { key: 'options', label: 'Options', type: 'text', help: 'Define the available choices and mark the default directly on the selected option row.' }
    ]
  }
} as const;

export const getWidgetCategoryActionOptions = () => [
  { value: 'add', label: 'Add Widget Category' },
  { value: 'remove', label: 'Remove Widget Category' }
] as const;

export const updateProjectWidgetCategoryCollection = (
  project: BuilderProject,
  draft: Partial<WidgetCategoryDraft>
): BuilderProject => {
  const existingGroups = Array.isArray(project.widgetGroups) ? [...project.widgetGroups] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedCategoryId = draft.selectedWidgetCategoryId || '';
    const normalizedCategoryName = normalizeWidgetCategoryName(draft.categoryName || draft.categoryTitle || '');
    const nextGroups = existingGroups.filter((group) => {
      if (selectedCategoryId && group.id === selectedCategoryId) {
        return false;
      }
      return normalizeWidgetCategoryName(group.slug || group.text || '') !== normalizedCategoryName;
    });

    const deleteWidgets = draft.deleteWidgets === true;
    const fallbackGroup = nextGroups[0] ?? { id: 'group-custom', slug: 'custom', text: 'Custom' };
    const removedGroupWidgets = (project.widgets ?? []).filter((widget) => widget.groupId === selectedCategoryId);
    const keptWidgets = (project.widgets ?? []).filter((widget) => widget.groupId !== selectedCategoryId);

    const preservedWidgets = removedGroupWidgets.map((widget) => ({
      ...widget,
      groupId: deleteWidgets ? widget.groupId : fallbackGroup.id
    }));

    return {
      ...project,
      widgetGroups: deleteWidgets ? nextGroups : (nextGroups.length > 0 ? nextGroups : [fallbackGroup]),
      widgets: deleteWidgets ? keptWidgets : [...keptWidgets, ...preservedWidgets]
    };
  }

  const categoryName = normalizeWidgetCategoryName(draft.categoryName || draft.categoryTitle || '');
  const categoryTitle = (draft.categoryTitle ?? '').trim() || categoryName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const groupId = `group-${categoryName}`;

  const nextGroups = [...existingGroups];
  const index = nextGroups.findIndex((group) => group.slug === categoryName || group.id === groupId);
  const group = {
    id: groupId,
    slug: categoryName,
    text: categoryTitle,
    icon: draft.categoryIcon || nextGroups[index ?? 0]?.icon || 'eicon-posts-ticker'
  };

  if (index >= 0) {
    nextGroups[index] = { ...nextGroups[index], ...group };
  } else {
    nextGroups.push(group);
  }

  return {
    ...project,
    widgetGroups: nextGroups,
    widgets: Array.isArray(project.widgets) ? [...project.widgets] : []
  };
};

export const updateProjectWidgetCollection = (
  project: BuilderProject,
  draft: Partial<WidgetDraft>
): BuilderProject => {
  const existingWidgets = Array.isArray(project.widgets) ? [...project.widgets] : [];
  const categoryId = draft.categoryId || project.widgetGroups[0]?.id || 'group-custom';
  const widgetName = normalizeWidgetName(draft.name || draft.title || '');
  const title = (draft.title ?? '').trim() || widgetName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const icon = (draft.icon ?? '').trim() || 'eicon-text';
  const keywords = (draft.keywords ?? '')
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const nextWidgets = [...existingWidgets];
  const baseId = draft.id || `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextWidget: ElementorWidget = {
    id: baseId,
    name: widgetName,
    title,
    description,
    className: title
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('_'),
    icon,
    textDomain: project.textDomain || 'elementor',
    groupId: categoryId,
    sections: draft.sections && draft.sections.length > 0 ? draft.sections : [],
    keywords
  };

  const targetIndex = nextWidgets.findIndex((widget) => widget.name === widgetName && widget.groupId === categoryId);
  if (targetIndex >= 0) {
    nextWidgets[targetIndex] = { ...nextWidgets[targetIndex], ...nextWidget };
  } else {
    nextWidgets.push(nextWidget);
  }

  return {
    ...project,
    widgets: nextWidgets
  };
};

const getWidgetCategoryCollection = (project: BuilderProject) => project.widgetGroups ?? [];

const getPickerOptionSelectOptions = (optionKey: string): string[] => {
  switch (optionKey) {
    case 'mode':
      return ['single', 'multiple', 'range'];
    case 'monthSelectorType':
      return ['static', 'dropdown'];
    default:
      return [];
  }
};

export const getPickerOptionDefaultValue = (optionKey: string, rows: PickerOptionRow[] = []): string => {
  const normalizedKey = optionKey.trim();
  const modeValue = rows.find((row) => row.optionKey === 'mode')?.value.trim().toLowerCase() ?? 'single';
  const normalizedMode = ['single', 'multiple', 'range'].includes(modeValue) ? modeValue : 'single';

  if (normalizedKey === 'mode') {
    return 'single';
  }

  if (normalizedKey === 'monthSelectorType') {
    return 'static';
  }

  if (normalizedKey === 'position') {
    return 'below';
  }

  if (normalizedKey === 'defaultDate') {
    if (normalizedMode === 'multiple') {
      return '2026-10-13, 2026-10-20';
    }
    if (normalizedMode === 'range') {
      return '2026-10-13 to 2026-10-20';
    }
    return '2026-10-13';
  }

  if (['enableTime', 'noCalendar', 'time_24hr', 'allowInput', 'altInput', 'weekNumbers', 'disableMobile', 'closeOnSelect', 'utc', 'wrap', 'static'].includes(normalizedKey)) {
    return 'true';
  }

  if (['minuteIncrement', 'showMonths'].includes(normalizedKey)) {
    return '15';
  }

  if (getPickerOptionSelectOptions(normalizedKey).length > 0) {
    return getPickerOptionSelectOptions(normalizedKey)[0] ?? '';
  }

  return '';
};

export const resolvePickerOptionMeta = (optionKey: string, rows: PickerOptionRow[] = []): PickerOptionRow['valueType'] => {
  const normalizedKey = optionKey.trim();
  const modeValue = rows.find((row) => row.optionKey === 'mode')?.value.trim().toLowerCase() ?? '';

  if (normalizedKey === 'position') {
    return 'position';
  }

  if (normalizedKey === 'defaultDate') {
    return ['single', ''].includes(modeValue) ? 'text' : 'textarea';
  }

  if (['enableTime', 'noCalendar', 'time_24hr', 'allowInput', 'altInput', 'weekNumbers', 'disableMobile', 'closeOnSelect', 'utc', 'wrap', 'static'].includes(normalizedKey)) {
    return 'boolean';
  }

  if (['minuteIncrement', 'showMonths'].includes(normalizedKey)) {
    return 'number';
  }

  if (['disable', 'enable', 'onChange', 'onOpen', 'onClose', 'onReady', 'onValueUpdate', 'onMonthChange', 'onYearChange', 'onDayCreate'].includes(normalizedKey)) {
    return 'function';
  }

  if (['altFormat', 'altInputClass', 'ariaDateFormat', 'conjunction', 'dateFormat', 'maxDate', 'minDate', 'nextArrow', 'prevArrow', 'defaultDate', 'locale', 'shorthandCurrentMonth', 'inline'].includes(normalizedKey)) {
    return 'text';
  }

  if (getPickerOptionSelectOptions(normalizedKey).length > 0) {
    return 'select';
  }

  return 'text';
};

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '18px',
  background: 'var(--vscode-panel-background)',
  color: 'var(--vscode-editor-foreground)',
  padding: '1.25rem'
};

const categoryStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
  background: 'rgba(128, 128, 128, 0.02)',
  color: 'var(--vscode-editor-foreground)',
  padding: '1rem'
};

export const ProjectWidgets: React.FC<{
  project?: BuilderProject;
  onProjectChange?: (nextProject: BuilderProject) => void;
  onSaveProject?: (nextProject: BuilderProject) => void;
  notify?: (result: { type: 'success' | 'error'; message: string }) => void;
}> = ({
  project = createDefaultProject(),
  onProjectChange = () => undefined,
  onSaveProject = () => undefined,
  notify,
}) => {
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [widgetDialogOpen, setWidgetDialogOpen] = React.useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false);
  const [controlDialogOpen, setControlDialogOpen] = React.useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = React.useState<string | null>(null);
  const [controlEditorWidgetId, setControlEditorWidgetId] = React.useState<string | null>(null);
  const [controlDialogSectionId, setControlDialogSectionId] = React.useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = React.useState<WidgetCategoryDraft>({
    id: '',
    categoryName: '',
    categoryTitle: '',
    categoryIcon: 'eicon-posts-ticker',
    action: 'add',
    selectedWidgetCategoryId: ''
  });
  const [widgetDraft, setWidgetDraft] = React.useState<WidgetDraft>({
    id: '',
    categoryId: project.widgetGroups[0]?.id ?? 'group-custom',
    name: '',
    title: '',
    description: '',
    icon: 'eicon-text',
    keywords: '',
    sections: []
  });
  const [categoryDeleteDialogOpen, setCategoryDeleteDialogOpen] = React.useState(false);
  const [categoryDeleteDraft, setCategoryDeleteDraft] = React.useState<{ categoryId: string; categoryLabel: string; deleteWidgets: boolean }>({
    categoryId: '',
    categoryLabel: '',
    deleteWidgets: false
  });
  const [deleteConfirmation, setDeleteConfirmation] = React.useState<{ open: boolean; label: string; onConfirm: () => void } | null>(null);
  const [sectionDraft, setSectionDraft] = React.useState<{ name: string; label: string; tab: string; conditions: string }>({
    name: '',
    label: '',
    tab: 'content',
    conditions: ''
  });
  const [controlDraft, setControlDraft] = React.useState<{ id: string; name: string; label: string; description: string; defaultValue: string; placeholder: string; inputType: string; multiple: boolean; title: string; language: string; rows: string; columns: string; toggle: boolean; alpha: boolean; pickerOptions: string; options: string; condition: string; conditionsEnabled: boolean; conditions: ControlConditionRow[]; labelOn: string; labelOff: string; returnValue: string; enableSelectors: boolean; selectors: string; dynamicContent: boolean; frontendAvailable: boolean; enableAI: boolean; aiType: string; aiLanguage: string; aiCategory: string; type: string; controlCategory: 'data' | 'multipleValue' | 'unit' | 'ui' | 'group'; tab: string; showLabel: boolean; labelBlock: boolean; separator: 'default' | 'before' | 'after'; min: string; max: string; step: string }>(
    {
      id: '',
      name: '',
      label: '',
      description: '',
      defaultValue: '',
      placeholder: '',
      inputType: 'text',
      multiple: false,
      title: '',
      language: 'javascript',
      rows: '4',
      columns: '2',
      toggle: false,
      alpha: false,
      pickerOptions: '',
      options: '',
      condition: '',
      conditionsEnabled: false,
      conditions: [],
      labelOn: 'On',
      labelOff: 'Off',
      returnValue: 'yes',
      enableSelectors: false,
      selectors: '',
      dynamicContent: false,
      frontendAvailable: false,
      enableAI: false,
      aiType: 'text',
      aiLanguage: 'html',
      aiCategory: 'background',
      type: 'text',
      controlCategory: 'data',
      tab: 'content',
      showLabel: true,
      labelBlock: true,
      separator: 'default',
      min: '',
      max: '',
      step: ''
    }
  );
  const [selectOptionRows, setSelectOptionRows] = React.useState<SelectOptionRow[]>([]);
  const [selectOptionGroups, setSelectOptionGroups] = React.useState<SelectOptionGroup[]>([]);
  const [selectorRows, setSelectorRows] = React.useState<SelectorRow[]>([]);
  const [pickerOptionRows, setPickerOptionRows] = React.useState<PickerOptionRow[]>([]);
  const [enableSelectGrouping, setEnableSelectGrouping] = React.useState(false);

  const normalizeSectionName = (value: string): string => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'section';

  const normalizeControlName = (value: string): string => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'new_control';

  const openSectionDialog = () => {
    setSectionDraft((current) => ({
      ...current,
      name: '',
      label: '',
      tab: current.tab || 'content',
      conditions: ''
    }));
    setSectionDialogOpen(true);
  };

  const categoryList = getWidgetCategoryCollection(project);
  const allWidgets = Array.isArray(project.widgets) ? project.widgets : [];
  const selectedControlWidget = allWidgets.find((entry) => entry.id === controlEditorWidgetId) ?? null;

  const openCategoryDialog = (group?: { id?: string; slug?: string; text?: string; icon?: string }) => {
    setCategoryDraft({
      id: group?.id ?? '',
      categoryName: group?.slug ?? '',
      categoryTitle: group?.text ?? '',
      categoryIcon: group?.icon ?? 'eicon-posts-ticker',
      action: 'add',
      selectedWidgetCategoryId: group?.id ?? ''
    });
    setCategoryDialogOpen(true);
  };

  const openWidgetDialog = (categoryId: string, widget?: ElementorWidget) => {
    setWidgetDraft({
      id: widget?.id ?? '',
      categoryId,
      name: widget?.name ?? '',
      title: widget?.title ?? '',
      description: widget?.description ?? '',
      icon: widget?.icon ?? 'eicon-text',
      keywords: (widget?.keywords ?? []).join(', '),
      sections: widget?.sections ?? []
    });
    setWidgetDialogOpen(true);
  };

  const confirmDelete = (label: string, onConfirm: () => void) => {
    setDeleteConfirmation({ open: true, label, onConfirm });
  };

  const executeDeleteConfirmation = () => {
    if (!deleteConfirmation) {
      return;
    }

    deleteConfirmation.onConfirm();
    setDeleteConfirmation(null);
  };

  const deleteWidget = (widget: ElementorWidget) => {
    const nextProject = {
      ...project,
      widgets: (project.widgets ?? []).filter((entry) => entry.id !== widget.id)
    };

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Widget deleted: ${widget.name}.` });
  };

  const deleteSection = (section: WidgetSection) => {
    if (!selectedControlWidget) {
      return;
    }

    const nextProject = updateProjectWidgetCollection(project, {
      id: selectedControlWidget.id,
      categoryId: selectedControlWidget.groupId,
      name: selectedControlWidget.name,
      title: selectedControlWidget.title,
      description: selectedControlWidget.description ?? '',
      icon: selectedControlWidget.icon,
      keywords: (selectedControlWidget.keywords ?? []).join(', '),
      sections: (selectedControlWidget.sections ?? []).filter((entry) => entry.id !== section.id)
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Section deleted: ${section.name || section.label || 'section'}.` });
  };

  const deleteControl = (section: WidgetSection, control: WidgetControl) => {
    if (!selectedControlWidget) {
      return;
    }

    const nextProject = updateProjectWidgetCollection(project, {
      id: selectedControlWidget.id,
      categoryId: selectedControlWidget.groupId,
      name: selectedControlWidget.name,
      title: selectedControlWidget.title,
      description: selectedControlWidget.description ?? '',
      icon: selectedControlWidget.icon,
      keywords: (selectedControlWidget.keywords ?? []).join(', '),
      sections: (selectedControlWidget.sections ?? []).map((entry) => entry.id === section.id
        ? { ...entry, controls: (entry.controls ?? []).filter((item) => item.id !== control.id) }
        : entry)
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Control deleted: ${control.name}.` });
  };

  const removeCategory = (group: { id: string; slug?: string; text?: string }) => {
    const nextProject = updateProjectWidgetCategoryCollection(project, {
      categoryName: group.slug ?? group.text ?? '',
      selectedWidgetCategoryId: group.id,
      action: 'remove',
      deleteWidgets: categoryDeleteDraft.deleteWidgets
    });

    const removedWidgets = (project.widgets ?? []).filter((widget) => widget.groupId === group.id);

    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'delete-widget-category',
        payload: {
          categoryId: group.id,
          deleteWidgets: categoryDeleteDraft.deleteWidgets,
          removedWidgets
        }
      });
    }

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Widget category removed: ${group.slug ?? group.text ?? 'category'}.` });
    setCategoryDeleteDialogOpen(false);
    setCategoryDeleteDraft({ categoryId: '', categoryLabel: '', deleteWidgets: false });
  };

  const saveCategory = () => {
    const sanitizedName = sanitizeWidgetCategoryName(categoryDraft.categoryName || categoryDraft.categoryTitle || 'custom');
    if (!isValidWidgetCategoryName(sanitizedName) || categoryDraft.categoryName !== sanitizedName) {
      notify?.({ type: 'error', message: 'Widget category names may only contain lowercase letters, numbers, and underscores.' });
      setCategoryDraft((current) => ({ ...current, categoryName: sanitizedName }));
      return;
    }

    const nextProject = updateProjectWidgetCategoryCollection(project, { ...categoryDraft, categoryName: sanitizedName });
    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Widget category saved: ${sanitizedName}.` });
    setCategoryDialogOpen(false);
    setCategoryDraft({
      id: '',
      categoryName: '',
      categoryTitle: '',
      categoryIcon: 'eicon-posts-ticker',
      action: 'add',
      selectedWidgetCategoryId: ''
    });
  };

  const saveWidget = () => {
    const categoryId = widgetDraft.categoryId || project.widgetGroups[0]?.id || 'group-custom';
    const nextName = normalizeWidgetName(widgetDraft.name || widgetDraft.title || 'custom_widget');
    const nextDraft = { ...widgetDraft, categoryId, name: nextName };
    const nextProject = updateProjectWidgetCollection(project, nextDraft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Widget saved: ${nextName}.` });
    setWidgetDialogOpen(false);
    setWidgetDraft({
      id: '',
      categoryId,
      name: '',
      title: '',
      description: '',
      icon: 'eicon-text',
      keywords: '',
      sections: []
    });
  };

  const addSectionToWidget = () => {
    const widget = allWidgets.find((entry) => entry.id === controlEditorWidgetId);
    if (!widget) {
      return;
    }

    const resolvedName = normalizeSectionName(sectionDraft.name || sectionDraft.label || 'section');
    const section: WidgetSection = {
      id: `section-${Date.now()}`,
      name: resolvedName,
      label: sectionDraft.label || resolvedName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      tab: (sectionDraft.tab || 'content').trim() as WidgetSection['tab'],
      controls: []
    };

    const nextProject = updateProjectWidgetCollection(project, {
      id: widget.id,
      categoryId: widget.groupId,
      name: widget.name,
      title: widget.title,
      description: widget.description ?? '',
      icon: widget.icon,
      keywords: (widget.keywords ?? []).join(', '),
      sections: [...(widget.sections ?? []), section]
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `Section added to ${widget.name}.` });
    setSectionDialogOpen(false);
    setSectionDraft({ name: '', label: '', tab: 'content', conditions: '' });
  };

  const controlCategoryOptions = [
    { value: 'data', label: 'Data' },
    { value: 'multipleValue', label: 'Multiple Value' },
    { value: 'unit', label: 'Unit' },
    { value: 'ui', label: 'UI' },
    { value: 'group', label: 'Group' }
  ] as const;

  const controlTypeOptionsByCategory: Record<string, string[]> = {
    data: ['text', 'number', 'textarea', 'wysiwyg', 'code', 'hidden', 'switcher', 'select', 'select2', 'choose', 'visual_choice', 'color', 'font', 'date_time', 'gallery', 'repeater', 'animation', 'exit_animation', 'hover_animation'],
    multipleValue: ['url', 'media', 'image_dimensions', 'icons', 'text_shadow', 'box_shadow'],
    unit: ['slider', 'dimensions'],
    ui: ['heading', 'raw_html', 'button', 'divider', 'alert', 'notice', 'deprecated_notice'],
    group: ['typography', 'text_stroke', 'text_shadow', 'box_shadow', 'border', 'background', 'image_size', 'css_filter']
  };

  const getControlTypeOptions = (category: string) => controlTypeOptionsByCategory[category] ?? controlTypeOptionsByCategory.data;

  const aceLanguageOptions = ['javascript', 'html', 'css', 'php', 'json', 'markdown', 'sql', 'xml', 'yaml', 'typescript', 'scss', 'sass', 'less', 'jsx', 'tsx', 'python', 'java', 'c_cpp', 'csharp', 'ruby', 'swift', 'dart', 'lua', 'plaintext'];

  const flatpickrPickerOptionDefinitions = [
    { value: 'enableTime', label: 'enableTime', valueType: 'boolean' },
    { value: 'noCalendar', label: 'noCalendar', valueType: 'boolean' },
    { value: 'time_24hr', label: 'time_24hr', valueType: 'boolean' },
    { value: 'allowInput', label: 'allowInput', valueType: 'boolean' },
    { value: 'altInput', label: 'altInput', valueType: 'boolean' },
    { value: 'altInputClass', label: 'altInputClass', valueType: 'text' },
    { value: 'altFormat', label: 'altFormat', valueType: 'text' },
    { value: 'ariaDateFormat', label: 'ariaDateFormat', valueType: 'text' },
    { value: 'conjunction', label: 'conjunction', valueType: 'text' },
    { value: 'dateFormat', label: 'dateFormat', valueType: 'text' },
    { value: 'defaultDate', label: 'defaultDate', valueType: 'text' },
    { value: 'minDate', label: 'minDate', valueType: 'text' },
    { value: 'maxDate', label: 'maxDate', valueType: 'text' },
    { value: 'mode', label: 'mode', valueType: 'select' },
    { value: 'monthSelectorType', label: 'monthSelectorType', valueType: 'select' },
    { value: 'nextArrow', label: 'nextArrow', valueType: 'text' },
    { value: 'position', label: 'position', valueType: 'select' },
    { value: 'prevArrow', label: 'prevArrow', valueType: 'text' },
    { value: 'minuteIncrement', label: 'minuteIncrement', valueType: 'number' },
    { value: 'showMonths', label: 'showMonths', valueType: 'number' },
    { value: 'weekNumbers', label: 'weekNumbers', valueType: 'boolean' },
    { value: 'disableMobile', label: 'disableMobile', valueType: 'boolean' },
    { value: 'closeOnSelect', label: 'closeOnSelect', valueType: 'boolean' },
    { value: 'disable', label: 'disable', valueType: 'textarea' },
    { value: 'enable', label: 'enable', valueType: 'textarea' },
    { value: 'onChange', label: 'onChange', valueType: 'function' },
    { value: 'onOpen', label: 'onOpen', valueType: 'function' },
    { value: 'onClose', label: 'onClose', valueType: 'function' },
    { value: 'onReady', label: 'onReady', valueType: 'function' },
    { value: 'onValueUpdate', label: 'onValueUpdate', valueType: 'function' },
    { value: 'onMonthChange', label: 'onMonthChange', valueType: 'function' },
    { value: 'onYearChange', label: 'onYearChange', valueType: 'function' },
    { value: 'onDayCreate', label: 'onDayCreate', valueType: 'function' }
  ] as const;

  const selectorSupportedControlTypes = [
    'text',
    'number',
    'select',
    'switcher',
    'checkbox',
    'radio',
    'color',
    'media',
    'url',
    'icons',
    'slider',
    'range',
    'choose',
    'font',
    'typography',
    'background',
    'border',
    'box_shadow',
    'text_shadow',
    'filter',
    'transform',
    'visual_choice',
    'image_dimensions',
    'dimensions',
    'text_stroke',
    'image_size',
    'css_filter'

  ];

  const supportsSelectorControl = (type: string): boolean => selectorSupportedControlTypes.includes(type);

  const parseSelectorRows = (rawValue: string): SelectorRow[] => {
    if (!rawValue.trim()) {
      return [];
    }

    return rawValue
      .split(/\r?\n/)
      .map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return null;
        }

        const separatorIndex = trimmed.indexOf('=>');
        if (separatorIndex < 0) {
          return {
            id: `selector-${index}-${Date.now()}`,
            selector: trimmed,
            css: ''
          };
        }

        return {
          id: `selector-${index}-${Date.now()}`,
          selector: trimmed.slice(0, separatorIndex).trim(),
          css: trimmed.slice(separatorIndex + 2).trim()
        };
      })
      .filter((row): row is SelectorRow => row !== null && typeof row === 'object');
  };

  const serializeSelectorRows = (rows: SelectorRow[]): string => rows
    .map(({ selector, css }) => {
      const nextSelector = selector.trim();
      const nextCss = css.trim();
      if (!nextSelector && !nextCss) {
        return '';
      }
      return `${nextSelector || '{{WRAPPER}}' } => ${nextCss || 'color: {{VALUE}};'}`;
    })
    .filter(Boolean)
    .join('\n');

  const updateSelectorRows = (rows: SelectorRow[]) => {
    setSelectorRows(rows);
    setControlDraft((current) => ({ ...current, selectors: serializeSelectorRows(rows) }));
  };

  const getPickerOptionSelectOptions = (optionKey: string): string[] => {
    switch (optionKey) {
      case 'mode':
        return ['single', 'multiple', 'range'];
      case 'monthSelectorType':
        return ['static', 'dropdown'];
      default:
        return [];
    }
  };

  const parsePositionOptionValue = (value: string): { vertical: string; horizontal: string } => {
    const trimmed = value.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean).map((part) => part.toLowerCase());
    const vertical = ['auto', 'above', 'below'].includes(parts[0] ?? '') ? parts[0] : 'auto';
    const candidateHorizontal = parts[1] ?? '';
    const horizontal = ['', 'left', 'centre', 'right'].includes(candidateHorizontal) ? candidateHorizontal : '';

    return {
      vertical,
      horizontal
    };
  };

  const serializePositionOptionValue = (vertical: string, horizontal: string): string => {
    const nextVertical = ['auto', 'above', 'below'].includes(vertical) ? vertical : 'auto';
    const nextHorizontal = ['', 'left', 'centre', 'right'].includes(horizontal) ? horizontal : '';

    return nextHorizontal ? `${nextVertical} ${nextHorizontal}` : nextVertical;
  };

  const normalizePickerRows = (rows: PickerOptionRow[]): PickerOptionRow[] => rows
    .map((row) => {
      const optionKey = row.optionKey.trim() || 'enableTime';
      const nextValueType = resolvePickerOptionMeta(optionKey, rows);
      const selectOptions = getPickerOptionSelectOptions(optionKey);
      const nextValue = row.value.trim();
      const fallbackValue = nextValueType === 'position'
        ? 'below'
        : nextValueType === 'boolean'
          ? 'true'
          : nextValueType === 'number'
            ? '15'
            : nextValueType === 'select' && selectOptions.length > 0
              ? selectOptions[0]
              : getPickerOptionDefaultValue(optionKey, rows);

      return {
        ...row,
        optionKey,
        valueType: nextValueType,
        value: nextValue || fallbackValue
      };
    });

  const inferPickerValueType = (rawValue: string): PickerOptionRow['valueType'] => {
    const normalized = rawValue.trim();
    if (/^(true|false)$/i.test(normalized)) {
      return 'boolean';
    }
    if (/^-?\d+(\.\d+)?$/.test(normalized)) {
      return 'number';
    }
    if (/^(function\s*\(|\([^)]*\)\s*=>|=>)/.test(normalized)) {
      return 'function';
    }
    if (normalized.includes(',') || normalized.includes('[') || normalized.includes(']') || normalized.includes('\n')) {
      return 'textarea';
    }
    return 'text';
  };

  const parsePickerOptionRows = (rawValue: string): PickerOptionRow[] => {
    if (!rawValue.trim()) {
      return [];
    }

    return rawValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex < 0) {
          return null;
        }

        const optionKey = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        const definition = flatpickrPickerOptionDefinitions.find((entry) => entry.value === optionKey);
        const valueType = definition?.valueType ?? inferPickerValueType(value);

        return {
          id: `picker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          optionKey,
          value,
          valueType
        };
      })
      .filter((row): row is PickerOptionRow => row !== null && Boolean(row.optionKey));
  };

  const serializePickerOptionRows = (rows: PickerOptionRow[]) => rows
    .map(({ optionKey, value, valueType }) => {
      const key = optionKey.trim();
      if (!key) {
        return '';
      }

      if (valueType === 'boolean') {
        return `${key}: ${/^(true|false)$/i.test(value.trim()) ? value.trim() : 'true'}`;
      }

      if (valueType === 'number') {
        return `${key}: ${Number(value) || 0}`;
      }

      if (valueType === 'textarea' && !value.trim()) {
        return `${key}: ''`;
      }

      return `${key}: ${value.trim() || ''}`;
    })
    .filter(Boolean)
    .join('\n');

  const updatePickerOptionRows = (rows: PickerOptionRow[]) => {
    const normalizedRows = normalizePickerRows(rows).map((row) => {
      if (row.optionKey === 'defaultDate') {
        const nextValueType = resolvePickerOptionMeta('defaultDate', rows);
        const nextValue = row.value.trim() || getPickerOptionDefaultValue('defaultDate', rows);

        return {
          ...row,
          valueType: nextValueType,
          value: nextValue
        };
      }

      return row;
    });

    setPickerOptionRows(normalizedRows);
    setControlDraft((current) => ({
      ...current,
      pickerOptions: serializePickerOptionRows(normalizedRows) || current.pickerOptions
    }));
  };

  const controlTypeDefinitions: Record<string, { title: string; description: string; docsUrl: string; fields: Array<{ key: 'defaultValue' | 'placeholder' | 'options' | 'pickerOptions' | 'condition' | 'min' | 'max' | 'step' | 'description' | 'inputType' | 'title' | 'language' | 'rows' | 'columns' | 'toggle' | 'alpha' | 'checkbox' | 'labelOn' | 'labelOff' | 'returnValue'; label: string; type?: 'text' | 'textarea' | 'number' | 'color' | 'checkbox' | 'select'; options?: string[]; help?: string }> }> = {
    text: {
      title: 'Text Control',
      description: 'Stores a single-line string value for labels, titles, and plain text content.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-text/',
      fields: [
        { key: 'inputType', label: 'Input type', type: 'select', options: ['text', 'email', 'tel', 'password'], help: 'Choose the HTML input type displayed in the editor.' },
        { key: 'defaultValue', label: 'Default value', type: 'text', help: 'Default string value shown in the control.' },
        { key: 'placeholder', label: 'Placeholder', type: 'text', help: 'Text shown when the field is empty.' },
        { key: 'condition', label: 'Condition', type: 'text', help: 'Optional conditions used to show or hide the control.' }
      ]
    },
    number: {
      title: 'Number Control',
      description: 'Used for numeric values that may include min, max, and step constraints.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-number/',
      fields: [
        { key: 'min', label: 'Min', type: 'number' },
        { key: 'max', label: 'Max', type: 'number' },
        { key: 'defaultValue', label: 'Default value', type: 'number', help: 'Initial numeric value.' },
        { key: 'step', label: 'Step', type: 'number' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    textarea: {
      title: 'Textarea Control',
      description: 'Allows multi-line text entry for longer strings and formatted content.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-textarea/',
      fields: [
        { key: 'rows', label: 'Rows', type: 'number', help: 'Number of visible rows in the textarea.' },
        { key: 'defaultValue', label: 'Default value', type: 'textarea', help: 'Initial textarea content.' },
        { key: 'placeholder', label: 'Placeholder', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    wysiwyg: {
      title: 'WYSIWYG Control',
      description: 'Rich-text editor that supports HTML formatting and editorial content entry.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-wysiwyg/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'textarea', help: 'HTML content that loads into the editor.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    code: {
      title: 'Code Control',
      description: 'Used for code snippets, custom CSS, or inline scripts that require raw text input.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-code/',
      fields: [
        { key: 'rows', label: 'Rows', type: 'number', help: 'Number of visible rows in the code editor.' },
        { key: 'language', label: 'Language', type: 'select', options: aceLanguageOptions, help: 'Select the Ace syntax language for highlighting.' },
        { key: 'defaultValue', label: 'Default value', type: 'textarea' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    hidden: {
      title: 'Hidden Control',
      description: 'Stores a value in the widget settings without rendering a visible field.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-hidden/',
      fields: [
        { key: 'defaultValue', label: 'Hidden value', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    switcher: {
      title: 'Switcher Control',
      description: 'Boolean toggle for on/off settings and feature flags.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-switcher/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'text', help: 'String value used when the switcher loads, such as yes or no.' },
        { key: 'labelOn', label: 'Label On', type: 'text', help: 'The label displayed when the switch is enabled.' },
        { key: 'labelOff', label: 'Label Off', type: 'text', help: 'The label displayed when the switch is disabled.' },
        { key: 'returnValue', label: 'Return value', type: 'text', help: 'String returned when the switch is enabled, such as yes or on.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    popover_toggle: {
      title: 'Popover Toggle Control',
      description: 'Expands a popover panel when the user toggles the field.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-popover-toggle/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'text', help: 'Initial label or toggle state.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    select: {
      title: 'Select Control',
      description: 'Single-select dropdown with a list of options.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-select/',
      fields: [
        { key: 'options', label: 'Options', type: 'text', help: 'Define the available choices and mark the default directly on the selected option row.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    select2: {
      title: 'Select2 Control',
      description: 'Enhanced dropdown for searchable or multi-select style option picking.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-select2/',
      fields: [
        { key: 'options', label: 'Options', type: 'text', help: 'Define the available choices and mark the default directly on the selected option row.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    choose: {
      title: 'Choose Control',
      description: 'Presents a visual set of radio-like choices for selecting one option.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-choose/',
      fields: [
        { key: 'toggle', label: 'Toggle', type: 'checkbox', help: 'Enable toggle mode for choose items.' },
        { key: 'defaultValue', label: 'Default value', type: 'select', options: ['left', 'center', 'right'] },
        { key: 'options', label: 'Options', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    visual_choice: {
      title: 'Visual Choice Control',
      description: 'A graphical option selector that uses icons or images to show possible values.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-visual-choice/',
      fields: [
        { key: 'columns', label: 'Columns', type: 'number', help: 'Number of visible columns in the visual choice grid.' },
        { key: 'toggle', label: 'Toggle', type: 'checkbox', help: 'Enable toggle mode for visual choice items.' },
        { key: 'options', label: 'Options', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    color: {
      title: 'Color Control',
      description: 'Picker for choosing colors and alpha values through the widget settings.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-color/',
      fields: [
        { key: 'defaultValue', label: 'Default color', type: 'color' },
        { key: 'alpha', label: 'Alpha', type: 'checkbox', help: 'Whether to allow alpha channel.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    font: {
      title: 'Font Control',
      description: 'Lets the user choose a font family from the site or typography library.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-font/',
      fields: [
        { key: 'defaultValue', label: 'Default font', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    date_time: {
      title: 'Date Time Control',
      description: 'Enables picking date and time values for schedules or event metadata, using flatpickr picker options.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-date-time/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'text', help: 'ISO or display value used when the field loads.' },
        { key: 'placeholder', label: 'Placeholder', type: 'text', help: 'Text shown while no date or time is selected.' },
        { key: 'pickerOptions', label: 'Picker options', type: 'textarea', help: 'Use flatpickr keys like enableTime: true, time_24hr: true, or minuteIncrement: 15.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    gallery: {
      title: 'Gallery Control',
      description: 'Selects one or more media items from the gallery system.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-gallery/',
      fields: [
        { key: 'defaultValue', label: 'Default gallery', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    repeater: {
      title: 'Repeater Control',
      description: 'Builds a repeatable list of controls that can grow dynamically.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-repeater/',
      fields: [
        { key: 'defaultValue', label: 'Default items', type: 'textarea', help: 'Optional JSON-like default value for the repeater items.' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    animation: {
      title: 'Entrance Animation Control',
      description: 'Selects an entrance animation effect for the widget when it appears.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-animation/',
      fields: [
        { key: 'defaultValue', label: 'Default animation', type: 'select', options: ['fadeIn', 'slideInUp', 'zoomIn'] },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    exit_animation: {
      title: 'Exit Animation Control',
      description: 'Chooses an animation used when the widget exits the viewport.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-exit-animation/',
      fields: [
        { key: 'defaultValue', label: 'Default animation', type: 'select', options: ['fadeOut', 'slideOutDown', 'zoomOut'] },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    hover_animation: {
      title: 'Hover Animation Control',
      description: 'Applies motion effects when a user hovers over the widget.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-hover-animation/',
      fields: [
        { key: 'defaultValue', label: 'Default animation', type: 'select', options: ['grow', 'shrink', 'float'] },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    url: {
      title: 'URL Control',
      description: 'Stores a URL value made up of link text, URL, and optional target settings.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-url/',
      fields: [
        { key: 'defaultValue', label: 'Default URL', type: 'text' },
        { key: 'placeholder', label: 'Placeholder', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    media: {
      title: 'Media Control',
      description: 'Selects media assets such as images, videos, or files using the media library.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-media/',
      fields: [
        { key: 'defaultValue', label: 'Default media', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    image_dimensions: {
      title: 'Image Dimensions Control',
      description: 'Controls width and height for image sizing inside a widget.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-image-dimensions/',
      fields: [
        { key: 'defaultValue', label: 'Default size', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    icons: {
      title: 'Icons Control',
      description: 'Selects an icon set or a single icon from the icon library.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-icons/',
      fields: [
        { key: 'defaultValue', label: 'Default icon', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    text_shadow: {
      title: 'Text Shadow Control',
      description: 'Configures text shadow color, blur, horizontal, and vertical offset values.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-text-shadow/',
      fields: [
        { key: 'defaultValue', label: 'Default shadow', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    box_shadow: {
      title: 'Box Shadow Control',
      description: 'Defines box shadow values for element depth and elevation.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-box-shadow/',
      fields: [
        { key: 'defaultValue', label: 'Default shadow', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    slider: {
      title: 'Slider Control',
      description: 'Configures a range slider with minimum, maximum, and step values.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-slider/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'number' },
        { key: 'min', label: 'Min', type: 'number' },
        { key: 'max', label: 'Max', type: 'number' },
        { key: 'step', label: 'Step', type: 'number' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    dimensions: {
      title: 'Dimensions Control',
      description: 'Sets width, height, or spacing for a dimension group in a single control.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-dimensions/',
      fields: [
        { key: 'defaultValue', label: 'Default value', type: 'text' },
        { key: 'min', label: 'Min', type: 'number' },
        { key: 'max', label: 'Max', type: 'number' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    heading: {
      title: 'Heading Control',
      description: 'Displays a heading or label for grouping content inside the widget editor.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-heading/',
      fields: [
        { key: 'defaultValue', label: 'Heading text', type: 'text' }
      ]
    },
    raw_html: {
      title: 'Raw HTML Control',
      description: 'Shows custom HTML markup as a non-editable informational block.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-raw-html/',
      fields: [
        { key: 'defaultValue', label: 'Raw HTML', type: 'textarea' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    button: {
      title: 'Button Control',
      description: 'Creates an action button or trigger inside the editor interface.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-button/',
      fields: [
        { key: 'defaultValue', label: 'Button text', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    divider: {
      title: 'Divider Control',
      description: 'Adds a visual separator between sections in the widget editor.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-divider/',
      fields: [
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    alert: {
      title: 'Alert Control',
      description: 'Displays a non-blocking alert message to help the user understand a setting.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-alert/',
      fields: [
        { key: 'defaultValue', label: 'Alert message', type: 'textarea' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    notice: {
      title: 'Notice Control',
      description: 'Shows a notice or reminder to the user inside a control section.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-notice/',
      fields: [
        { key: 'defaultValue', label: 'Notice text', type: 'textarea' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    deprecated_notice: {
      title: 'Deprecated Notice Control',
      description: 'Displays a deprecation warning when an old or unsupported feature is being used.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/control-deprecated-notice/',
      fields: [
        { key: 'defaultValue', label: 'Warning text', type: 'textarea' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    typography: {
      title: 'Typography Group Control',
      description: 'Groups typography fields like family, size, weight, style, and spacing.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-typography/',
      fields: [
        { key: 'defaultValue', label: 'Default typography', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    text_stroke: {
      title: 'Text Stroke Group Control',
      description: 'Configures text stroke width and color values in a grouped UI.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-text-stroke/',
      fields: [
        { key: 'defaultValue', label: 'Default stroke', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    border: {
      title: 'Border Group Control',
      description: 'Groups border width, style, color, and radius settings into one reusable control.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-border/',
      fields: [
        { key: 'defaultValue', label: 'Default border', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    background: {
      title: 'Background Group Control',
      description: 'Provides grouped background configuration for color, image, position, and attachment.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-background/',
      fields: [
        { key: 'defaultValue', label: 'Default background', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    image_size: {
      title: 'Image Size Group Control',
      description: 'Coordinates image size and fit mode settings in a single grouped control.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-image-size/',
      fields: [
        { key: 'defaultValue', label: 'Default size', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    },
    css_filter: {
      title: 'CSS Filter Group Control',
      description: 'Groups filter values such as blur, brightness, contrast, and saturation.',
      docsUrl: 'https://developers.elementor.com/docs/editor-controls/group-control-css-filter/',
      fields: [
        { key: 'defaultValue', label: 'Default filter', type: 'text' },
        { key: 'condition', label: 'Condition', type: 'text' }
      ]
    }
  };

  const selectOptionControlTypes = ['select', 'select2', 'choose', 'visual_choice', 'font'];

  const normalizeGroupName = (value: string, fallback: string): string => value
    .trim()
    .replace(/[^a-z0-9_]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_') || fallback;

  const parseSelectOptionRows = (rawValue: string): SelectOptionRow[] => {
    if (!rawValue.trim()) {
      return [];
    }

    const lines = rawValue.split(/\r?\n/);
    const rows: SelectOptionRow[] = [];
    let currentRow: SelectOptionRow | null = null;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (/^\s+/.test(line)) {
        if (!currentRow) {
          continue;
        }

        const [key, ...rest] = trimmed.split(/\s*:\s*/);
        if (!key) {
          continue;
        }

        const value = rest.join(':').trim();
        if (key === 'title') {
          currentRow.title = value || currentRow.label || currentRow.name;
          currentRow.label = currentRow.label || value || currentRow.name;
        }

        if (key === 'icon') {
          currentRow.icon = value || currentRow.icon || 'eicon-text';
        }

        if (key === 'image') {
          currentRow.image = value || currentRow.image || '';
        }

        continue;
      }

      const separatorIndex = trimmed.indexOf(':');
      const candidate = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex).trim() : trimmed;
      const candidateLabel = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1).trim() : trimmed;
      currentRow = createSelectOptionRow(
        `option-${index}-${Date.now()}`,
        candidate,
        candidateLabel || candidate,
        false,
        '',
        ''
      );
      rows.push(currentRow);
    }

    return rows;
  };

  const parseSelectOptionGroups = (rawValue: string): { enabled: boolean; groups: SelectOptionGroup[]; rows: SelectOptionRow[] } => {
    const lines = rawValue.split(/\r?\n/);
    const hasIndentedLines = lines.some((line) => /^\s+/.test(line));

    if (!hasIndentedLines) {
      return {
        enabled: false,
        groups: [],
        rows: parseSelectOptionRows(rawValue)
      };
    }

    const groups: SelectOptionGroup[] = [];
    let currentGroup: SelectOptionGroup | null = null;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      if (/^\s+/.test(line)) {
        if (!currentGroup) {
          continue;
        }

        const [optionKey, ...optionParts] = trimmed.split(/\s*:\s*/);
        if (!optionKey || optionParts.length === 0) {
          continue;
        }

        currentGroup.options.push(createSelectOptionRow(
          `option-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          optionKey,
          optionParts.join(':').trim() || optionKey,
          false
        ));
        continue;
      }

      const [groupKey, ...groupParts] = trimmed.split(/\s*:\s*/);
      if (!groupKey || groupParts.length === 0) {
        continue;
      }

      const nextLine = lines.slice(index + 1).find((candidate) => candidate.trim() !== '');
      const isGrouped = Boolean(nextLine && /^\s+/.test(nextLine));
      if (isGrouped) {
        const label = groupParts.join(':').trim() || groupKey;
        const nextGroup: SelectOptionGroup = {
          id: `group-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: normalizeGroupName(groupKey, `group-${groups.length + 1}`),
          label,
          options: []
        };
        groups.push(nextGroup);
        currentGroup = nextGroup;
      } else {
        currentGroup = null;
      }
    }

    return {
      enabled: groups.length > 0,
      groups,
      rows: []
    };
  };

  const serializeSelectOptionRows = (rows: SelectOptionRow[], type: string = controlDraft.type): string => {
    if (type === 'choose') {
      return rows
        .map(({ name, title, icon }) => {
          const trimmedName = (name || title || '').trim();
          const trimmedTitle = (title || name || 'Option').trim();
          const trimmedIcon = (icon || 'eicon-text').trim();

          if (!trimmedName) {
            return '';
          }

          return `${trimmedName}:\n  title: ${trimmedTitle}\n  icon: ${trimmedIcon}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    if (type === 'visual_choice') {
      return rows
        .map(({ name, title, image }) => {
          const trimmedName = (name || title || '').trim();
          const trimmedTitle = (title || name || 'Option').trim();
          const trimmedImage = (image || '').trim();

          if (!trimmedName) {
            return '';
          }

          return `${trimmedName}:\n  title: ${trimmedTitle}\n  image: ${trimmedImage || 'images/default.png'}`;
        })
        .filter(Boolean)
        .join('\n');
    }

    return rows
      .map(({ name, label }) => {
        const trimmedName = name.trim();
        const trimmedLabel = label.trim();

        if (!trimmedName && !trimmedLabel) {
          return '';
        }

        const finalName = trimmedName || trimmedLabel;
        const finalLabel = trimmedLabel || trimmedName;
        return `${finalName}: ${finalLabel}`;
      })
      .filter(Boolean)
      .join('\n');
  };

  const serializeSelectOptionGroups = (groups: SelectOptionGroup[]): string => groups
    .map((group, groupIndex) => {
      const groupName = normalizeGroupName(group.name || group.label, `group-${groupIndex + 1}`);
      const groupLabel = (group.label || groupName).trim();
      const optionLines = group.options
        .map((option) => {
          const trimmedName = option.name.trim();
          const trimmedLabel = option.label.trim();
          const finalName = trimmedName || trimmedLabel || `option-${groupIndex + 1}`;
          const finalLabel = trimmedLabel || trimmedName || finalName;
          return `  ${finalName}: ${finalLabel}`;
        })
        .filter(Boolean);

      return `${groupName}: ${groupLabel}${optionLines.length > 0 ? `\n${optionLines.join('\n')}` : ''}`;
    })
    .filter(Boolean)
    .join('\n\n');

  const getSelectDefaultValue = (rows: SelectOptionRow[], allowMultiple: boolean): string => {
    const defaultValues = rows
      .filter((row) => row.isDefault)
      .map((row) => (row.name || row.label).trim())
      .filter(Boolean);

    if (!defaultValues.length) {
      return '';
    }

    return allowMultiple ? JSON.stringify(defaultValues) : defaultValues[0];
  };

  const updateSelectOptionsFromRows = (rows: SelectOptionRow[]) => {
    const isChoose = controlDraft.type === 'choose';
    const isVisualChoice = controlDraft.type === 'visual_choice';
    const allowMultiple = controlDraft.type === 'select2' && controlDraft.multiple;
    const nextDefault = getSelectDefaultValue(rows, allowMultiple);
    setSelectOptionRows(rows);
    setSelectOptionGroups([]);
    setEnableSelectGrouping(false);
    setControlDraft((current) => ({
      ...current,
      defaultValue: (isChoose || isVisualChoice) ? current.defaultValue : (nextDefault || current.defaultValue),
      options: isChoose ? serializeSelectOptionRows(rows, 'choose') : isVisualChoice ? serializeSelectOptionRows(rows, 'visual_choice') : serializeSelectOptionRows(rows)
    }));
  };

  const updateSelectGroupsFromRows = (groups: SelectOptionGroup[]) => {
    const allowMultiple = controlDraft.type === 'select2' && controlDraft.multiple;
    const defaultValues = groups.flatMap((group) => group.options).filter((option) => option.isDefault).map((option) => (option.name || option.label).trim()).filter(Boolean);
    const nextDefault = allowMultiple ? JSON.stringify(defaultValues) : defaultValues[0] ?? '';
    setSelectOptionGroups(groups);
    setEnableSelectGrouping(true);
    setControlDraft((current) => ({ ...current, defaultValue: nextDefault || current.defaultValue, options: serializeSelectOptionGroups(groups) }));
  };

  const pickVisualChoiceImage = (optionId: string) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({ type: 'select-image-file', optionId });
    }
  };

  React.useEffect(() => {
    const handleWindowMessage = (event: MessageEvent<{ type?: string; optionId?: string; value?: string }>) => {
      if (event.data?.type !== 'image-file-selected' || !event.data.optionId || !event.data.value) {
        return;
      }

      const nextRows = selectOptionRows.map((row) => {
        if (row.id !== event.data.optionId) {
          return row;
        }

        return {
          ...row,
          image: event.data.value
        };
      });

      if (nextRows !== selectOptionRows) {
        updateSelectOptionsFromRows(nextRows);
      }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [selectOptionRows, updateSelectOptionsFromRows]);

  const setSelectOptionDefault = (rowId: string, mode: 'flat' | 'grouped', groupIndex?: number) => {
    const allowMultiple = controlDraft.type === 'select2' && controlDraft.multiple;

    if (mode === 'flat') {
      updateSelectOptionsFromRows(selectOptionRows.map((row) => ({
        ...row,
        isDefault: allowMultiple ? (row.id === rowId ? !row.isDefault : row.isDefault) : row.id === rowId
      })));
      return;
    }

    if (groupIndex === undefined) {
      return;
    }

    const nextGroups = [...selectOptionGroups];
    nextGroups[groupIndex] = {
      ...nextGroups[groupIndex],
      options: nextGroups[groupIndex].options.map((option) => ({
        ...option,
        isDefault: allowMultiple ? (option.id === rowId ? !option.isDefault : option.isDefault) : option.id === rowId
      }))
    };
    updateSelectGroupsFromRows(nextGroups);
  };

  const renderControlTypeFields = () => {
    const selectedType = controlDraft.type;
    const selectedDefinition = controlTypeDefinitions[selectedType] ?? controlTypeDefinitions.text;
    const visibleFields = selectedDefinition.fields.filter((field) => !(field.key === 'options' && selectOptionControlTypes.includes(selectedType)));

    const isSelect2MultipleMode = selectedType === 'select2' && controlDraft.multiple;

    const getFieldHelpText = (field: { key: string; label: string; type?: string }): string => {
      const fieldKey = field.key;
      if (fieldKey === 'inputType') {
        return 'Select the HTML input mode for the field.';
      }
      if (fieldKey === 'title') {
        return 'The field title that appears on mouse hover.';
      }
      if (fieldKey === 'defaultValue') {
        return 'Initial value assigned when the widget loads.';
      }
      if (fieldKey === 'placeholder') {
        return 'Placeholder text shown while the field is empty.';
      }
      if (fieldKey === 'options') {
        return 'Define the available choices, values, or value|label pairs.';
      }
      if (fieldKey === 'condition') {
        return 'Optional conditional logic that shows or hides the control.';
      }
      if (fieldKey === 'min') {
        return 'Minimum accepted value for numeric inputs.';
      }
      if (fieldKey === 'max') {
        return 'Maximum accepted value for numeric inputs.';
      }
      if (fieldKey === 'step') {
        return 'Increment or precision between allowed values.';
      }
      if (fieldKey === 'rows') {
        return 'The number of visible rows the area should display.';
      }
      if (fieldKey === 'columns') {
        return 'How many columns to display in the visual grid.';
      }
      if (fieldKey === 'toggle') {
        return 'Enable toggle mode for the visual choice selector.';
      }
      if (fieldKey === 'alpha') {
        return 'Whether to allow alpha channel.';
      }
      if (fieldKey === 'pickerOptions') {
        return 'Flatpickr settings using key: value pairs such as enableTime: true or minuteIncrement: 15.';
      }
      if (fieldKey === 'language') {
        return 'Select the Ace syntax language used to format the code editor.';
      }
      if (fieldKey === 'description') {
        return 'Helpful guidance shown below the control in the editor.';
      }
      if (field.type === 'checkbox') {
        return `Controls how ${field.label.toLowerCase()} behaves in the editor.`;
      }
      return `Defines the ${field.label.toLowerCase()} for this control.`;
    };

    const renderField = (field: { key: 'defaultValue' | 'placeholder' | 'options' | 'pickerOptions' | 'condition' | 'min' | 'max' | 'step' | 'description' | 'inputType' | 'title' | 'language' | 'rows' | 'columns' | 'toggle' | 'alpha' | 'checkbox' | 'labelOn' | 'labelOff' | 'returnValue'; label: string; type?: 'text' | 'textarea' | 'number' | 'color' | 'checkbox' | 'select'; options?: string[]; help?: string }) => {
      const value =
        field.key === 'inputType' ? controlDraft.inputType :
        field.key === 'title' ? controlDraft.title :
        field.key === 'language' ? controlDraft.language :
        field.key === 'rows' ? controlDraft.rows :
        field.key === 'columns' ? controlDraft.columns :
        field.key === 'toggle' ? String(controlDraft.toggle) :
        field.key === 'alpha' ? String(controlDraft.alpha) :
        field.key === 'pickerOptions' ? controlDraft.pickerOptions :
        field.key === 'defaultValue' ? controlDraft.defaultValue :
        field.key === 'labelOn' ? controlDraft.labelOn :
        field.key === 'labelOff' ? controlDraft.labelOff :
        field.key === 'returnValue' ? controlDraft.returnValue :
        field.key === 'placeholder' ? controlDraft.placeholder :
        field.key === 'options' ? controlDraft.options :
        field.key === 'condition' ? controlDraft.condition :
        field.key === 'min' ? controlDraft.min :
        field.key === 'max' ? controlDraft.max :
        field.key === 'step' ? controlDraft.step :
        field.key === 'description' ? controlDraft.description :
        field.type === 'checkbox' ? String(controlDraft.showLabel) : '';

      const onChange = (nextValue: string | boolean) => {
        if (field.key === 'inputType') {
          setControlDraft((current) => ({ ...current, inputType: String(nextValue) }));
        }
        if (field.key === 'title') {
          setControlDraft((current) => ({ ...current, title: String(nextValue) }));
        }
        if (field.key === 'language') {
          setControlDraft((current) => ({ ...current, language: String(nextValue) }));
        }
        if (field.key === 'rows') {
          setControlDraft((current) => ({ ...current, rows: String(nextValue) }));
        }
        if (field.key === 'columns') {
          setControlDraft((current) => ({ ...current, columns: String(nextValue) }));
        }
        if (field.key === 'toggle') {
          setControlDraft((current) => ({ ...current, toggle: Boolean(nextValue) }));
        }
        if (field.key === 'alpha') {
          setControlDraft((current) => ({ ...current, alpha: Boolean(nextValue) }));
        }
        if (field.key === 'pickerOptions') {
          setControlDraft((current) => ({ ...current, pickerOptions: String(nextValue) }));
        }
        if (field.key === 'defaultValue') {
          setControlDraft((current) => ({ ...current, defaultValue: String(nextValue) }));
        }
        if (field.key === 'labelOn') {
          setControlDraft((current) => ({ ...current, labelOn: String(nextValue) }));
        }
        if (field.key === 'labelOff') {
          setControlDraft((current) => ({ ...current, labelOff: String(nextValue) }));
        }
        if (field.key === 'returnValue') {
          setControlDraft((current) => ({ ...current, returnValue: String(nextValue) }));
        }
        if (field.key === 'placeholder') {
          setControlDraft((current) => ({ ...current, placeholder: String(nextValue) }));
        }
        if (field.key === 'options') {
          setControlDraft((current) => ({ ...current, options: String(nextValue) }));
        }
        if (field.key === 'condition') {
          setControlDraft((current) => ({ ...current, condition: String(nextValue) }));
        }
        if (field.key === 'min') {
          setControlDraft((current) => ({ ...current, min: String(nextValue) }));
        }
        if (field.key === 'max') {
          setControlDraft((current) => ({ ...current, max: String(nextValue) }));
        }
        if (field.key === 'step') {
          setControlDraft((current) => ({ ...current, step: String(nextValue) }));
        }
        if (field.key === 'description') {
          setControlDraft((current) => ({ ...current, description: String(nextValue) }));
        }
        if (field.type === 'checkbox' && field.label === 'Show label') {
          setControlDraft((current) => ({ ...current, showLabel: Boolean(nextValue) }));
        }
        if (field.type === 'checkbox' && field.label === 'Label block') {
          setControlDraft((current) => ({ ...current, labelBlock: Boolean(nextValue) }));
        }
      };

      if (field.type === 'checkbox') {
        const checked = field.key === 'toggle'
          ? controlDraft.toggle
          : field.key === 'alpha'
            ? controlDraft.alpha
            : field.label === 'Show label'
              ? controlDraft.showLabel
              : controlDraft.labelBlock;

        return (
          <Form.Group key={`${selectedType}-${field.label}`} className="mb-0">
            <Form.Check
              type="checkbox"
              label={field.label}
              checked={checked}
              onChange={(event) => onChange(event.target.checked)}
            />
          </Form.Group>
        );
      }

      if (field.type === 'color') {
        return (
          <Form.Group key={`${selectedType}-${field.label}`} className="mb-0">
            <Form.Label>{field.label}</Form.Label>
            <Form.Control type="color" value={controlDraft.defaultValue || '#000000'} onChange={(event) => onChange(event.target.value)} />
          </Form.Group>
        );
      }

      if (field.type === 'select') {
        return (
          <Form.Group key={`${selectedType}-${field.label}`} className="mb-0">
            <Form.Label>{field.label}</Form.Label>
            <Form.Select value={field.key === 'defaultValue' ? controlDraft.defaultValue : controlDraft.defaultValue} onChange={(event) => onChange(event.target.value)}>
              {field.options?.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Form.Select>
          </Form.Group>
        );
      }

      return (
        <Form.Group key={`${selectedType}-${field.label}`} className="mb-0">
          <Form.Label>{field.label}</Form.Label>
          {field.type === 'textarea' ? (
            <Form.Control as="textarea" rows={3} value={value as string} onChange={(event) => onChange(event.target.value)} />
          ) : (
            <Form.Control type={field.type ?? 'text'} value={value as string} onChange={(event) => onChange(event.target.value)} />
          )}
          {(field.help ?? getFieldHelpText(field)) && (
            <Form.Text style={formHelperTextStyle}>{field.help ?? getFieldHelpText(field)}</Form.Text>
          )}
        </Form.Group>
      );
    };

    return (
      <>
        <p className="mb-3" style={formHelperTextStyle}>{selectedDefinition.description}</p>
        <p className="mb-3" style={formHelperTextStyle}>
          <a href={selectedDefinition.docsUrl} target="_blank" rel="noopener noreferrer" style={formHelperTextStyle}>
            View Elementor documentation
          </a>
        </p>
        <Form style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
          {visibleFields.map((field) => (
            <div key={`${selectedType}-${field.label}`} style={field.type === 'checkbox' ? { gridColumn: '1 / -1' } : undefined}>
              {renderField(field)}
            </div>
          ))}
        </Form>
      </>
    );
  };

  const getControlCategoryForType = (type: string): 'data' | 'multipleValue' | 'unit' | 'ui' | 'group' => {
    for (const [category, values] of Object.entries(controlTypeOptionsByCategory)) {
      if ((values as string[]).includes(type)) {
        return category as 'data' | 'multipleValue' | 'unit' | 'ui' | 'group';
      }
    }

    return 'data';
  };

  const getConditionTargetOptions = () => {
    if (!selectedControlWidget) {
      return [] as string[];
    }

    const names = new Set<string>();
    (selectedControlWidget.sections ?? []).forEach((section) => {
      (section.controls ?? []).forEach((control) => {
        if (control.name && control.name !== controlDraft.name) {
          names.add(control.name);
        }
      });
    });

    return Array.from(names).sort((left, right) => left.localeCompare(right));
  };

  const updateConditionRows = (nextRows: ControlConditionRow[]) => {
    setControlDraft((current) => ({
      ...current,
      conditions: nextRows
    }));
  };

  const openControlDialog = (section: WidgetSection, control?: WidgetControl) => {
    const nextType = control?.type || 'text';
    const nextCategory = getControlCategoryForType(nextType);
    const parsedGroupedOptions = parseSelectOptionGroups(control?.options ?? '');
    const availableConditionControls = (selectedControlWidget?.sections ?? []).flatMap((entry) => (entry.controls ?? []).map((item) => item.name)).filter(Boolean);

    setControlDialogSectionId(section.id);
    setControlDraft({
      id: control?.id ?? '',
      name: control?.name ?? '',
      label: control?.label ?? '',
      description: control?.description ?? '',
      defaultValue: control?.defaultValue ?? '',
      placeholder: control?.placeholder ?? '',
      inputType: control?.inputType ?? 'text',
      multiple: Boolean(control?.multiple),
      title: control?.title ?? '',
      language: control?.language ?? 'javascript',
      rows: control?.rows ?? '4',
      columns: control?.columns ?? '2',
      toggle: Boolean(control?.toggle),
      alpha: Boolean(control?.alpha),
      pickerOptions: control?.pickerOptions ?? '',
      options: control?.options ?? '',
      condition: control?.condition ?? '',
      conditionsEnabled: Array.isArray(control?.conditions) && control.conditions.length > 0,
      conditions: Array.isArray(control?.conditions) && control.conditions.length > 0
        ? control.conditions.map((entry) => ({
          id: entry.id || `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          equalityCheck: entry.equalityCheck !== false,
          control: entry.control || availableConditionControls[0] || '',
          value: Array.isArray(entry.value) ? entry.value : (typeof entry.value === 'string' ? [entry.value] : [])
        }))
        : [{ id: `condition-${Date.now()}`, equalityCheck: true, control: availableConditionControls[0] || '', value: [] }],
      labelOn: control?.labelOn ?? 'On',
      labelOff: control?.labelOff ?? 'Off',
      returnValue: control?.returnValue ?? 'yes',
      enableSelectors: Boolean(control?.enableSelectors),
      selectors: control?.selectors ?? '',
      dynamicContent: Boolean(control?.dynamicContent),
      frontendAvailable: Boolean(control?.frontendAvailable),
      enableAI: Boolean(control?.enableAI),
      aiType: control?.aiType ?? 'text',
      aiLanguage: control?.aiLanguage ?? 'html',
      aiCategory: control?.aiCategory ?? 'background',
      type: nextType,
      controlCategory: nextCategory,
      tab: control?.tab || section.tab || 'content',
      showLabel: control?.showLabel ?? true,
      labelBlock: control?.labelBlock ?? true,
      separator: control?.separator ?? 'default',
      min: control?.min ?? '',
      max: control?.max ?? '',
      step: control?.step ?? ''
    });
    setSelectOptionRows(parsedGroupedOptions.rows);
    setSelectOptionGroups(parsedGroupedOptions.enabled ? parsedGroupedOptions.groups : []);
    setSelectorRows(parseSelectorRows(control?.selectors ?? ''));
    setPickerOptionRows(parsePickerOptionRows(control?.pickerOptions ?? ''));
    setEnableSelectGrouping(parsedGroupedOptions.enabled);
    setControlDialogOpen(true);
  };

  const saveControlToSection = () => {
    if (!selectedControlWidget || !controlDialogSectionId) {
      return;
    }

    const section = (selectedControlWidget.sections ?? []).find((entry) => entry.id === controlDialogSectionId);
    if (!section) {
      return;
    }

    const nextName = normalizeControlName(controlDraft.name || controlDraft.label || 'new_control');
    const conditionRows = controlDraft.conditionsEnabled
      ? controlDraft.conditions
          .filter((row) => row && (row.control || row.value.length > 0))
          .map((row) => ({
            id: row.id || `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            equalityCheck: Boolean(row.equalityCheck),
            control: row.control || '',
            value: Array.isArray(row.value) ? row.value.filter(Boolean) : []
          }))
      : [];

    const nextControl: WidgetControl = {
      id: controlDraft.id || `control-${Date.now()}`,
      name: nextName,
      label: controlDraft.label || nextName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      type: controlDraft.type || 'text',
      description: controlDraft.description,
      defaultValue: controlDraft.defaultValue,
      placeholder: controlDraft.placeholder,
      inputType: controlDraft.inputType || 'text',
      enableSelectors: controlDraft.enableSelectors && supportsSelectorControl(controlDraft.type),
      selectors: controlDraft.selectors,
      dynamicContent: controlDraft.dynamicContent,
      frontendAvailable: controlDraft.frontendAvailable,
      enableAI: controlDraft.enableAI,
      aiType: controlDraft.aiType,
      aiLanguage: controlDraft.aiLanguage,
      aiCategory: controlDraft.aiCategory,
      multiple: controlDraft.type === 'select2' ? controlDraft.multiple : false,
      title: controlDraft.title,
      language: controlDraft.language,
      rows: controlDraft.rows,
      columns: controlDraft.columns,
      toggle: controlDraft.type === 'visual_choice' ? controlDraft.toggle : undefined,
      alpha: controlDraft.type === 'color' ? controlDraft.alpha : undefined,
      pickerOptions: controlDraft.type === 'date_time' ? (pickerOptionRows.length > 0 ? serializePickerOptionRows(pickerOptionRows) : controlDraft.pickerOptions) : undefined,
      options: controlDraft.options,
      condition: controlDraft.condition,
      conditions: conditionRows.length > 0 ? conditionRows : undefined,
      labelOn: controlDraft.labelOn,
      labelOff: controlDraft.labelOff,
      returnValue: controlDraft.returnValue,
      tab: (controlDraft.tab || section.tab || 'content').trim() as TabKey,
      showLabel: controlDraft.showLabel,
      labelBlock: controlDraft.labelBlock,
      separator: controlDraft.separator,
      min: controlDraft.min,
      max: controlDraft.max,
      step: controlDraft.step,
      repeaterFields: []
    };

    const nextControls = (section.controls ?? []).map((entry) => entry.id === nextControl.id ? nextControl : entry);
    const hasMatchingExistingControl = (section.controls ?? []).some((entry) => entry.id === nextControl.id);

    const nextProject = updateProjectWidgetCollection(project, {
      id: selectedControlWidget.id,
      categoryId: selectedControlWidget.groupId,
      name: selectedControlWidget.name,
      title: selectedControlWidget.title,
      description: selectedControlWidget.description ?? '',
      icon: selectedControlWidget.icon,
      keywords: (selectedControlWidget.keywords ?? []).join(', '),
      sections: (selectedControlWidget.sections ?? []).map((entry) => entry.id === section.id
        ? { ...entry, controls: hasMatchingExistingControl ? nextControls : [...(entry.controls ?? []), nextControl] }
        : entry)
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: hasMatchingExistingControl ? `Control updated: ${nextName}.` : `Control added: ${nextName}.` });
    setControlDialogOpen(false);
    setControlDialogSectionId(null);
    setControlDraft({
      id: '',
      name: '',
      label: '',
      description: '',
      defaultValue: '',
      placeholder: '',
      inputType: 'text',
      multiple: false,
      title: '',
      language: 'javascript',
      rows: '4',
      columns: '2',
      toggle: false,
      alpha: false,
      pickerOptions: '',
      options: '',
      condition: '',
      conditionsEnabled: false,
      conditions: [],
      labelOn: 'On',
      labelOff: 'Off',
      returnValue: 'yes',
      enableSelectors: false,
      selectors: '',
      dynamicContent: false,
      frontendAvailable: false,
      enableAI: false,
      aiType: 'text',
      aiLanguage: 'html',
      aiCategory: 'background',
      type: 'text',
      controlCategory: 'data',
      tab: 'content',
      showLabel: true,
      labelBlock: true,
      separator: 'default',
      min: '',
      max: '',
      step: ''
    });
  };

  const widgetCategories = categoryList;
  const projectPrefix = ((project as BuilderProject & { ProjectPrefix?: string; classPrefix?: string }).ProjectPrefix ?? project.projectPrefix ?? (project as BuilderProject & { classPrefix?: string }).classPrefix ?? 'accesspress').replace(/[^a-z0-9_\-]+/gi, '').trim();

  return (
    <>
      <style>{widgetModalDialogStyles}</style>
      {selectedControlWidget ? (
        <div style={panelStyle}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <div className="text-uppercase small text-secondary mb-1">Widget controls</div>
              <h5 className="mb-0">{selectedControlWidget.title || selectedControlWidget.name}</h5>
            </div>
            <Button variant="outline-secondary" onClick={() => setControlEditorWidgetId(null)}>
              Back to widgets
            </Button>
          </div>

          <div className="d-flex flex-column gap-3">
            <Button variant="outline-success" className="align-self-start" onClick={openSectionDialog}>Add section</Button>

            {(selectedControlWidget.sections ?? []).map((section) => (
              <div key={section.id} style={categoryStyle}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <strong>{section.label}</strong>
                    <Badge bg="secondary">{section.tab}</Badge>
                  </div>
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-success" onClick={() => openControlDialog(section)}>
                      Add control
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => confirmDelete(`the section "${section.label || section.name}" and its controls`, () => deleteSection(section))}
                    >
                      Delete section
                    </Button>
                  </div>
                </div>

                {((section.controls ?? []).length > 0) && (
                  <Table size="sm" bordered hover className="mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Label</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(section.controls ?? []).map((control) => (
                        <tr key={control.id}>
                          <td>{control.name}</td>
                          <td>{control.type}</td>
                          <td>{control.label}</td>
                          <td>
                            <div className="d-flex justify-content-end gap-2">
                              <Button size="sm" variant="outline-info" onClick={() => openControlDialog(section, control)}>Edit</Button>
                              <Button size="sm" variant="outline-danger" onClick={() => confirmDelete(`the control "${control.name}"`, () => deleteControl(section, control))}>Delete</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={panelStyle}>
          <div className="d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 className="mb-0">Widgets</h5>
              <Button variant="outline-success" onClick={() => openCategoryDialog()}>
                Add category
              </Button>
            </div>

            {widgetCategories.length === 0 ? (
              <div style={categoryStyle} className="text-secondary">
                No widget categories created yet.
              </div>
            ) : widgetCategories.map((group) => {
              const widgets = allWidgets.filter((widget) => widget.groupId === group.id);
              const expanded = expandedCategoryId === group.id || widgetCategories.length === 1;
              return (
                <div key={group.id} style={categoryStyle}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                    <Button variant="link" className="p-0 text-decoration-none" onClick={() => setExpandedCategoryId(expanded ? null : group.id)} style={{ color: 'var(--vscode-editor-foreground)' }}>
                      {group.text || group.slug || 'Custom'}
                    </Button>
                    <div className="d-flex gap-2">
                      <Button size="sm" variant="outline-info" onClick={() => openCategoryDialog(group)}>Edit</Button>
                      <Button size="sm" variant="outline-danger" onClick={() => {
                        setCategoryDeleteDraft({
                          categoryId: group.id,
                          categoryLabel: group.text || group.slug || 'Custom',
                          deleteWidgets: false
                        });
                        setCategoryDeleteDialogOpen(true);
                      }}>Delete</Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="d-flex flex-column gap-3 mt-2">
                      <Button size="sm" variant="outline-success" className="align-self-start" onClick={() => openWidgetDialog(group.id)}>
                        Add widget
                      </Button>

                      <Table size="sm" bordered hover responsive className="mb-0">
                        <thead>
                          <tr>
                            <th>Widget</th>
                            <th>Description</th>
                            <th>Controls</th>
                            <th className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {widgets.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-secondary py-3">
                                No widgets in this category yet.
                              </td>
                            </tr>
                          ) : (
                            widgets.map((widget) => (
                              <tr key={widget.id}>
                                <td>{widget.title || widget.name}</td>
                                <td>{widget.description || '—'}</td>
                                <td>
                                  <Button size="sm" variant="outline-secondary" onClick={() => setControlEditorWidgetId(widget.id)}>
                                    Controls
                                  </Button>
                                </td>
                                <td>
                                  <div className="d-flex justify-content-end gap-2">
                                    <Button size="sm" variant="outline-info" onClick={() => openWidgetDialog(group.id, widget)}>Edit</Button>
                                    <Button size="sm" variant="outline-danger" onClick={() => confirmDelete(`the widget "${widget.title || widget.name}"`, () => deleteWidget(widget))}>
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal show={controlDialogOpen} onHide={() => setControlDialogOpen(false)} centered dialogClassName="widget-modal-dialog">
        <Modal.Header closeButton>
          <Modal.Title>{controlDraft.id ? 'Edit control' : 'Add control'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Accordion defaultActiveKey="0" className="mb-0">
            <Accordion.Item eventKey="0">
              <Accordion.Header>Control Info</Accordion.Header>
              <Accordion.Body>
                <Form style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                  <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
                    <Form.Label>Control Type</Form.Label>
                    <Form.Select value={controlDraft.controlCategory} onChange={(event) => {
                      const nextCategory = event.target.value as 'data' | 'multipleValue' | 'unit' | 'ui' | 'group';
                      const nextControlType = getControlTypeOptions(nextCategory)[0] ?? 'text';

                      setControlDraft((current) => ({
                        ...current,
                        controlCategory: nextCategory,
                        type: nextControlType,
                        tab: current.tab || 'content'
                      }));
                    }}>
                      {controlCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Form.Select>
                    <Form.Text style={formHelperTextStyle}>Choose the Elementor control family this field belongs to.</Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
                    <Form.Label>Control</Form.Label>
                    <Form.Select value={controlDraft.type} onChange={(event) => {
                      const nextType = event.target.value;
                      setEnableSelectGrouping(false);
                      setSelectOptionGroups([]);
                      setControlDraft((current) => ({
                        ...current,
                        type: nextType,
                        multiple: nextType === 'select2' ? current.multiple : false
                      }));
                    }}>
                      {getControlTypeOptions(controlDraft.controlCategory).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </Form.Select>
                    <Form.Text style={formHelperTextStyle}>Select the specific Elementor control type to render.</Form.Text>
                  </Form.Group>

                  <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
                    <Form.Label>Control label</Form.Label>
                    <Form.Control
                      value={controlDraft.label}
                      onChange={(event) => setControlDraft((current) => {
                        const nextLabel = event.target.value;
                        const normalizedNextName = normalizeControlName(nextLabel);
                        const shouldSyncName = !current.name || current.name === normalizeControlName(current.label || '');

                        return {
                          ...current,
                          label: nextLabel,
                          name: shouldSyncName ? normalizedNextName : current.name
                        };
                      })}
                    />
                    <Form.Text style={formHelperTextStyle}>The label shown to editors in the Elementor panel.</Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
                    <Form.Label>Control name</Form.Label>
                    <InputGroup>
                      <InputGroup.Text>{projectPrefix}_</InputGroup.Text>
                      <Form.Control
                        value={controlDraft.name}
                        onChange={(event) => setControlDraft((current) => ({ ...current, name: normalizeControlName(event.target.value) }))}
                      />
                    </InputGroup>
                    <Form.Text style={formHelperTextStyle}>Internal machine name, automatically prefixed for your project.</Form.Text>
                  </Form.Group>

                  {controlDraft.type !== 'hidden' && (
                    <>
                      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                        <Form.Group className="mb-0">
                          <Form.Check
                            type="checkbox"
                            label="Show label"
                            checked={controlDraft.showLabel}
                            onChange={(event) => setControlDraft((current) => ({ ...current, showLabel: event.target.checked }))}
                          />
                          <Form.Text style={formHelperTextStyle}>Display the label next to the control in the editor.</Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-0">
                          <Form.Check
                            type="checkbox"
                            label="Label block"
                            checked={controlDraft.labelBlock}
                            onChange={(event) => setControlDraft((current) => ({ ...current, labelBlock: event.target.checked }))}
                          />
                          <Form.Text style={formHelperTextStyle}>Render the label on its own line instead of inline.</Form.Text>
                        </Form.Group>
                      </div>

                      <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                        <Form.Label>Description</Form.Label>
                        <Form.Control as="textarea" rows={3} value={controlDraft.description} onChange={(event) => setControlDraft((current) => ({ ...current, description: event.target.value }))} />
                        <Form.Text style={formHelperTextStyle}>Helpful guidance shown to editors explaining the purpose of this control.</Form.Text>
                      </Form.Group>
                    </>
                  )}

                  {controlDraft.type !== 'hidden' && (
                    <>
                      <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
                        <Form.Label>Title</Form.Label>
                        <Form.Control value={controlDraft.title} onChange={(event) => setControlDraft((current) => ({ ...current, title: event.target.value }))} />
                        <Form.Text style={formHelperTextStyle}>The field title that appears on mouse hover.</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
                        <Form.Label>Separator</Form.Label>
                        <Form.Select value={controlDraft.separator} onChange={(event) => setControlDraft((current) => ({ ...current, separator: event.target.value as 'default' | 'before' | 'after' }))}>
                          <option value="default">Default</option>
                          <option value="before">Before</option>
                          <option value="after">After</option>
                        </Form.Select>
                        <Form.Text style={formHelperTextStyle}>Adds spacing before or after the control in the Elementor panel.</Form.Text>
                      </Form.Group>
                      {supportsSelectorControl(controlDraft.type) && (
                        <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                          <Form.Check
                            type="switch"
                            label="Enable Selectors"
                            checked={controlDraft.enableSelectors}
                            onChange={(event) => {
                              const nextEnabled = event.target.checked;
                              setControlDraft((current) => ({
                                ...current,
                                enableSelectors: nextEnabled,
                                selectors: nextEnabled ? current.selectors : ''
                              }));

                              if (nextEnabled && selectorRows.length === 0) {
                                updateSelectorRows([{ id: `selector-${Date.now()}`, selector: '{{WRAPPER}} .selector', css: 'color: {{VALUE}};' }]);
                              }

                              if (!nextEnabled) {
                                updateSelectorRows([]);
                              }
                            }}
                          />
                          <Form.Text style={formHelperTextStyle}>Turn on CSS selector mappings for this control.</Form.Text>
                        </Form.Group>
                      )}
                      <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                        <Form.Check
                          type="switch"
                          label="Dynamic Content"
                          checked={controlDraft.dynamicContent}
                          onChange={(event) => setControlDraft((current) => ({ ...current, dynamicContent: event.target.checked }))}
                        />
                        <Form.Text style={formHelperTextStyle}>Turn on dynamic content for this control.</Form.Text>
                      </Form.Group>
                      <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                        <Form.Check
                          type="switch"
                          label="Frontend Available"
                          checked={controlDraft.frontendAvailable}
                          onChange={(event) => setControlDraft((current) => ({ ...current, frontendAvailable: event.target.checked }))}
                        />
                        <Form.Text style={formHelperTextStyle}>Expose this control to the frontend when Elementor requires it.</Form.Text>
                      </Form.Group>
                      <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                        <Form.Check
                          type="switch"
                          label="Enable AI"
                          checked={controlDraft.enableAI}
                          onChange={(event) => setControlDraft((current) => ({ ...current, enableAI: event.target.checked, aiType: event.target.checked ? current.aiType || 'text' : current.aiType }))}
                        />
                        <Form.Text style={formHelperTextStyle}>Enable AI-assisted content generation for this control.</Form.Text>
                      </Form.Group>
                      {controlDraft.enableAI && (
                        <>
                          <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
                            <Form.Label>AI type</Form.Label>
                            <Form.Select value={controlDraft.aiType} onChange={(event) => setControlDraft((current) => ({ ...current, aiType: event.target.value }))}>
                              <option value="text">Text</option>
                              <option value="textarea">Textarea</option>
                              <option value="code">Code</option>
                              <option value="media">Media</option>
                            </Form.Select>
                          </Form.Group>
                          {controlDraft.aiType === 'code' && (
                            <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
                              <Form.Label>AI language</Form.Label>
                              <Form.Select value={controlDraft.aiLanguage} onChange={(event) => setControlDraft((current) => ({ ...current, aiLanguage: event.target.value }))}>
                                <option value="html">HTML</option>
                                <option value="css">CSS</option>
                              </Form.Select>
                            </Form.Group>
                          )}
                          {controlDraft.aiType === 'media' && (
                            <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
                              <Form.Label>AI category</Form.Label>
                              <Form.Select value={controlDraft.aiCategory} onChange={(event) => setControlDraft((current) => ({ ...current, aiCategory: event.target.value }))}>
                                <option value="background">Background</option>
                                <option value="3d">3D</option>
                                <option value="photographic">Photographic</option>
                                <option value="handmade">Handmade</option>
                                <option value="digital-art">Digital Art</option>
                              </Form.Select>
                            </Form.Group>
                          )}
                        </>
                      )}

                      <Form.Group className="mb-0" style={{ gridColumn: '1 / -1' }}>
                        <Form.Check
                          type="switch"
                          label="Conditions"
                          checked={controlDraft.conditionsEnabled}
                          onChange={(event) => {
                            const nextEnabled = event.target.checked;
                            const nextRows = nextEnabled
                              ? controlDraft.conditions.length > 0
                                ? controlDraft.conditions
                                : [{ id: `condition-${Date.now()}`, equalityCheck: true, control: getConditionTargetOptions()[0] || '', value: [] }]
                              : [];

                            setControlDraft((current) => ({
                              ...current,
                              conditionsEnabled: nextEnabled,
                              conditions: nextRows
                            }));
                          }}
                        />
                        <Form.Text style={formHelperTextStyle}>Add conditional visibility rules for this control.</Form.Text>
                      </Form.Group>

                      {controlDraft.conditionsEnabled && (
                        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <strong>Condition rows</strong>
                            <Button
                              size="sm"
                              variant="outline-success"
                              onClick={() => {
                                const nextOptions = getConditionTargetOptions();
                                updateConditionRows([
                                  ...(controlDraft.conditions ?? []),
                                  {
                                    id: `condition-${Date.now()}`,
                                    equalityCheck: true,
                                    control: nextOptions[0] || '',
                                    value: []
                                  }
                                ]);
                              }}
                            >
                              Add condition
                            </Button>
                          </div>

                          {(controlDraft.conditions ?? []).length === 0 ? (
                            <div className="text-secondary">No conditions added yet.</div>
                          ) : (
                            (controlDraft.conditions ?? []).map((row) => {
                              const targetOptions = getConditionTargetOptions();
                              const validValueOptions = Array.from(new Set((targetOptions.length > 0 ? targetOptions : ['']).map(String))).filter(Boolean);

                              return (
                                <div key={row.id} className="border rounded p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                  <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                                    <Form.Check
                                      type="switch"
                                      label="Equality Check"
                                      checked={row.equalityCheck}
                                      onChange={(event) => {
                                        updateConditionRows((controlDraft.conditions ?? []).map((entry) =>
                                          entry.id === row.id ? { ...entry, equalityCheck: event.target.checked } : entry
                                        ));
                                      }}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline-danger"
                                      onClick={() => updateConditionRows((controlDraft.conditions ?? []).filter((entry) => entry.id !== row.id))}
                                    >
                                      Remove
                                    </Button>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                                    <Form.Group className="mb-0">
                                      <Form.Label>Control</Form.Label>
                                      <Form.Select
                                        value={row.control}
                                        onChange={(event) => {
                                          updateConditionRows((controlDraft.conditions ?? []).map((entry) =>
                                            entry.id === row.id ? { ...entry, control: event.target.value } : entry
                                          ));
                                        }}
                                      >
                                        <option value="">Select a control</option>
                                        {targetOptions.map((option) => (
                                          <option key={option} value={option}>{option}</option>
                                        ))}
                                      </Form.Select>
                                    </Form.Group>

                                    <Form.Group className="mb-0">
                                      <Form.Label>Value</Form.Label>
                                      <Form.Select
                                        multiple
                                        value={row.value}
                                        style={{ minHeight: '120px' }}
                                        onChange={(event) => {
                                          const selectedValues = Array.from(event.target.selectedOptions, (option) => option.value).filter(Boolean);
                                          updateConditionRows((controlDraft.conditions ?? []).map((entry) =>
                                            entry.id === row.id ? { ...entry, value: selectedValues } : entry
                                          ));
                                        }}
                                        className="selectpicker"
                                        data-live-search="true"
                                      >
                                        {validValueOptions.length > 0 ? (
                                          validValueOptions.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                          ))
                                        ) : (
                                          <option value="">No values available</option>
                                        )}
                                      </Form.Select>
                                      <Form.Text style={formHelperTextStyle}>Use Ctrl/Cmd to select multiple tag values.</Form.Text>
                                    </Form.Group>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Form>
              </Accordion.Body>
            </Accordion.Item>
            <Accordion.Item eventKey="1">
              <Accordion.Header>{controlTypeDefinitions[controlDraft.type]?.title ?? 'Control Fields'}</Accordion.Header>
              <Accordion.Body>
                {renderControlTypeFields()}
              </Accordion.Body>
            </Accordion.Item>
            {controlDraft.type === 'date_time' && (
              <Accordion.Item eventKey="picker-options">
                <Accordion.Header>Picker Options</Accordion.Header>
                <Accordion.Body>
                  <div className="d-flex flex-column gap-3">
                    <div className="mb-0">
                      <p className="mb-1" style={formHelperTextStyle}>
                        Add flatpickr options and hooks, including events such as onChange and onOpen.
                      </p>
                      <a
                        href="https://flatpickr.js.org/events/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={formHelperTextStyle}
                      >
                        Events & Hooks - flatpickr
                      </a>
                    </div>

                    <Button
                      variant="outline-success"
                      className="align-self-start"
                      onClick={() => updatePickerOptionRows([
                        ...pickerOptionRows,
                        {
                          id: `picker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          optionKey: 'enableTime',
                          value: 'true',
                          valueType: 'boolean'
                        }
                      ])}
                    >
                      Add picker option
                    </Button>

                    {pickerOptionRows.length === 0 ? (
                      <div className="text-secondary">No picker options added yet.</div>
                    ) : (
                      pickerOptionRows.map((row, index) => {
                        const optionDefinition = flatpickrPickerOptionDefinitions.find((entry) => entry.value === row.optionKey) ?? flatpickrPickerOptionDefinitions[0];
                        const selectOptions = getPickerOptionSelectOptions(row.optionKey);
                        const positionValue = parsePositionOptionValue(row.value);
                        const valueInput = row.valueType === 'boolean' ? (
                          <Form.Check
                            type="switch"
                            label={row.value === 'false' ? 'Disabled' : 'Enabled'}
                            checked={row.value !== 'false'}
                            onChange={(event) => {
                              const nextRows = [...pickerOptionRows];
                              nextRows[index] = { ...nextRows[index], value: event.target.checked ? 'true' : 'false' };
                              updatePickerOptionRows(nextRows);
                            }}
                          />
                        ) : row.valueType === 'number' ? (
                          <Form.Control
                            type="number"
                            value={row.value}
                            onChange={(event) => {
                              const nextRows = [...pickerOptionRows];
                              nextRows[index] = { ...nextRows[index], value: event.target.value };
                              updatePickerOptionRows(nextRows);
                            }}
                          />
                        ) : row.valueType === 'position' ? (
                          <div className="d-flex gap-2 align-items-center">
                            <Form.Select
                              value={positionValue.vertical}
                              onChange={(event) => {
                                const nextRows = [...pickerOptionRows];
                                const nextPosition = parsePositionOptionValue(nextRows[index].value);
                                nextRows[index] = {
                                  ...nextRows[index],
                                  value: serializePositionOptionValue(event.target.value, nextPosition.horizontal)
                                };
                                updatePickerOptionRows(nextRows);
                              }}
                            >
                              <option value="auto">Auto</option>
                              <option value="above">Above</option>
                              <option value="below">Below</option>
                            </Form.Select>
                            <Form.Select
                              value={positionValue.horizontal}
                              onChange={(event) => {
                                const nextRows = [...pickerOptionRows];
                                const nextPosition = parsePositionOptionValue(nextRows[index].value);
                                nextRows[index] = {
                                  ...nextRows[index],
                                  value: serializePositionOptionValue(nextPosition.vertical, event.target.value)
                                };
                                updatePickerOptionRows(nextRows);
                              }}
                            >
                              <option value="">None</option>
                              <option value="left">Left</option>
                              <option value="centre">Centre</option>
                              <option value="right">Right</option>
                            </Form.Select>
                          </div>
                        ) : row.valueType === 'select' ? (
                          <Form.Select
                            value={row.value || selectOptions[0] || ''}
                            onChange={(event) => {
                              const nextRows = [...pickerOptionRows];
                              nextRows[index] = { ...nextRows[index], value: event.target.value };
                              updatePickerOptionRows(nextRows);
                            }}
                          >
                            {selectOptions.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </Form.Select>
                        ) : row.valueType === 'textarea' || row.valueType === 'function' ? (
                          <Form.Control
                            as="textarea"
                            rows={4}
                            value={row.value}
                            onChange={(event) => {
                              const nextRows = [...pickerOptionRows];
                              nextRows[index] = { ...nextRows[index], value: event.target.value };
                              updatePickerOptionRows(nextRows);
                            }}
                          />
                        ) : (
                          <Form.Control
                            type="text"
                            value={row.value}
                            onChange={(event) => {
                              const nextRows = [...pickerOptionRows];
                              nextRows[index] = { ...nextRows[index], value: event.target.value };
                              updatePickerOptionRows(nextRows);
                            }}
                          />
                        );

                        return (
                          <div key={row.id} className="border rounded p-3 d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between align-items-end gap-2">
                              <Form.Group className="mb-0 flex-fill">
                                <Form.Label>Option</Form.Label>
                                <Form.Select
                                  value={row.optionKey}
                                  onChange={(event) => {
                                    const nextRows = [...pickerOptionRows];
                                    const nextOption = flatpickrPickerOptionDefinitions.find((entry) => entry.value === event.target.value) ?? flatpickrPickerOptionDefinitions[0];
                                    const nextValue = getPickerOptionDefaultValue(nextOption.value, nextRows);
                                    nextRows[index] = {
                                      ...nextRows[index],
                                      optionKey: nextOption.value,
                                      value: nextValue,
                                      valueType: resolvePickerOptionMeta(nextOption.value, nextRows)
                                    };
                                    updatePickerOptionRows(nextRows);
                                  }}
                                >
                                  {flatpickrPickerOptionDefinitions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                              <Button
                                variant="outline-danger"
                                onClick={() => updatePickerOptionRows(pickerOptionRows.filter((_, itemIndex) => itemIndex !== index))}
                              >
                                Delete
                              </Button>
                            </div>

                            <Form.Group className="mb-0">
                              <Form.Label>{optionDefinition.label} value</Form.Label>
                              {valueInput}
                            </Form.Group>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            )}
            {supportsSelectorControl(controlDraft.type) && controlDraft.enableSelectors && (
              <Accordion.Item eventKey="2">
                <Accordion.Header>Selectors</Accordion.Header>
                <Accordion.Body>
                  <div className="d-flex flex-column gap-3">
                    <div className="mb-0">
                      <p className="mb-1" style={formHelperTextStyle}>
                        CSS selectors connect a control value to the CSS that should be applied to the rendered widget output.
                      </p>
                      <a
                        href="https://developers.elementor.com/docs/editor-controls/selectors/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={formHelperTextStyle}
                      >
                        CSS Selectors | Elementor Developers
                      </a>
                    </div>

                    <div className="small" style={formHelperTextStyle}>
                      <div className="fw-semibold mb-2">Core selector tokens</div>
                      <ul className="mb-2 ps-3">
                        <li><strong>{'{{WRAPPER}}'}</strong> — the widget wrapper element. Use this as the root of every selector.</li>
                        <li><strong>{'{{VALUE}}'}</strong> — the current control value, inserted directly into the declaration.</li>
                        <li><strong>{'{{UNIT}}'}</strong> — the unit suffix for numeric values like px, %, em, or rem.</li>
                        <li><strong>{'{{ID}}'}</strong> — the current widget instance ID when you need a unique scoped selector.</li>
                        <li><strong>{'{{CURRENT_ITEM}}'}</strong> — the current item inside a repeater or looped structure.</li>
                      </ul>
                      <div className="mb-0">
                        Example: <code>{'{{WRAPPER}} .demo-title { color: {{VALUE}}; }'}</code>
                      </div>
                    </div>

                    <Button
                      variant="outline-success"
                      className="align-self-start"
                      onClick={() => updateSelectorRows([
                        ...selectorRows,
                        {
                          id: `selector-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          selector: '{{WRAPPER}} .selector',
                          css: 'color: {{VALUE}};'
                        }
                      ])}
                    >
                      Add selector
                    </Button>

                    {selectorRows.length === 0 ? (
                      <div className="text-secondary">No selectors added yet.</div>
                    ) : (
                      selectorRows.map((row, index) => (
                        <div key={row.id} className="border rounded p-3 d-flex flex-column gap-3">
                          <div className="d-flex justify-content-between align-items-end gap-2">
                            <Form.Group className="mb-0 flex-fill">
                              <Form.Label>Selector</Form.Label>
                              <Form.Control
                                value={row.selector}
                                onChange={(event) => {
                                  const nextRows = [...selectorRows];
                                  nextRows[index] = { ...nextRows[index], selector: event.target.value };
                                  updateSelectorRows(nextRows);
                                }}
                              />
                            </Form.Group>
                            <Button
                              variant="outline-danger"
                              onClick={() => updateSelectorRows(selectorRows.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              Delete
                            </Button>
                          </div>

                          <Form.Group className="mb-0">
                            <Form.Label>CSS declaration</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={2}
                              value={row.css}
                              onChange={(event) => {
                                const nextRows = [...selectorRows];
                                nextRows[index] = { ...nextRows[index], css: event.target.value };
                                updateSelectorRows(nextRows);
                              }}
                            />
                          </Form.Group>
                        </div>
                      ))
                    )}
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            )}
            {selectOptionControlTypes.includes(controlDraft.type) && (
              <Accordion.Item eventKey={supportsSelectorControl(controlDraft.type) && controlDraft.enableSelectors ? '3' : '2'}>
                <Accordion.Header>Options</Accordion.Header>
                <Accordion.Body>
                  <div className="d-flex flex-column gap-3">
                    {controlDraft.type === 'choose' ? (
                      <>
                        {selectOptionRows.length === 0 ? (
                          <div className="text-secondary">No options added yet.</div>
                        ) : (
                          selectOptionRows.map((option, index) => (
                            <div key={option.id || `option-${index}`} className="d-flex gap-2 align-items-end flex-wrap">
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Icon</Form.Label>
                                <ElementorIconPicker
                                  value={option.icon || 'eicon-text'}
                                  onChange={(nextValue) => {
                                    const nextRows = [...selectOptionRows];
                                    nextRows[index] = { ...nextRows[index], icon: nextValue };
                                    updateSelectOptionsFromRows(nextRows);
                                  }}
                                  size="sm"
                                />
                              </Form.Group>
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Title</Form.Label>
                                <Form.Control
                                  value={option.title || option.label || option.name}
                                  onChange={(event) => {
                                    const nextRows = [...selectOptionRows];
                                    nextRows[index] = {
                                      ...nextRows[index],
                                      title: event.target.value,
                                      label: event.target.value
                                    };
                                    updateSelectOptionsFromRows(nextRows);
                                  }}
                                />
                              </Form.Group>
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                  value={option.name}
                                  onChange={(event) => {
                                    const nextRows = [...selectOptionRows];
                                    nextRows[index] = { ...nextRows[index], name: event.target.value };
                                    updateSelectOptionsFromRows(nextRows);
                                  }}
                                />
                              </Form.Group>
                              <Button
                                variant="outline-danger"
                                onClick={() => updateSelectOptionsFromRows(selectOptionRows.filter((_, rowIndex) => rowIndex !== index))}
                              >
                                Delete
                              </Button>
                            </div>
                          ))
                        )}
                        <Button
                          variant="outline-success"
                          className="align-self-start"
                          onClick={() => updateSelectOptionsFromRows([
                            ...selectOptionRows,
                            createSelectOptionRow(`option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, '', '', false, '', 'eicon-text')
                          ])}
                        >
                          Add option
                        </Button>
                      </>
                    ) : controlDraft.type === 'visual_choice' ? (
                      <>
                        {selectOptionRows.length === 0 ? (
                          <div className="text-secondary">No options added yet.</div>
                        ) : (
                          selectOptionRows.map((option, index) => (
                            <div key={option.id || `option-${index}`} className="d-flex gap-2 align-items-end flex-wrap">
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Image</Form.Label>
                                <InputGroup>
                                  <Form.Control
                                    value={option.image || ''}
                                    placeholder="Select image file"
                                    onChange={(event) => {
                                      const nextRows = [...selectOptionRows];
                                      nextRows[index] = { ...nextRows[index], image: event.target.value };
                                      updateSelectOptionsFromRows(nextRows);
                                    }}
                                  />
                                  <Button variant="outline-secondary" onClick={() => pickVisualChoiceImage(option.id)}>
                                    Browse
                                  </Button>
                                </InputGroup>
                              </Form.Group>
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                  value={option.name}
                                  onChange={(event) => {
                                    const nextRows = [...selectOptionRows];
                                    nextRows[index] = { ...nextRows[index], name: event.target.value };
                                    updateSelectOptionsFromRows(nextRows);
                                  }}
                                />
                              </Form.Group>
                              <Form.Group className="mb-0 flex-fill" style={{ minWidth: '180px' }}>
                                <Form.Label>Title</Form.Label>
                                <Form.Control
                                  value={option.title || option.label || option.name}
                                  onChange={(event) => {
                                    const nextRows = [...selectOptionRows];
                                    nextRows[index] = {
                                      ...nextRows[index],
                                      title: event.target.value,
                                      label: event.target.value
                                    };
                                    updateSelectOptionsFromRows(nextRows);
                                  }}
                                />
                              </Form.Group>
                              <Button
                                variant="outline-danger"
                                onClick={() => updateSelectOptionsFromRows(selectOptionRows.filter((_, rowIndex) => rowIndex !== index))}
                              >
                                Delete
                              </Button>
                            </div>
                          ))
                        )}
                        <Button
                          variant="outline-success"
                          className="align-self-start"
                          onClick={() => updateSelectOptionsFromRows([
                            ...selectOptionRows,
                            createSelectOptionRow(`option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, '', '', false, '', '', '')
                          ])}
                        >
                          Add option
                        </Button>
                      </>
                    ) : (
                      <>
                        {controlDraft.type === 'select2' && (
                          <Form.Check
                            type="switch"
                            label="Multiple"
                            checked={Boolean(controlDraft.multiple)}
                            onChange={(event) => {
                              const nextValue = event.target.checked;
                              setControlDraft((current) => ({ ...current, multiple: nextValue }));

                              if (!nextValue && selectOptionRows.length > 0) {
                                const firstDefaultIndex = selectOptionRows.findIndex((row) => row.isDefault);
                                const nextRows = selectOptionRows.map((row, index) => ({
                                  ...row,
                                  isDefault: firstDefaultIndex >= 0 ? index === firstDefaultIndex : row.isDefault
                                }));
                                updateSelectOptionsFromRows(nextRows);
                              }
                            }}
                          />
                        )}

                        {controlDraft.type === 'select' && (
                          <Form.Check
                            type="switch"
                            label="Enable grouping"
                            checked={enableSelectGrouping}
                            onChange={(event) => {
                              const nextEnabled = event.target.checked;
                              if (!nextEnabled) {
                                const flatRows = selectOptionGroups.flatMap((group) => group.options.map((option) => ({ ...option })));
                                updateSelectOptionsFromRows(flatRows);
                                return;
                              }

                              if (selectOptionGroups.length === 0) {
                                updateSelectGroupsFromRows([
                                  {
                                    id: `group-${Date.now()}`,
                                    name: 'group_1',
                                    label: '',
                                    options: []
                                  }
                                ]);
                                return;
                              }

                              setEnableSelectGrouping(true);
                            }}
                          />
                        )}

                        {enableSelectGrouping ? (
                          <>
                            <Button
                              variant="outline-success"
                              className="align-self-start"
                              onClick={() => updateSelectGroupsFromRows([
                                ...selectOptionGroups,
                                {
                                  id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                  name: `group_${selectOptionGroups.length + 1}`,
                                  label: '',
                                  options: []
                                }
                              ])}
                            >
                              Add group
                            </Button>

                            {selectOptionGroups.length === 0 ? (
                              <div className="text-secondary">No option groups added yet.</div>
                            ) : (
                              selectOptionGroups.map((group, groupIndex) => (
                                <div key={group.id} className="border rounded p-3 d-flex flex-column gap-3">
                                  <div className="d-flex justify-content-between align-items-end gap-2">
                                    <Form.Group className="mb-0 flex-fill">
                                      <Form.Label>Group Label</Form.Label>
                                      <Form.Control
                                        value={group.label}
                                        onChange={(event) => {
                                          const nextGroups = [...selectOptionGroups];
                                          nextGroups[groupIndex] = {
                                            ...nextGroups[groupIndex],
                                            label: event.target.value,
                                            name: normalizeGroupName(event.target.value, nextGroups[groupIndex].name || `group_${groupIndex + 1}`)
                                          };
                                          updateSelectGroupsFromRows(nextGroups);
                                        }}
                                      />
                                    </Form.Group>
                                    <Button
                                      variant="outline-danger"
                                      onClick={() => updateSelectGroupsFromRows(selectOptionGroups.filter((_, index) => index !== groupIndex))}
                                    >
                                      Delete
                                    </Button>
                                  </div>

                                  {group.options.length === 0 ? (
                                    <div className="text-secondary">No options in this group yet.</div>
                                  ) : (
                                    group.options.map((option, optionIndex) => (
                                      <div key={option.id} className="d-flex gap-2 align-items-end">
                                        <Form.Group className="mb-0 flex-fill">
                                          <Form.Label>{controlDraft.type === 'font' ? 'Font label' : 'Option Label'}</Form.Label>
                                          <Form.Control
                                            value={option.label}
                                            onChange={(event) => {
                                              const nextGroups = [...selectOptionGroups];
                                              nextGroups[groupIndex].options[optionIndex] = {
                                                ...nextGroups[groupIndex].options[optionIndex],
                                                label: event.target.value
                                              };
                                              updateSelectGroupsFromRows(nextGroups);
                                            }}
                                          />
                                        </Form.Group>
                                        <Form.Group className="mb-0 flex-fill">
                                          <Form.Label>{controlDraft.type === 'font' ? 'Font name' : 'Option name'}</Form.Label>
                                          <Form.Control
                                            value={option.name}
                                            onChange={(event) => {
                                              const nextGroups = [...selectOptionGroups];
                                              nextGroups[groupIndex].options[optionIndex] = {
                                                ...nextGroups[groupIndex].options[optionIndex],
                                                name: event.target.value
                                              };
                                              updateSelectGroupsFromRows(nextGroups);
                                            }}
                                          />
                                        </Form.Group>
                                        <Form.Check
                                          type="switch"
                                          id={`select-default-${group.id}-${option.id || optionIndex}`}
                                          label="Default"
                                          checked={Boolean(option.isDefault)}
                                          onChange={() => setSelectOptionDefault(option.id, 'grouped', groupIndex)}
                                        />
                                        <Button
                                          variant="outline-danger"
                                          onClick={() => {
                                            const nextGroups = [...selectOptionGroups];
                                            nextGroups[groupIndex].options = nextGroups[groupIndex].options.filter((_, index) => index !== optionIndex);
                                            updateSelectGroupsFromRows(nextGroups);
                                          }}
                                        >
                                          Delete
                                        </Button>
                                      </div>
                                    ))
                                  )}

                                  <Button
                                    variant="outline-success"
                                    className="align-self-start"
                                    onClick={() => {
                                      const nextGroups = [...selectOptionGroups];
                                      nextGroups[groupIndex].options = [
                                        ...nextGroups[groupIndex].options,
                                        createSelectOptionRow(
                                          `option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                                          '',
                                          '',
                                          false
                                        )
                                      ];
                                      updateSelectGroupsFromRows(nextGroups);
                                    }}
                                  >
                                    Add option
                                  </Button>
                                </div>
                              ))
                            )}
                          </>
                        ) : (
                          <>
                            {selectOptionRows.length === 0 ? (
                              <div className="text-secondary">No options added yet.</div>
                            ) : (
                              selectOptionRows.map((option, index) => (
                                <div key={option.id || `option-${index}`} className="d-flex gap-2 align-items-end">
                                  <Form.Group className="mb-0 flex-fill">
                                    <Form.Label>{controlDraft.type === 'font' ? 'Font label' : 'Option Label'}</Form.Label>
                                    <Form.Control
                                      value={option.label}
                                      onChange={(event) => {
                                        const nextRows = [...selectOptionRows];
                                        nextRows[index] = { ...nextRows[index], label: event.target.value };
                                        updateSelectOptionsFromRows(nextRows);
                                      }}
                                    />
                                  </Form.Group>
                                  <Form.Group className="mb-0 flex-fill">
                                    <Form.Label>{controlDraft.type === 'font' ? 'Font name' : 'Option name'}</Form.Label>
                                    <Form.Control
                                      value={option.name}
                                      onChange={(event) => {
                                        const nextRows = [...selectOptionRows];
                                        nextRows[index] = { ...nextRows[index], name: event.target.value };
                                        updateSelectOptionsFromRows(nextRows);
                                      }}
                                    />
                                  </Form.Group>
                                  <Form.Check
                                    type="switch"
                                    id={`select-default-${option.id || index}`}
                                    label="Default"
                                    checked={Boolean(option.isDefault)}
                                    onChange={() => {
                                      if (controlDraft.type === 'select2' && controlDraft.multiple) {
                                        setSelectOptionDefault(option.id, 'flat');
                                        return;
                                      }

                                      const nextRows = selectOptionRows.map((row, rowIndex) => ({
                                        ...row,
                                        isDefault: rowIndex === index
                                      }));
                                      updateSelectOptionsFromRows(nextRows);
                                    }}
                                  />
                                  <Button
                                    variant="outline-danger"
                                    onClick={() => updateSelectOptionsFromRows(selectOptionRows.filter((_, rowIndex) => rowIndex !== index))}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              ))
                            )}
                            <Button
                              variant="outline-success"
                              className="align-self-start"
                              onClick={() => updateSelectOptionsFromRows([
                                ...selectOptionRows,
                                createSelectOptionRow(`option-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, '', '', false)
                              ])}
                            >
                              Add option
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </Accordion.Body>
              </Accordion.Item>
            )}
          </Accordion>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setControlDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveControlToSection}>Save</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={categoryDialogOpen} onHide={() => setCategoryDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{categoryDraft.id ? 'Update widget category' : 'Add widget category'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <Form.Group className="mb-0">
              <Form.Label>Category Title</Form.Label>
              <Form.Control
                value={categoryDraft.categoryTitle}
                onChange={(event) => {
                  const categoryTitle = event.target.value;
                  setCategoryDraft((current) => ({
                    ...current,
                    categoryTitle,
                    categoryName: (!current.id && categoryTitle.trim()) ? sanitizeWidgetCategoryName(categoryTitle) : current.categoryName
                  }));
                }}
              />
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>Category Name</Form.Label>
              <InputGroup>
                <InputGroup.Text>{projectPrefix}_</InputGroup.Text>
                <Form.Control
                  value={categoryDraft.categoryName}
                  pattern="[a-z0-9_]+"
                  isInvalid={Boolean(categoryDraft.categoryName) && !isValidWidgetCategoryName(categoryDraft.categoryName)}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    const nextValue = rawValue.trim() === '' ? '' : sanitizeWidgetCategoryName(rawValue);
                    setCategoryDraft((current) => ({ ...current, categoryName: nextValue }));
                  }}
                />
              </InputGroup>
              <Form.Control.Feedback type="invalid">
                Use lowercase letters, numbers, and underscores only.
              </Form.Control.Feedback>
            </Form.Group>
            <ElementorIconPicker
              label="Category Icon"
              value={categoryDraft.categoryIcon}
              onChange={(nextValue) => setCategoryDraft((current) => ({ ...current, categoryIcon: nextValue || 'eicon-posts-ticker' }))}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveCategory}>Save</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={widgetDialogOpen}
        onHide={() => setWidgetDialogOpen(false)}
        centered
        dialogClassName="widget-modal-dialog"
      >
        <Modal.Header closeButton>
          <Modal.Title>{widgetDraft.id ? 'Update widget' : 'Add widget'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form style={formGridStyle}>
            <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
              <Form.Label>Widget title</Form.Label>
              <Form.Control
                value={widgetDraft.title}
                onChange={(event) => setWidgetDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  name: current.id ? current.name : getWidgetNameFromTitle(event.target.value)
                }))}
              />
            </Form.Group>
            <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
              <Form.Label>Widget name</Form.Label>
              <InputGroup>
                <InputGroup.Text>{projectPrefix}_</InputGroup.Text>
                <Form.Control
                  value={widgetDraft.name}
                  onChange={(event) => setWidgetDraft((current) => ({
                    ...current,
                    name: normalizeWidgetName(event.target.value)
                  }))}
                />
              </InputGroup>
            </Form.Group>
            <Form.Group className="mb-0" style={{ gridColumn: '1 / span 1' }}>
              <Form.Label>Widget description</Form.Label>
              <Form.Control value={widgetDraft.description} onChange={(event) => setWidgetDraft((current) => ({ ...current, description: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-0" style={{ gridColumn: '2 / span 1' }}>
              <Form.Label>Keywords</Form.Label>
              <Form.Control value={widgetDraft.keywords} onChange={(event) => setWidgetDraft((current) => ({ ...current, keywords: event.target.value }))} />
            </Form.Group>
            <div style={{ ...formFullWidthStyle }}>
              <ElementorIconPicker
                label="Widget icon"
                value={widgetDraft.icon}
                onChange={(nextValue) => setWidgetDraft((current) => ({ ...current, icon: nextValue || 'eicon-text' }))}
              />
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setWidgetDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveWidget}>Save</Button>
        </Modal.Footer>
      </Modal>


      <Modal show={Boolean(deleteConfirmation?.open)} onHide={() => setDeleteConfirmation(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete {deleteConfirmation?.label ?? 'this item'}? This action cannot be undone.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDeleteConfirmation(null)}>Cancel</Button>
          <Button variant="outline-danger" onClick={executeDeleteConfirmation}>Delete</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={categoryDeleteDialogOpen} onHide={() => setCategoryDeleteDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete widget category</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to delete the widget category "{categoryDeleteDraft.categoryLabel}"?
          </p>
          <Form.Check
            type="switch"
            label="Delete widgets in this category"
            checked={categoryDeleteDraft.deleteWidgets}
            onChange={(event) => setCategoryDeleteDraft((current) => ({ ...current, deleteWidgets: event.target.checked }))}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setCategoryDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-danger" onClick={() => removeCategory({
            id: categoryDeleteDraft.categoryId,
            text: categoryDeleteDraft.categoryLabel,
            slug: categoryDeleteDraft.categoryLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')
          })}>Delete</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={sectionDialogOpen} onHide={() => setSectionDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add section</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
            <Form.Group className="mb-0">
              <Form.Label>Section label</Form.Label>
              <Form.Control
                value={sectionDraft.label}
                onChange={(event) => {
                  const nextLabel = event.target.value;
                  setSectionDraft((current) => {
                    const normalizedNextName = normalizeSectionName(nextLabel);
                    const shouldSyncName = !current.name || current.name === normalizeSectionName(current.label || '');

                    return {
                      ...current,
                      label: nextLabel,
                      name: shouldSyncName ? normalizedNextName : current.name
                    };
                  });
                }}
              />
            </Form.Group>
            <Form.Group className="mb-0">
              <Form.Label>Section name</Form.Label>
              <Form.Control
                value={sectionDraft.name}
                onChange={(event) => setSectionDraft((current) => ({ ...current, name: normalizeSectionName(event.target.value) }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Section tab</Form.Label>
              <Form.Select value={sectionDraft.tab || 'content'} onChange={(event) => setSectionDraft((current) => ({ ...current, tab: event.target.value }))}>
                <option value="content">Content</option>
                <option value="style">Style</option>
                <option value="advanced">Advanced</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={addSectionToWidget}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectWidgets;
