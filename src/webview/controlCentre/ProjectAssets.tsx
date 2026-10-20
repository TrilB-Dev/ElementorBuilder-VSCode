import * as React from 'react';
import { Button, Form, Modal, Table } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject } from '../../types';

export type AssetKind = 'script' | 'style';

type AssetDraft = {
  id: string;
  name: string;
  src: string;
  dependsOn: string;
  version: string;
  inFooter: boolean;
};

const assetKinds = {
  script: { label: 'Scripts', buttonLabel: 'Add script', tableLabel: 'Script assets' },
  style: { label: 'Styles', buttonLabel: 'Add style', tableLabel: 'Style assets' }
} as const;

export const updateProjectAssetCollection = (
  project: BuilderProject,
  kind: AssetKind,
  draft: { id?: string; name: string; src: string; dependsOn: string; version: string; inFooter?: boolean }
): BuilderProject => {
  const listKey = kind === 'script' ? 'scripts' : 'styles';
  const previousAssets = project.projectAssets ?? { scripts: [], styles: [] };
  const nextList = [...(previousAssets[listKey] ?? [])];
  const entry = {
    id: draft.id || `${kind}-${Date.now()}`,
    name: draft.name.trim(),
    src: draft.src.trim(),
    dependsOn: draft.dependsOn.trim(),
    version: draft.version.trim(),
    inFooter: kind === 'script' ? Boolean(draft.inFooter) : false
  };

  if (draft.id) {
    const index = nextList.findIndex((item) => item.id === draft.id);
    if (index >= 0) {
      nextList[index] = entry;
    } else {
      nextList.push(entry);
    }
  } else {
    nextList.push(entry);
  }

  return {
    ...project,
    projectAssets: {
      ...previousAssets,
      [listKey]: nextList
    }
  };
};

const getAssetCollection = (project: BuilderProject, kind: AssetKind) => (
  kind === 'script' ? (project.projectAssets?.scripts ?? []) : (project.projectAssets?.styles ?? [])
);

export const ProjectAssets: React.FC<{
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
  const [assetDialogOpen, setAssetDialogOpen] = React.useState(false);
  const [assetDialogKind, setAssetDialogKind] = React.useState<AssetKind>('script');
  const [assetDraft, setAssetDraft] = React.useState<AssetDraft>({
    id: '',
    name: '',
    src: '',
    dependsOn: '',
    version: '',
    inFooter: true
  });

  const openAssetDialog = (kind: AssetKind, entry?: { id: string; name: string; src: string; dependsOn: string; version: string; inFooter?: boolean }) => {
    setAssetDialogKind(kind);
    setAssetDraft({
      id: entry?.id ?? '',
      name: entry?.name ?? '',
      src: entry?.src ?? '',
      dependsOn: entry?.dependsOn ?? '',
      version: entry?.version ?? '',
      inFooter: entry?.inFooter ?? (kind === 'script')
    });
    setAssetDialogOpen(true);
  };

  const saveAsset = () => {
    const name = assetDraft.name.trim();
    const src = assetDraft.src.trim();
    if (!name || !src) {
      notify?.({ type: 'error', message: 'Asset name and source are required.' });
      return;
    }

    const nextProject = updateProjectAssetCollection(project, assetDialogKind, assetDraft);
    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `${assetKinds[assetDialogKind].label.slice(0, -1)} saved.` });

    setAssetDialogOpen(false);
    setAssetDraft({ id: '', name: '', src: '', dependsOn: '', version: '', inFooter: assetDialogKind === 'script' });
  };

  const confirmDelete = (label: string, onConfirm: () => void) => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(`Are you sure you want to delete ${label}? This action cannot be undone.`);
      if (!confirmed) {
        return;
      }
    }

    onConfirm();
  };

  const deleteAsset = (kind: AssetKind, id: string) => {
    const listKey = kind === 'script' ? 'scripts' : 'styles';
    const previousAssets = project.projectAssets ?? { scripts: [], styles: [] };
    const nextProject = {
      ...project,
      projectAssets: {
        ...previousAssets,
        [listKey]: (previousAssets[listKey] ?? []).filter((item) => item.id !== id)
      }
    };

    onProjectChange(nextProject);
    onSaveProject(nextProject);
    notify?.({ type: 'success', message: `${assetKinds[kind].label.slice(0, -1)} removed.` });
  };

  return (
    <>
      <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '18px', padding: '1.25rem', background: 'var(--vscode-panel-background)' }}>
        <div className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0">Project Assets</h5>
          </div>

          {(['script', 'style'] as const).map((kind) => (
            <div key={kind} className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <strong>{assetKinds[kind].label}</strong>
                <Button variant="outline-success" onClick={() => openAssetDialog(kind)}>{assetKinds[kind].buttonLabel}</Button>
              </div>

              <Table size="sm" striped bordered hover className="mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Source</th>
                    <th>Depends on</th>
                    <th>Version</th>
                    {kind === 'script' && <th>In footer</th>}
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getAssetCollection(project, kind).length === 0 ? (
                    <tr>
                      <td colSpan={kind === 'script' ? 6 : 5} className="text-secondary py-3">No {assetKinds[kind].label.toLowerCase()} found.</td>
                    </tr>
                  ) : (
                    getAssetCollection(project, kind).map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.name}</td>
                        <td>{entry.src}</td>
                        <td>{entry.dependsOn || '—'}</td>
                        <td>{entry.version || '—'}</td>
                        {kind === 'script' && <td>{entry.inFooter ? 'Yes' : 'No'}</td>}
                        <td>
                          <div className="d-flex justify-content-end gap-2">
                            <Button size="sm" variant="outline-info" onClick={() => openAssetDialog(kind, entry)}>Edit</Button>
                            <Button size="sm" variant="outline-danger" onClick={() => confirmDelete(`the ${assetKinds[kind].label.slice(0, -1).toLowerCase()} "${entry.name}"`, () => deleteAsset(kind, entry.id))}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      </div>

      <Modal show={assetDialogOpen} onHide={() => setAssetDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{assetDraft.id ? 'Edit asset' : `Add ${assetDialogKind}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Asset name</Form.Label>
              <Form.Control value={assetDraft.name} onChange={(event) => setAssetDraft((current) => ({ ...current, name: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Source</Form.Label>
              <Form.Control value={assetDraft.src} onChange={(event) => setAssetDraft((current) => ({ ...current, src: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Depends on</Form.Label>
              <Form.Control value={assetDraft.dependsOn} onChange={(event) => setAssetDraft((current) => ({ ...current, dependsOn: event.target.value }))} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Version</Form.Label>
              <Form.Control value={assetDraft.version} onChange={(event) => setAssetDraft((current) => ({ ...current, version: event.target.value }))} />
            </Form.Group>
            {assetDialogKind === 'script' && (
              <Form.Group>
                <Form.Check type="switch" label="In footer" checked={assetDraft.inFooter} onChange={(event) => setAssetDraft((current) => ({ ...current, inFooter: event.target.checked }))} />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setAssetDialogOpen(false)}>Cancel</Button>
          <Button variant="outline-primary" onClick={saveAsset}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectAssets;
