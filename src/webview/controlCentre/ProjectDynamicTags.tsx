import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type DynamicTagAction = 'add' | 'remove';

export type DynamicTagDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  group: string;
  categories: string | string[];
  action: DynamicTagAction;
  selectedDynamicTagName: string;
  customDynamicTagName: string;
};

const normalizeDynamicTagName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'dynamic_tag';
};

const normalizeGroupName = (value: string): string => value.trim() || 'site';

const parseDynamicTagCategories = (value: string | string[] | undefined): string[] => {
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

export const getDynamicTagActionOptions = () => [
  { value: 'add', label: 'Add Dynamic Tag' },
  { value: 'remove', label: 'Remove Dynamic Tag' }
] as const;

export const updateProjectDynamicTagCollection = (
  project: BuilderProject,
  draft: Partial<DynamicTagDraft>
): BuilderProject => {
  const existingDynamicTags = Array.isArray(project.dynamicTags) ? [...project.dynamicTags] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeDynamicTagName(draft.selectedDynamicTagName || draft.customDynamicTagName || draft.name || '');
    return {
      ...project,
      dynamicTags: existingDynamicTags.filter((entry) => normalizeDynamicTagName(entry.name || '') !== selectedName)
    };
  }

  const name = normalizeDynamicTagName(draft.customDynamicTagName || draft.name || '');
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const group = normalizeGroupName(draft.group ?? 'site');
  const categories = parseDynamicTagCategories(draft.categories ?? '');
  const id = draft.id || `dynamic-tag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextDynamicTags = [...existingDynamicTags];
  const targetIndex = nextDynamicTags.findIndex((entry) => normalizeDynamicTagName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'dynamic-tag',
      title,
      group,
      categories,
      is_active: true,
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextDynamicTags[targetIndex] = { ...nextDynamicTags[targetIndex], ...entry, data: { ...(nextDynamicTags[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextDynamicTags.push(entry);
  }

  return {
    ...project,
    dynamicTags: nextDynamicTags,
  };
};

const getDynamicTagCollection = (project: BuilderProject) => project.dynamicTags ?? [];

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

export const ProjectDynamicTags: React.FC<{
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
  const [draft, setDraft] = React.useState<DynamicTagDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    group: 'site',
    categories: '',
    action: 'add',
    selectedDynamicTagName: '',
    customDynamicTagName: '',
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    const categoriesValue = Array.isArray(data.categories)
      ? data.categories.map((item) => String(item)).join(', ')
      : typeof data.categories === 'string'
        ? data.categories
        : '';

    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      title: typeof data.title === 'string' ? data.title : '',
      description: entry?.description ?? '',
      group: typeof data.group === 'string' ? data.group : 'site',
      categories: categoriesValue,
      action: entry ? 'add' : 'add',
      selectedDynamicTagName: entry?.name ?? '',
      customDynamicTagName: entry?.name ?? '',
    });
    setDialogOpen(true);
  };

  const persistDynamicTag = (nextProject: BuilderProject, operation: DynamicTagAction, dynamicTagName: string, dynamicTagData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-dynamic-tag-definition',
        payload: {
          project: nextProject,
          dynamicTagName,
          operation,
          dynamicTagData: dynamicTagData ?? null,
        },
      });
    }
  };

  const saveDynamicTag = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeDynamicTagName(draft.selectedDynamicTagName === '__custom__' ? draft.customDynamicTagName : draft.selectedDynamicTagName || draft.name)
      : normalizeDynamicTagName(draft.customDynamicTagName || draft.name || draft.selectedDynamicTagName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the dynamic tag you want to remove.' });
      return;
    }

    const nextProject = updateProjectDynamicTagCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const tagData = {
        id: draft.id || `dynamic-tag-${Date.now()}`,
        name: nameToPersist,
        title: (draft.title ?? '').trim() || nameToPersist.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
        description: (draft.description ?? '').trim(),
        group: normalizeGroupName(draft.group ?? 'site'),
        categories: parseDynamicTagCategories(draft.categories ?? ''),
        kind: 'dynamic-tag',
      };
      persistDynamicTag(nextProject, 'add', nameToPersist, tagData);
      notify?.({ type: 'success', message: `Dynamic tag saved: ${nameToPersist}.` });
    } else {
      persistDynamicTag(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Dynamic tag removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', group: 'site', categories: '', action: 'add', selectedDynamicTagName: '', customDynamicTagName: '' });
  };

  const removeDynamicTag = (entry: ProjectEntityEntry) => {
    const dynamicTagName = normalizeDynamicTagName(entry.name || '');
    const nextProject = updateProjectDynamicTagCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedDynamicTagName: entry.name,
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistDynamicTag(nextProject, 'remove', dynamicTagName, null);
    notify?.({ type: 'success', message: `Dynamic tag removed: ${dynamicTagName}.` });
  };

  const dynamicTags = getDynamicTagCollection(project);
  const existingDynamicTagOptions = dynamicTags.map((entry) => ({
    value: entry.name,
    label: entry.name,
  }));

  return (
    <>
      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <h5 className="mb-0">Dynamic Tags</h5>
          <Button variant="outline-success" onClick={() => openDialog()}>Add dynamic tag</Button>
        </div>

        <div style={listCardStyle}>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Group</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dynamicTags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">No dynamic tags created yet.</td>
                </tr>
              ) : (
                dynamicTags.map((entry) => {
                  const data = (entry.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                      <td>{typeof data.group === 'string' ? data.group : '—'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="outline-info" size="sm" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => removeDynamicTag(entry)}>Remove</Button>
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
          <Modal.Title>{draft.id ? 'Edit dynamic tag' : 'Create dynamic tag'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              {getDynamicTagActionOptions().map((option) => (
                <Form.Check
                  key={option.value}
                  type="radio"
                  name="dynamicTagAction"
                  label={option.label}
                  checked={draft.action === option.value}
                  onChange={() => setDraft((current) => ({ ...current, action: option.value }))}
                />
              ))}
            </Form.Group>

            {draft.action === 'remove' ? (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Existing dynamic tag</Form.Label>
                  <Form.Select
                    value={draft.selectedDynamicTagName || existingDynamicTagOptions[0]?.value || ''}
                    onChange={(event) => setDraft((current) => ({ ...current, selectedDynamicTagName: event.target.value }))}
                  >
                    {existingDynamicTagOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value="__custom__">Custom</option>
                  </Form.Select>
                </Form.Group>
                {draft.selectedDynamicTagName === '__custom__' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Dynamic tag name</Form.Label>
                    <Form.Control type="text" value={draft.customDynamicTagName} onChange={(event) => setDraft((current) => ({ ...current, customDynamicTagName: event.target.value }))} />
                  </Form.Group>
                )}
              </>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Dynamic tag name</Form.Label>
                  <Form.Control type="text" value={draft.customDynamicTagName || draft.name} onChange={(event) => setDraft((current) => ({ ...current, customDynamicTagName: event.target.value, name: event.target.value }))} />
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
                  <Form.Control type="text" value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Categories (comma separated)</Form.Label>
                  <Form.Control type="text" value={Array.isArray(draft.categories) ? draft.categories.join(', ') : draft.categories} onChange={(event) => setDraft((current) => ({ ...current, categories: event.target.value }))} />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveDynamicTag}>{draft.action === 'remove' ? 'Remove' : 'Save'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectDynamicTags;
