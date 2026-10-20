import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';
import { ElementorIconPicker } from '../ElementorIconPicker';

export type FinderCategoryAction = 'add' | 'remove';

export type FinderCategoryDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  keywords: string;
  action: FinderCategoryAction;
  selectedFinderCategoryName: string;
  customFinderCategoryName: string;
};

const normalizeFinderCategoryName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'finder_category';
};

const parseKeywords = (value: string | string[] | undefined): string[] => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]+/)
      : [];

  return items
    .map((item) => String(item).trim())
    .filter(Boolean);
};

export const getFinderCategoryActionOptions = () => [
  { value: 'add', label: 'Add Finder Category' },
  { value: 'remove', label: 'Remove Finder Category' }
] as const;

export const updateProjectFinderCategoryCollection = (
  project: BuilderProject,
  draft: Partial<FinderCategoryDraft>
): BuilderProject => {
  const existingFinderCategories = Array.isArray(project.finderCategories) ? [...project.finderCategories] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeFinderCategoryName(draft.selectedFinderCategoryName || draft.customFinderCategoryName || draft.name || '');
    return {
      ...project,
      finderCategories: existingFinderCategories.filter((entry) => normalizeFinderCategoryName(entry.name || '') !== selectedName),
    };
  }

  const name = normalizeFinderCategoryName(draft.customFinderCategoryName || draft.name || '');
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const icon = (draft.icon ?? '').trim() || 'eicon-search';
  const keywords = parseKeywords(draft.keywords ?? []);
  const id = draft.id || `finder-category-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextFinderCategories = [...existingFinderCategories];
  const targetIndex = nextFinderCategories.findIndex((entry) => normalizeFinderCategoryName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'finder-category',
      title,
      icon,
      keywords,
      is_active: true,
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextFinderCategories[targetIndex] = { ...nextFinderCategories[targetIndex], ...entry, data: { ...(nextFinderCategories[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextFinderCategories.push(entry);
  }

  return {
    ...project,
    finderCategories: nextFinderCategories,
  };
};

const getFinderCategoryCollection = (project: BuilderProject) => project.finderCategories ?? [];

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

export const ProjectFinder: React.FC<{
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
  const [draft, setDraft] = React.useState<FinderCategoryDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    icon: 'eicon-search',
    keywords: '',
    action: 'add',
    selectedFinderCategoryName: '',
    customFinderCategoryName: '',
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    const keywords = Array.isArray(data.keywords)
      ? data.keywords.map((item) => String(item)).join(', ')
      : typeof data.keywords === 'string'
        ? data.keywords
        : '';

    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      title: typeof data.title === 'string' ? data.title : '',
      description: entry?.description ?? '',
      icon: typeof data.icon === 'string' ? data.icon : 'eicon-search',
      keywords,
      action: entry ? 'add' : 'add',
      selectedFinderCategoryName: entry?.name ?? '',
      customFinderCategoryName: entry?.name ?? '',
    });
    setDialogOpen(true);
  };

  const persistFinderCategory = (nextProject: BuilderProject, operation: FinderCategoryAction, finderCategoryName: string, finderCategoryData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-finder-category-definition',
        payload: {
          project: nextProject,
          finderCategoryName,
          operation,
          finderCategoryData: finderCategoryData ?? null,
        },
      });
    }
  };

  const saveFinderCategory = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeFinderCategoryName(draft.selectedFinderCategoryName === '__custom__' ? draft.customFinderCategoryName : draft.selectedFinderCategoryName || draft.name)
      : normalizeFinderCategoryName(draft.customFinderCategoryName || draft.name || draft.selectedFinderCategoryName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the finder category you want to remove.' });
      return;
    }

    const nextProject = updateProjectFinderCategoryCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const finderCategoryData = {
        id: draft.id || `finder-category-${Date.now()}`,
        name: nameToPersist,
        title: (draft.title ?? '').trim() || nameToPersist.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
        description: (draft.description ?? '').trim(),
        icon: (draft.icon ?? '').trim() || 'eicon-search',
        keywords: parseKeywords(draft.keywords ?? []),
        kind: 'finder-category',
      };
      persistFinderCategory(nextProject, 'add', nameToPersist, finderCategoryData);
      notify?.({ type: 'success', message: `Finder category saved: ${nameToPersist}.` });
    } else {
      persistFinderCategory(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Finder category removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', icon: 'eicon-search', keywords: '', action: 'add', selectedFinderCategoryName: '', customFinderCategoryName: '' });
  };

  const removeFinderCategory = (entry: ProjectEntityEntry) => {
    const finderCategoryName = normalizeFinderCategoryName(entry.name || '');
    const nextProject = updateProjectFinderCategoryCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedFinderCategoryName: entry.name,
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistFinderCategory(nextProject, 'remove', finderCategoryName, null);
    notify?.({ type: 'success', message: `Finder category removed: ${finderCategoryName}.` });
  };

  const finderCategories = getFinderCategoryCollection(project);

  return (
    <>
      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <h5 className="mb-0">Finder Categories</h5>
          <Button variant="outline-success" onClick={() => openDialog()}>Add finder category</Button>
        </div>

        <div style={listCardStyle}>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Icon</th>
                <th>Keywords</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {finderCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted">No finder categories created yet.</td>
                </tr>
              ) : (
                finderCategories.map((entry) => {
                  const data = (entry.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                      <td>{typeof data.icon === 'string' ? data.icon : '—'}</td>
                      <td>{Array.isArray(data.keywords) ? data.keywords.join(', ') : '—'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="outline-info" size="sm" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => removeFinderCategory(entry)}>Remove</Button>
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
          <Modal.Title>{draft.id ? 'Update finder category' : 'Create finder category'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Finder category name</Form.Label>
              <Form.Control type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, customFinderCategoryName: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control type="text" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control type="text" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </Form.Group>
            <ElementorIconPicker
              label="Icon class"
              value={draft.icon}
              onChange={(nextValue) => setDraft((current) => ({ ...current, icon: nextValue }))}
            />
            <Form.Group className="mb-3">
              <Form.Label>Keywords (comma or newline separated)</Form.Label>
              <Form.Control type="text" value={draft.keywords} onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveFinderCategory}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectFinder;
