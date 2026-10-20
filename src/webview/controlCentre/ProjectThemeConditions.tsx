import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type ThemeConditionAction = 'add' | 'remove';

export type ThemeConditionDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  group: string;
  conditionType: string;
  subConditions: string;
  action: ThemeConditionAction;
  selectedThemeConditionName: string;
  customThemeConditionName: string;
};

export const THEME_CONDITION_GROUPS = [
  { value: 'single', label: 'Single' },
  { value: 'archive', label: 'Archive' },
  { value: 'page', label: 'Page' },
  { value: 'search', label: 'Search' },
  { value: '404', label: '404' },
  { value: 'author', label: 'Author' },
  { value: 'date', label: 'Date' },
  { value: 'front_page', label: 'Front Page' },
] as const;

const normalizeThemeConditionName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'theme_condition';
};

const parseSubConditions = (value: string | string[] | undefined): string[] => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]+/)
      : [];

  return items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => item.replace(/\s+/g, '_').toLowerCase());
};

export const getThemeConditionActionOptions = () => [
  { value: 'add', label: 'Add Theme Condition' },
  { value: 'remove', label: 'Remove Theme Condition' }
] as const;

export const updateProjectThemeConditionCollection = (
  project: BuilderProject,
  draft: Partial<ThemeConditionDraft>
): BuilderProject => {
  const existingThemeConditions = Array.isArray(project.themeConditions) ? [...project.themeConditions] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeThemeConditionName(draft.selectedThemeConditionName || draft.customThemeConditionName || draft.name || '');
    return {
      ...project,
      themeConditions: existingThemeConditions.filter((entry) => normalizeThemeConditionName(entry.name || '') !== selectedName),
    };
  }

  const name = normalizeThemeConditionName(draft.customThemeConditionName || draft.name || '');
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const group = (draft.group ?? '').trim() || 'single';
  const conditionType = (draft.conditionType ?? group).trim() || 'single';
  const subConditions = parseSubConditions(draft.subConditions ?? '');
  const id = draft.id || `theme-condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextThemeConditions = [...existingThemeConditions];
  const targetIndex = nextThemeConditions.findIndex((entry) => normalizeThemeConditionName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'theme-condition',
      title,
      group,
      condition_type: conditionType,
      sub_conditions: subConditions,
      is_active: true,
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextThemeConditions[targetIndex] = { ...nextThemeConditions[targetIndex], ...entry, data: { ...(nextThemeConditions[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextThemeConditions.push(entry);
  }

  return {
    ...project,
    themeConditions: nextThemeConditions,
  };
};

const getThemeConditionCollection = (project: BuilderProject) => project.themeConditions ?? [];

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '18px',
  padding: '20px',
  background: 'var(--vscode-panel-background)',
  boxSizing: 'border-box',
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px',
};

const listCardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '10px',
  padding: '12px',
  background: 'rgba(128, 128, 128, 0.02)',
};

export const ProjectThemeConditions: React.FC<{
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
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<ThemeConditionDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    group: 'single',
    conditionType: 'single',
    subConditions: '',
    action: 'add',
    selectedThemeConditionName: '',
    customThemeConditionName: '',
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    const subConditions = Array.isArray(data.sub_conditions)
      ? data.sub_conditions.map((item) => String(item)).join(', ')
      : typeof data.sub_conditions === 'string'
        ? data.sub_conditions
        : '';

    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      title: typeof data.title === 'string' ? data.title : '',
      description: entry?.description ?? '',
      group: typeof data.group === 'string' ? data.group : 'single',
      conditionType: typeof data.condition_type === 'string' ? data.condition_type : 'single',
      subConditions,
      action: entry ? 'add' : 'add',
      selectedThemeConditionName: entry?.name ?? '',
      customThemeConditionName: entry?.name ?? '',
    });
    setDialogOpen(true);
  };

  const persistThemeCondition = (nextProject: BuilderProject, operation: ThemeConditionAction, themeConditionName: string, themeConditionData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-theme-condition-definition',
        payload: {
          project: nextProject,
          themeConditionName,
          operation,
          themeConditionData: themeConditionData ?? null,
        },
      });
    }
  };

  const saveThemeCondition = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeThemeConditionName(draft.selectedThemeConditionName === '__custom__' ? draft.customThemeConditionName : draft.selectedThemeConditionName || draft.name)
      : normalizeThemeConditionName(draft.customThemeConditionName || draft.name || draft.selectedThemeConditionName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the theme condition you want to remove.' });
      return;
    }

    const nextProject = updateProjectThemeConditionCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const themeConditionData = {
        id: draft.id || `theme-condition-${Date.now()}`,
        name: nameToPersist,
        title: (draft.title ?? '').trim() || nameToPersist.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
        description: (draft.description ?? '').trim(),
        group: (draft.group ?? '').trim() || 'single',
        condition_type: (draft.conditionType ?? '').trim() || 'single',
        sub_conditions: parseSubConditions(draft.subConditions ?? ''),
        kind: 'theme-condition',
      };
      persistThemeCondition(nextProject, 'add', nameToPersist, themeConditionData);
      notify?.({ type: 'success', message: `Theme condition saved: ${nameToPersist}.` });
    } else {
      persistThemeCondition(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Theme condition removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', group: 'single', conditionType: 'single', subConditions: '', action: 'add', selectedThemeConditionName: '', customThemeConditionName: '' });
  };

  const removeThemeCondition = (entry: ProjectEntityEntry) => {
    const themeConditionName = normalizeThemeConditionName(entry.name || '');
    const nextProject = updateProjectThemeConditionCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedThemeConditionName: entry.name,
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistThemeCondition(nextProject, 'remove', themeConditionName, null);
    notify?.({ type: 'success', message: `Theme condition removed: ${themeConditionName}.` });
  };

  const themeConditions = getThemeConditionCollection(project);

  return (
    <>
      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <h5 className="mb-0">Theme Conditions</h5>
          <Button variant="outline-success" onClick={() => openDialog()}>Add theme condition</Button>
        </div>

        <div style={listCardStyle}>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Group</th>
                <th>Type</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {themeConditions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted">No theme conditions created yet.</td>
                </tr>
              ) : (
                themeConditions.map((entry) => {
                  const data = (entry.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                      <td>{typeof data.group === 'string' ? data.group : '—'}</td>
                      <td>{typeof data.condition_type === 'string' ? data.condition_type : '—'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="outline-info" size="sm" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => removeThemeCondition(entry)}>Remove</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <Modal show={dialogOpen} onHide={() => setDialogOpen(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{draft.id ? 'Update theme condition' : 'Create theme condition'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Theme condition name</Form.Label>
              <Form.Control type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, customThemeConditionName: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control type="text" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control type="text" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Group</Form.Label>
              <Form.Select value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value }))}>
                {THEME_CONDITION_GROUPS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Condition type</Form.Label>
              <Form.Select value={draft.conditionType} onChange={(event) => setDraft((current) => ({ ...current, conditionType: event.target.value }))}>
                {THEME_CONDITION_GROUPS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Sub conditions (comma or newline separated)</Form.Label>
              <Form.Control type="text" value={draft.subConditions} onChange={(event) => setDraft((current) => ({ ...current, subConditions: event.target.value }))} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveThemeCondition}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectThemeConditions;
