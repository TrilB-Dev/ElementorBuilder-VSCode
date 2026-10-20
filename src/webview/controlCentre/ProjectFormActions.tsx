import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type FormActionDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  group: string;
  action: 'add';
};

const normalizeFormActionName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'form_action';
};

export const getFormActionOptions = () => [
  { value: 'add', label: 'Add Form Action' }
] as const;

export const updateProjectFormActionCollection = (
  project: BuilderProject,
  draft: Partial<FormActionDraft>
): BuilderProject => {
  const existingFormActions = Array.isArray(project.formActions) ? [...project.formActions] : [];
  const name = normalizeFormActionName(draft.name ?? '');
  const description = (draft.description ?? '').trim();
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const group = (draft.group ?? '').trim() || 'email';
  const id = draft.id || `form-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextFormActions = [...existingFormActions];
  const targetIndex = nextFormActions.findIndex((entry) => normalizeFormActionName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'form-action',
      title,
      group,
      is_active: true
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextFormActions[targetIndex] = { ...nextFormActions[targetIndex], ...entry, data: { ...(nextFormActions[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextFormActions.push(entry);
  }

  return {
    ...project,
    formActions: nextFormActions
  };
};

export const ProjectFormActions: React.FC<{
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
  const [draft, setDraft] = React.useState<FormActionDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    group: 'email',
    action: 'add'
  });

  const persistFormAction = (nextProject: BuilderProject, formActionName: string, formActionData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-form-action-definition',
        payload: {
          project: nextProject,
          formActionName,
          formActionData: formActionData ?? null
        }
      });
    }
  };

  const saveFormAction = () => {
    if (!draft.name.trim()) {
      notify?.({ type: 'error', message: 'Please enter a form action name.' });
      return;
    }

    const nextProject = updateProjectFormActionCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    const formActionName = normalizeFormActionName(draft.name);
    const formActionData = {
      id: draft.id || `form-action-${Date.now()}`,
      name: formActionName,
      title: (draft.title ?? '').trim() || formActionName.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
      description: (draft.description ?? '').trim(),
      group: (draft.group ?? '').trim() || 'email',
      kind: 'form-action'
    };

    persistFormAction(nextProject, formActionName, formActionData);
    notify?.({ type: 'success', message: `Form action saved: ${formActionName}.` });

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', group: 'email', action: 'add' });
  };

  const formActions = Array.isArray(project.formActions) ? project.formActions : [];

  return (
    <>
      <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '18px', padding: '1.25rem', background: 'var(--vscode-panel-background)' }}>
        <div className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0">Form Actions</h5>
            <Button variant="outline-success" onClick={() => setDialogOpen(true)}>Add form action</Button>
          </div>

          <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
            <Table size="sm" striped bordered hover className="mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Group</th>
                </tr>
              </thead>
              <tbody>
                {formActions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-secondary py-3">No form actions created yet.</td>
                  </tr>
                ) : (
                  formActions.map((entry) => {
                    const data = (entry.data ?? {}) as Record<string, unknown>;
                    return (
                      <tr key={entry.id || entry.name}>
                        <td>{entry.name}</td>
                        <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                        <td>{typeof data.group === 'string' ? data.group : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>

      <Modal show={dialogOpen} onHide={() => setDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create form action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Form action name</Form.Label>
              <Form.Control value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Group</Form.Label>
              <Form.Control value={draft.group} onChange={(event) => setDraft((current) => ({ ...current, group: event.target.value || 'email' }))} />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveFormAction}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectFormActions;
