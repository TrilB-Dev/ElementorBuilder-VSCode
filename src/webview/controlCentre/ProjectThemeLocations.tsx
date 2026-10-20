import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type ThemeLocationAction = 'add' | 'remove';

export type ThemeLocationDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  location: string;
  hook: string;
  action: ThemeLocationAction;
  selectedThemeLocationName: string;
  customThemeLocationName: string;
};

export const THEME_LOCATION_OPTIONS = [
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
  { value: 'single', label: 'Single' },
  { value: 'archive', label: 'Archive' },
  { value: 'search', label: 'Search' },
  { value: 'author', label: 'Author' },
  { value: 'date', label: 'Date' },
  { value: '404', label: '404' },
  { value: 'custom', label: 'Custom' },
] as const;

const normalizeThemeLocationName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'theme_location';
};

export const getThemeLocationActionOptions = () => [
  { value: 'add', label: 'Add Theme Location' },
  { value: 'remove', label: 'Remove Theme Location' }
] as const;

export const updateProjectThemeLocationCollection = (
  project: BuilderProject,
  draft: Partial<ThemeLocationDraft>
): BuilderProject => {
  const existingThemeLocations = Array.isArray(project.themeLocations) ? [...project.themeLocations] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeThemeLocationName(draft.selectedThemeLocationName || draft.customThemeLocationName || draft.name || '');
    return {
      ...project,
      themeLocations: existingThemeLocations.filter((entry) => normalizeThemeLocationName(entry.name || '') !== selectedName),
    };
  }

  const name = normalizeThemeLocationName(draft.customThemeLocationName || draft.name || '');
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const location = (draft.location ?? 'header').trim() || 'header';
  const hook = (draft.hook ?? '').trim();
  const id = draft.id || `theme-location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextThemeLocations = [...existingThemeLocations];
  const targetIndex = nextThemeLocations.findIndex((entry) => normalizeThemeLocationName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'theme-location',
      title,
      location,
      hook,
      is_active: true,
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextThemeLocations[targetIndex] = { ...nextThemeLocations[targetIndex], ...entry, data: { ...(nextThemeLocations[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextThemeLocations.push(entry);
  }

  return {
    ...project,
    themeLocations: nextThemeLocations,
  };
};

const getThemeLocationCollection = (project: BuilderProject) => project.themeLocations ?? [];

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

export const ProjectThemeLocations: React.FC<{
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
  const [draft, setDraft] = React.useState<ThemeLocationDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    location: 'header',
    hook: '',
    action: 'add',
    selectedThemeLocationName: '',
    customThemeLocationName: '',
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      title: typeof data.title === 'string' ? data.title : '',
      description: entry?.description ?? '',
      location: typeof data.location === 'string' ? data.location : 'header',
      hook: typeof data.hook === 'string' ? data.hook : '',
      action: entry ? 'add' : 'add',
      selectedThemeLocationName: entry?.name ?? '',
      customThemeLocationName: entry?.name ?? '',
    });
    setDialogOpen(true);
  };

  const persistThemeLocation = (nextProject: BuilderProject, operation: ThemeLocationAction, themeLocationName: string, themeLocationData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-theme-location-definition',
        payload: {
          project: nextProject,
          themeLocationName,
          operation,
          themeLocationData: themeLocationData ?? null,
        },
      });
    }
  };

  const saveThemeLocation = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeThemeLocationName(draft.selectedThemeLocationName === '__custom__' ? draft.customThemeLocationName : draft.selectedThemeLocationName || draft.name)
      : normalizeThemeLocationName(draft.customThemeLocationName || draft.name || draft.selectedThemeLocationName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the theme location you want to remove.' });
      return;
    }

    const nextProject = updateProjectThemeLocationCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const themeLocationData = {
        id: draft.id || `theme-location-${Date.now()}`,
        name: nameToPersist,
        title: (draft.title ?? '').trim() || nameToPersist.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
        description: (draft.description ?? '').trim(),
        location: (draft.location ?? 'header').trim() || 'header',
        hook: (draft.hook ?? '').trim(),
        kind: 'theme-location',
      };
      persistThemeLocation(nextProject, 'add', nameToPersist, themeLocationData);
      notify?.({ type: 'success', message: `Theme location saved: ${nameToPersist}.` });
    } else {
      persistThemeLocation(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Theme location removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', location: 'header', hook: '', action: 'add', selectedThemeLocationName: '', customThemeLocationName: '' });
  };

  const removeThemeLocation = (entry: ProjectEntityEntry) => {
    const themeLocationName = normalizeThemeLocationName(entry.name || '');
    const nextProject = updateProjectThemeLocationCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedThemeLocationName: entry.name,
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistThemeLocation(nextProject, 'remove', themeLocationName, null);
    notify?.({ type: 'success', message: `Theme location removed: ${themeLocationName}.` });
  };

  const themeLocations = getThemeLocationCollection(project);

  return (
    <>
      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <h5 className="mb-0">Theme Locations</h5>
          <Button variant="outline-success" onClick={() => openDialog()}>Add theme location</Button>
        </div>

        <div style={listCardStyle}>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Location</th>
                <th>Hook</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {themeLocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted">No theme locations created yet.</td>
                </tr>
              ) : (
                themeLocations.map((entry) => {
                  const data = (entry.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                      <td>{typeof data.location === 'string' ? data.location : '—'}</td>
                      <td>{typeof data.hook === 'string' ? data.hook : '—'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="outline-info" size="sm" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => removeThemeLocation(entry)}>Remove</Button>
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
          <Modal.Title>{draft.id ? 'Update theme location' : 'Create theme location'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Theme location name</Form.Label>
              <Form.Control type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, customThemeLocationName: event.target.value }))} />
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
              <Form.Label>Location</Form.Label>
              <Form.Select value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}>
                {THEME_LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Hook</Form.Label>
              <Form.Control type="text" value={draft.hook} onChange={(event) => setDraft((current) => ({ ...current, hook: event.target.value }))} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveThemeLocation}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectThemeLocations;
