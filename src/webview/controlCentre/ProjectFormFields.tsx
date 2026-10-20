import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectEntityEntry } from '../../types';

export type FormFieldAction = 'add' | 'remove';

export type FormFieldDraft = {
  id: string;
  name: string;
  title: string;
  description: string;
  fieldType: string;
  placeholder: string;
  required: boolean;
  options: string;
  minLength: string;
  maxLength: string;
  action: FormFieldAction;
  selectedFormFieldName: string;
  customFormFieldName: string;
};

export const FORM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'url', label: 'URL' },
  { value: 'tel', label: 'Telephone' },
  { value: 'radio', label: 'Radio' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'acceptance', label: 'Acceptance' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'upload', label: 'File Upload' },
  { value: 'password', label: 'Password' },
  { value: 'html', label: 'HTML' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'step', label: 'Step' },
  { value: 'recaptcha', label: 'reCAPTCHA' },
  { value: 'recaptcha_v3', label: 'reCAPTCHA V3' },
  { value: 'honeypot', label: 'Honeypot' },
] as const;

const normalizeFormFieldName = (value: string): string => {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return name || 'form_field';
};

const parseFormFieldOptions = (value: string | string[] | undefined): string[] => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]+/)
      : [];

  return items
    .map((item) => String(item).trim())
    .filter(Boolean);
};

export const getFormFieldActionOptions = () => [
  { value: 'add', label: 'Add Form Field' },
  { value: 'remove', label: 'Remove Form Field' }
] as const;

export const getFormFieldTypeOptions = () => FORM_FIELD_TYPES.map(({ value, label }) => ({ value, label }));

export const updateProjectFormFieldCollection = (
  project: BuilderProject,
  draft: Partial<FormFieldDraft>
): BuilderProject => {
  const existingFormFields = Array.isArray(project.formFields) ? [...project.formFields] : [];
  const action = draft.action ?? 'add';

  if (action === 'remove') {
    const selectedName = normalizeFormFieldName(draft.selectedFormFieldName || draft.customFormFieldName || draft.name || '');
    return {
      ...project,
      formFields: existingFormFields.filter((entry) => normalizeFormFieldName(entry.name || '') !== selectedName),
    };
  }

  const name = normalizeFormFieldName(draft.customFormFieldName || draft.name || '');
  const title = (draft.title ?? '').trim() || name.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const description = (draft.description ?? '').trim();
  const fieldType = (draft.fieldType ?? 'text').trim() || 'text';
  const placeholder = (draft.placeholder ?? '').trim();
  const required = Boolean(draft.required);
  const options = parseFormFieldOptions(draft.options ?? '');
  const minLength = (draft.minLength ?? '').trim();
  const maxLength = (draft.maxLength ?? '').trim();
  const id = draft.id || `form-field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextFormFields = [...existingFormFields];
  const targetIndex = nextFormFields.findIndex((entry) => normalizeFormFieldName(entry.name || '') === name);
  const entry = {
    id,
    name,
    description,
    data: {
      kind: 'form-field',
      title,
      field_type: fieldType,
      required,
      placeholder,
      options,
      min_length: minLength,
      max_length: maxLength,
      is_active: true,
    }
  } as ProjectEntityEntry;

  if (targetIndex >= 0) {
    nextFormFields[targetIndex] = { ...nextFormFields[targetIndex], ...entry, data: { ...(nextFormFields[targetIndex].data ?? {}), ...entry.data } };
  } else {
    nextFormFields.push(entry);
  }

  return {
    ...project,
    formFields: nextFormFields,
  };
};

const getFormFieldCollection = (project: BuilderProject) => project.formFields ?? [];

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

export const ProjectFormFields: React.FC<{
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
  const [draft, setDraft] = React.useState<FormFieldDraft>({
    id: '',
    name: '',
    title: '',
    description: '',
    fieldType: 'text',
    placeholder: '',
    required: true,
    options: '',
    minLength: '',
    maxLength: '',
    action: 'add',
    selectedFormFieldName: '',
    customFormFieldName: '',
  });

  const openDialog = (entry?: ProjectEntityEntry) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>;
    const optionsValue = Array.isArray(data.options)
      ? data.options.join(', ')
      : typeof data.options === 'string'
        ? data.options
        : '';

    setDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      title: typeof data.title === 'string' ? data.title : '',
      description: entry?.description ?? '',
      fieldType: typeof data.field_type === 'string' ? data.field_type : 'text',
      placeholder: typeof data.placeholder === 'string' ? data.placeholder : '',
      required: typeof data.required === 'boolean' ? data.required : true,
      options: optionsValue,
      minLength: typeof data.min_length === 'string' ? String(data.min_length) : '',
      maxLength: typeof data.max_length === 'string' ? String(data.max_length) : '',
      action: entry ? 'add' : 'add',
      selectedFormFieldName: entry?.name ?? '',
      customFormFieldName: entry?.name ?? '',
    });
    setDialogOpen(true);
  };

  const persistFormField = (nextProject: BuilderProject, operation: FormFieldAction, formFieldName: string, formFieldData?: Record<string, unknown> | null) => {
    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({
        type: 'save-form-field-definition',
        payload: {
          project: nextProject,
          formFieldName,
          operation,
          formFieldData: formFieldData ?? null,
        },
      });
    }
  };

  const saveFormField = () => {
    const action = draft.action;
    const nameToPersist = action === 'remove'
      ? normalizeFormFieldName(draft.selectedFormFieldName === '__custom__' ? draft.customFormFieldName : draft.selectedFormFieldName || draft.name)
      : normalizeFormFieldName(draft.customFormFieldName || draft.name || draft.selectedFormFieldName);

    if (action === 'remove' && !nameToPersist) {
      notify?.({ type: 'error', message: 'Please select the form field you want to remove.' });
      return;
    }

    const nextProject = updateProjectFormFieldCollection(project, draft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);

    if (action === 'add') {
      const formFieldData = {
        id: draft.id || `form-field-${Date.now()}`,
        name: nameToPersist,
        title: (draft.title ?? '').trim() || nameToPersist.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
        description: (draft.description ?? '').trim(),
        field_type: (draft.fieldType ?? 'text').trim() || 'text',
        required: Boolean(draft.required),
        placeholder: (draft.placeholder ?? '').trim(),
        options: parseFormFieldOptions(draft.options ?? ''),
        min_length: (draft.minLength ?? '').trim(),
        max_length: (draft.maxLength ?? '').trim(),
        kind: 'form-field',
      };
      persistFormField(nextProject, 'add', nameToPersist, formFieldData);
      notify?.({ type: 'success', message: `Form field saved: ${nameToPersist}.` });
    } else {
      persistFormField(nextProject, 'remove', nameToPersist, null);
      notify?.({ type: 'success', message: `Form field removed: ${nameToPersist}.` });
    }

    setDialogOpen(false);
    setDraft({ id: '', name: '', title: '', description: '', fieldType: 'text', placeholder: '', required: true, options: '', minLength: '', maxLength: '', action: 'add', selectedFormFieldName: '', customFormFieldName: '' });
  };

  const removeFormField = (entry: ProjectEntityEntry) => {
    const formFieldName = normalizeFormFieldName(entry.name || '');
    const nextProject = updateProjectFormFieldCollection(project, {
      id: entry.id,
      name: entry.name,
      action: 'remove',
      selectedFormFieldName: entry.name,
    });

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    persistFormField(nextProject, 'remove', formFieldName, null);
    notify?.({ type: 'success', message: `Form field removed: ${formFieldName}.` });
  };

  const formFields = getFormFieldCollection(project);

  return (
    <>
      <div style={panelStyle}>
        <div style={headerRowStyle}>
          <h5 className="mb-0">Form Fields</h5>
          <Button variant="outline-success" onClick={() => openDialog()}>Add form field</Button>
        </div>

        <div style={listCardStyle}>
          <Table striped bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Title</th>
                <th>Type</th>
                <th>Required</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {formFields.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted">No form fields created yet.</td>
                </tr>
              ) : (
                formFields.map((entry) => {
                  const data = (entry.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={entry.id || entry.name}>
                      <td>{entry.name}</td>
                      <td>{typeof data.title === 'string' ? data.title : '—'}</td>
                      <td>{typeof data.field_type === 'string' ? data.field_type : '—'}</td>
                      <td>{typeof data.required === 'boolean' ? String(data.required) : '—'}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="outline-info" size="sm" onClick={() => openDialog(entry)}>Edit</Button>
                          <Button variant="outline-danger" size="sm" onClick={() => removeFormField(entry)}>Remove</Button>
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
          <Modal.Title>{draft.id ? 'Update form field' : 'Create form field'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Form field name</Form.Label>
              <Form.Control type="text" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value, customFormFieldName: event.target.value }))} />
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
              <Form.Label>Field type</Form.Label>
              <Form.Select value={draft.fieldType} onChange={(event) => setDraft((current) => ({ ...current, fieldType: event.target.value }))}>
                {getFormFieldTypeOptions().map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Placeholder</Form.Label>
              <Form.Control type="text" value={draft.placeholder} onChange={(event) => setDraft((current) => ({ ...current, placeholder: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Options (comma or newline separated)</Form.Label>
              <Form.Control type="text" value={draft.options} onChange={(event) => setDraft((current) => ({ ...current, options: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Minimum length</Form.Label>
              <Form.Control type="text" value={draft.minLength} onChange={(event) => setDraft((current) => ({ ...current, minLength: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Maximum length</Form.Label>
              <Form.Control type="text" value={draft.maxLength} onChange={(event) => setDraft((current) => ({ ...current, maxLength: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="Required field"
                checked={draft.required}
                onChange={(event) => setDraft((current) => ({ ...current, required: event.target.checked }))}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveFormField}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectFormFields;
