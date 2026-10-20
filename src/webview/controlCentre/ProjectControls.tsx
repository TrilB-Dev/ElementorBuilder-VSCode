import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { CONTROL_TYPES, createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type ControlAction = 'add' | 'remove';

export type ControlDraft = {
  id: string;
  name: string;
  label: string;
  description: string;
  defaultValue: string;
  placeholder: string;
  options: string;
  condition: string;
  returnValue: string;
  type: string;
  showLabel: boolean;
  labelBlock: boolean;
  min: string;
  max: string;
  step: string;
  action: ControlAction;
  selectedControlName: string;
  customControlName: string;
};

const normalizeControlName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'custom_control';
};

export const getControlActionOptions = () => [
  { value: 'add', label: 'Add Control' },
  { value: 'remove', label: 'Remove Control' }
] as const;

export const getControlTypeOptions = () => CONTROL_TYPES.map(({ value, label }) => ({ value, label }));

export const updateProjectControlCollection = (
  project: BuilderProject,
  draft: Partial<ControlDraft>
): BuilderProject => {
  const existingControls = Array.isArray(project.controls) ? [...project.controls] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeControlName(draft.selectedControlName || draft.customControlName || draft.name || '');

    return {
      ...project,
      controls: existingControls.filter((entry) => normalizeControlName(entry.name || '') !== selectedName)
    };
  }

  const name = normalizeControlName(draft.customControlName || draft.name || '');
  const description = (draft.description ?? '').trim();
  const type = draft.type ?? 'text';
  const id = draft.id || `control-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextControls = [...existingControls];
  const targetIndex = nextControls.findIndex((entry) => normalizeControlName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      type,
      kind: 'custom-control',
      label: draft.label ?? '',
      default: draft.defaultValue ?? '',
      placeholder: draft.placeholder ?? '',
      options: draft.options ?? '',
      condition: draft.condition ?? '',
      return_value: draft.returnValue ?? '',
      show_label: draft.showLabel ?? true,
      label_block: draft.labelBlock ?? true,
      min: draft.min ?? '',
      max: draft.max ?? '',
      step: draft.step ?? '',
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextControls[targetIndex] = { ...nextControls[targetIndex], ...entry, data: { ...(nextControls[targetIndex].data ?? {}), type } };
  } else {
    nextControls.push(entry);
  }

  return {
    ...project,
    controls: nextControls
  };
};

const getControlCollection = (project: BuilderProject) => project.controls ?? [];

export const ProjectControls: React.FC<{
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
  const [draft, setDraft] = React.useState<ControlDraft>({
    id: '',
    name: '',
    label: '',
    description: '',
    defaultValue: '',
    placeholder: '',
    options: '',
    condition: '',
    returnValue: '',
    type: 'text',
    showLabel: true,
    labelBlock: true,
    min: '',
    max: '',
    step: '',
    action: 'add',
    selectedControlName: '',
    customControlName: ''
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const existingType = typeof entry?.data?.type === 'string' ? entry.data.type : 'text';
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      label: typeof data.label === 'string' ? data.label : '',
      description: entry?.description ?? '',
      defaultValue: typeof data.default === 'string' ? String(data.default) : '',
      placeholder: typeof data.placeholder === 'string' ? data.placeholder : '',
      options: typeof data.options === 'string' ? data.options : '',
      condition: typeof data.condition === 'string' ? data.condition : '',
      returnValue: typeof data.return_value === 'string' ? String(data.return_value) : '',
      type: existingType,
      showLabel: typeof data.show_label === 'boolean' ? data.show_label : true,
      labelBlock: typeof data.label_block === 'boolean' ? data.label_block : true,
      min: typeof data.min === 'string' ? data.min : '',
      max: typeof data.max === 'string' ? data.max : '',
      step: typeof data.step === 'string' ? data.step : '',
      action: 'add',
      selectedControlName: entry?.name ?? '',
      customControlName: entry?.name ?? ''
    });
    setDialogOpen(true);
  };

  const persistControl = (nextProject: BuilderProject, operation: ControlAction, controlName: string, controlData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-control-definition',
        payload: {
          project: nextProject,
          controlName,
          operation,
          controlData: controlData ?? null
        }
      });
    }
  };

  const saveControl = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeControlName(draft.selectedControlName === '__custom__' ? draft.customControlName : draft.selectedControlName || draft.name)
      : normalizeControlName(draft.customControlName || draft.name || draft.selectedControlName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the control you want to remove.' });
      return;
    }

    const nextProject = updateProjectControlCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const controlData = {
        id: draft.id || `control-${Date.now()}`,
        name: nameToPersist,
        label: draft.label.trim() || nameToPersist,
        description: draft.description.trim(),
        type: draft.type,
        default: draft.defaultValue.trim(),
        placeholder: draft.placeholder.trim(),
        options: draft.options.trim(),
        condition: draft.condition.trim(),
        return_value: draft.returnValue.trim(),
        show_label: draft.showLabel,
        label_block: draft.labelBlock,
        min: draft.min.trim(),
        max: draft.max.trim(),
        step: draft.step.trim(),
        kind: 'custom-control'
      };
      persistControl(nextProject, 'add', nameToPersist, controlData);
      notify?.({ type: 'success', message: `Control saved: ${nameToPersist}.` });
    } else {
      persistControl(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Control removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', label: '', description: '', defaultValue: '', placeholder: '', options: '', condition: '', returnValue: '', type: 'text', showLabel: true, labelBlock: true, min: '', max: '', step: '', action: 'add', selectedControlName: '', customControlName: '' });
  };

  const removeControl = (entry: ProjectEntityEntry) => {
    const controlName = normalizeControlName(entry.name || '');
    const nextProject = updateProjectControlCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedControlName: entry.name
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistControl(nextProject, 'remove', controlName, null);
    notify?.({ type: 'success', message: `Control removed: ${controlName}.` });
  };

  const controls = getControlCollection(project);
  const existingControlOptions = controls.map((entry) => ({ value: entry.name, label: entry.name }));

  return (
    <>
      <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '18px', padding: '1.25rem', background: 'var(--vscode-panel-background)' }}>
        <div className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0">Custom Controls</h5>
            <Button variant="outline-success" onClick={() => openDialog()}>Add custom control</Button>
          </div>

          <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
            <Table size="sm" striped bordered hover responsive className="mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {controls.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-secondary py-3">No controls created yet.</td>
                  </tr>
                ) : (
                  controls.map((entry) => (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{entry.description || '—'}</td>
                      <td>
                        <div className="d-flex justify-content-end gap-2">
                          <Button size="sm" variant="outline-info" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => removeControl(entry)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>

      <Modal show={dialogOpen} onHide={() => setDialogOpen(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{draft.id ? 'Edit custom control' : 'Create custom control'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Type</Form.Label>
              <div className="d-flex flex-column gap-2">
                {getControlActionOptions().map((option) => (
                  <Form.Check
                    key={option.value}
                    type="radio"
                    label={option.label}
                    name="controlAction"
                    checked={draft.action === option.value}
                    onChange={() => setDraft((current) => ({ ...current, action: option.value as ControlAction }))}
                  />
                ))}
              </div>
            </Form.Group>

            {draft.action === 'remove' ? (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Existing control</Form.Label>
                  <Form.Select value={draft.selectedControlName || existingControlOptions[0]?.value || ''} onChange={(event) => setDraft((current) => ({ ...current, selectedControlName: event.target.value }))}>
                    {existingControlOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                    <option value="__custom__">Custom</option>
                  </Form.Select>
                </Form.Group>
                {draft.selectedControlName === '__custom__' && (
                  <Form.Group>
                    <Form.Label>Custom control name</Form.Label>
                    <Form.Control value={draft.customControlName} onChange={(event) => setDraft((current) => ({ ...current, customControlName: event.target.value }))} />
                  </Form.Group>
                )}
              </>
            ) : (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Custom control name</Form.Label>
                  <Form.Control value={draft.customControlName || draft.name} onChange={(event) => setDraft((current) => ({ ...current, customControlName: event.target.value, name: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Control label</Form.Label>
                  <Form.Control value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Control type</Form.Label>
                  <Form.Select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value || 'text' }))}>
                    {getControlTypeOptions().map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Default value</Form.Label>
                  <Form.Control value={draft.defaultValue} onChange={(event) => setDraft((current) => ({ ...current, defaultValue: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Placeholder</Form.Label>
                  <Form.Control value={draft.placeholder} onChange={(event) => setDraft((current) => ({ ...current, placeholder: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Options</Form.Label>
                  <Form.Control value={draft.options} onChange={(event) => setDraft((current) => ({ ...current, options: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Condition</Form.Label>
                  <Form.Control value={draft.condition} onChange={(event) => setDraft((current) => ({ ...current, condition: event.target.value }))} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Return value</Form.Label>
                  <Form.Control value={draft.returnValue} onChange={(event) => setDraft((current) => ({ ...current, returnValue: event.target.value }))} />
                </Form.Group>
                <div className="row g-3">
                  <div className="col-md-4"><Form.Group><Form.Label>Min</Form.Label><Form.Control value={draft.min} onChange={(event) => setDraft((current) => ({ ...current, min: event.target.value }))} /></Form.Group></div>
                  <div className="col-md-4"><Form.Group><Form.Label>Max</Form.Label><Form.Control value={draft.max} onChange={(event) => setDraft((current) => ({ ...current, max: event.target.value }))} /></Form.Group></div>
                  <div className="col-md-4"><Form.Group><Form.Label>Step</Form.Label><Form.Control value={draft.step} onChange={(event) => setDraft((current) => ({ ...current, step: event.target.value }))} /></Form.Group></div>
                </div>
                <div className="d-flex flex-column gap-2 mt-3">
                  <Form.Check type="checkbox" label="Show label" checked={draft.showLabel} onChange={(event) => setDraft((current) => ({ ...current, showLabel: event.target.checked }))} />
                  <Form.Check type="checkbox" label="Label block" checked={draft.labelBlock} onChange={(event) => setDraft((current) => ({ ...current, labelBlock: event.target.checked }))} />
                </div>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveControl}>{draft.action === 'remove' ? 'Remove' : 'Save'}</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectControls;
