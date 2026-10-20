import * as React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject } from '../../types';

const defaultL10n = {
  project: 'Project Overview',
  projectName: 'Project name',
  projectPrefix: 'Project prefix',
  textDomain: 'Text domain',
  version: 'Version',
  namespace: 'Namespace',
  enabledSettings: 'Enabled settings',
  noProjectSettingsEnabled: 'No project settings enabled',
  editProject: 'Edit project',
  dismiss: 'Dismiss',
  untitledProject: 'Untitled project',
  notSet: 'Not set'
};

export type ProjectOverviewProps = {
  project?: BuilderProject;
  enabledSettings?: Array<{ key: string; label: string }>;
  notify?: (result: { type: 'success' | 'error'; message: string }) => void;
  projectPanelCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onEditProject?: () => void;
  l?: Record<string, string>;
};

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  project = createDefaultProject(),
  enabledSettings = [],
  onEditProject,
  l = defaultL10n
}) => {
  const localized = { ...defaultL10n, ...l };
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const namespaceEntries = React.useMemo(() => {
    const namespaceMap: Array<{ key: string; label: string; value: string }> = [
      { key: 'widgetsEnabled', label: 'Widgets', value: project.widgetNamespace || localized.notSet },
      { key: 'enableFinder', label: 'Finder', value: project.finderNamespace || localized.notSet },
      { key: 'enableControls', label: 'Controls', value: project.controlsNamespace || localized.notSet },
      { key: 'enableDynamicTags', label: 'Dynamic Tags', value: project.tagsNamespace || localized.notSet },
      { key: 'enableThemeConditions', label: 'Theme Conditions', value: project.themeConditionsNamespace || localized.notSet },
      { key: 'enableThemeLocations', label: 'Theme Locations', value: project.themeLocationsNamespace || localized.notSet },
      { key: 'enableFormFields', label: 'Form Fields', value: project.formFieldsNamespace || localized.notSet },
      { key: 'enableFormActions', label: 'Form Actions', value: project.formActionsNamespace || localized.notSet },
      { key: 'enableContextMenus', label: 'Context Menus', value: project.contextMenusNamespace || localized.notSet },
    ];

    return namespaceMap.filter(({ key }) => {
      const projectSetting = project.projectSettings?.[key as keyof typeof project.projectSettings];
      return Boolean(projectSetting);
    });
  }, [project, localized.notSet]);

  return (
    <>
      <div className="d-flex flex-column gap-3">
        <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '18px', background: 'var(--vscode-panel-background)', color: 'var(--vscode-editor-foreground)', padding: '1.25rem' }}>
          <div className="d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <strong>{localized.project}</strong>
              </div>
              <Button variant="link" className="p-0 text-decoration-none" onClick={() => {
                onEditProject?.();
                setDialogOpen(true);
              }} style={{ color: 'var(--vscode-editor-foreground)' }}>
                Edit
              </Button>
            </div>

            <div className="d-grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
                <small className="text-secondary d-block">{localized.projectName}</small>
                <div className="mt-1 fs-6">{project.projectName || localized.untitledProject}</div>
              </div>
              <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
                <small className="text-secondary d-block">{localized.version}</small>
                <div className="mt-1 fs-6">{project.projectVersion || localized.notSet}</div>
              </div>
              <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
                <small className="text-secondary d-block">{localized.projectPrefix}</small>
                <div className="mt-1 fs-6">{project.projectPrefix || localized.notSet}</div>
              </div>
              <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
                <small className="text-secondary d-block">{localized.textDomain}</small>
                <div className="mt-1 fs-6">{project.textDomain || localized.notSet}</div>
              </div>
              <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)', gridColumn: '1 / -1' }}>
                <small className="text-secondary d-block">{localized.namespace}</small>
                <div className="mt-1 fs-6">{project.phpNamespace || localized.notSet}</div>
              </div>
            </div>

            <div className="p-3 rounded border" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.02)' }}>
              <small className="text-secondary d-block">{localized.enabledSettings}</small>
              <div className="mt-2 d-flex flex-wrap gap-2">
                {enabledSettings.length > 0 ? enabledSettings.map(({ label }) => (
                  <span key={label} className="rounded-pill border px-2 py-1" style={{ borderColor: 'var(--vscode-panel-border)', background: 'rgba(128,128,128,0.04)' }}>
                    {label}
                  </span>
                )) : (
                  <span className="text-secondary">{localized.noProjectSettingsEnabled}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal show={dialogOpen} onHide={() => setDialogOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Project details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-column gap-3">
            <div className="border rounded p-3" style={{ borderColor: 'var(--vscode-panel-border)' }}>
              <h6 className="mb-3">Info</h6>
              <div className="mb-2">
                <small className="text-secondary d-block">Project Name</small>
                <div>{project.projectName || localized.untitledProject}</div>
              </div>
              <div>
                <small className="text-secondary d-block">Project Version</small>
                <div>{project.projectVersion || localized.notSet}</div>
              </div>
            </div>

            <div className="border rounded p-3" style={{ borderColor: 'var(--vscode-panel-border)' }}>
              <h6 className="mb-3">Namespaces</h6>
              {namespaceEntries.length > 0 ? namespaceEntries.map(({ label, value }) => (
                <div key={label} className="mb-2">
                  <small className="text-secondary d-block">{label}</small>
                  <div style={{ wordBreak: 'break-word' }}>{value}</div>
                </div>
              )) : (
                <div className="text-secondary">{localized.noProjectSettingsEnabled}</div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDialogOpen(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ProjectOverview;
