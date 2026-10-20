import * as React from 'react';
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject } from '../../types';

const defaultWebviewL10n = {
  back: 'Back',
  next: 'Next',
  create: 'Create',
  welcome: 'Welcome',
  projectDetails: 'Project details',
  projectSettings: 'Project settings',
  namespaceSetup: 'Namespace setup',
  reviewAndCreate: 'Review and create',
};

const getWizardNamespaceValues = (baseNamespace: string) => {
  const normalizedBase = baseNamespace.trim() || 'MyPlugin\\Elementor';
  return {
    widgetNamespace: `${normalizedBase}\\Widgets`,
    templateNamespace: `${normalizedBase}\\Templates`,
    finderNamespace: `${normalizedBase}\\Finder`,
    controlsNamespace: `${normalizedBase}\\Controls`,
    tagsNamespace: `${normalizedBase}\\DynamicTags`,
    themeConditionsNamespace: `${normalizedBase}\\ThemeConditions`,
    themeLocationsNamespace: `${normalizedBase}\\ThemeLocations`,
    formFieldsNamespace: `${normalizedBase}\\FormFields`,
    formActionsNamespace: `${normalizedBase}\\FormActions`,
    contextMenusNamespace: `${normalizedBase}\\ContextMenus`,
  };
};

const hydrateNamespaceDefaults = (nextProject: BuilderProject) => {
  const baseNamespace = nextProject.phpNamespace.trim() || 'MyPlugin\\Elementor';
  const defaults = getWizardNamespaceValues(baseNamespace);

  return {
    ...nextProject,
    widgetNamespace: nextProject.widgetNamespace.trim() || defaults.widgetNamespace,
    templateNamespace: nextProject.templateNamespace.trim() || defaults.templateNamespace,
    finderNamespace: nextProject.finderNamespace.trim() || defaults.finderNamespace,
    controlsNamespace: nextProject.controlsNamespace.trim() || defaults.controlsNamespace,
    tagsNamespace: nextProject.tagsNamespace.trim() || defaults.tagsNamespace,
    themeConditionsNamespace: nextProject.themeConditionsNamespace.trim() || defaults.themeConditionsNamespace,
    themeLocationsNamespace: nextProject.themeLocationsNamespace.trim() || defaults.themeLocationsNamespace,
    formFieldsNamespace: nextProject.formFieldsNamespace.trim() || defaults.formFieldsNamespace,
    formActionsNamespace: nextProject.formActionsNamespace.trim() || defaults.formActionsNamespace,
    contextMenusNamespace: nextProject.contextMenusNamespace.trim() || defaults.contextMenusNamespace,
  };
};

type SaveResult = { type: 'success' | 'error'; message: string } | null;

const sectionCardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '10px',
  padding: '12px',
  background: 'rgba(128, 128, 128, 0.02)',
};

export const ProjectSetupWizard: React.FC<{
  open: boolean;
  project?: BuilderProject;
  workspaceFolderName?: string;
  saveResult?: SaveResult;
  onClose?: () => void;
  onProjectChange?: (nextProject: BuilderProject) => void;
  onProjectSave?: (nextProject: BuilderProject) => void;
  notify?: (result: { type: 'success' | 'error'; message: string }) => void;
}> = ({
  open,
  project,
  workspaceFolderName = 'No workspace folder',
  saveResult,
  onClose = () => undefined,
  onProjectChange,
  onProjectSave,
  notify,
}) => {
  const [step, setStep] = React.useState(0);
  const [runningProjectCreate, setRunningProjectCreate] = React.useState(false);
  const [projectCreationDots, setProjectCreationDots] = React.useState('.');
  const [wizardProject, setWizardProject] = React.useState<BuilderProject>(() => ({
    ...createDefaultProject(),
    ...(project ?? {}),
    projectSettings: {
      ...createDefaultProject().projectSettings,
      ...(project?.projectSettings ?? {}),
    },
  }));

  const l = React.useMemo(() => ({ ...defaultWebviewL10n }), []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setWizardProject((current) => ({
      ...createDefaultProject(),
      ...project,
      projectSettings: {
        ...createDefaultProject().projectSettings,
        ...(project?.projectSettings ?? current.projectSettings ?? createDefaultProject().projectSettings),
      },
    }));
    setStep(0);
    setRunningProjectCreate(false);
    setProjectCreationDots('.');
  }, [open, project]);

  React.useEffect(() => {
    if (!runningProjectCreate) {
      return undefined;
    }

    const id = window.setInterval(() => {
      setProjectCreationDots((current) => current.length >= 5 ? '.' : `${current}.`);
    }, 350);

    return () => window.clearInterval(id);
  }, [runningProjectCreate]);

  React.useEffect(() => {
    if (!saveResult) {
      return;
    }

    setRunningProjectCreate(false);
    if (saveResult.type === 'success') {
      window.setTimeout(() => {
        setStep(0);
        onClose();
      }, 700);
    }
  }, [saveResult, onClose]);

  const applyWizardStepOneDefaults = () => {
    setWizardProject((current) => hydrateNamespaceDefaults(current));
  };

  const setupWizardSteps = [
    { title: l.welcome, description: 'Create the project metadata and generated namespace layout for your Elementor plugin.' },
    { title: l.projectDetails, description: 'Add the name, version, and root PHP namespace for the new builder project.' },
    { title: l.projectSettings, description: 'Enable the modules you want to generate with the project.' },
    { title: l.namespaceSetup, description: 'Define the namespaces used by the enabled project modules.' },
    { title: l.reviewAndCreate, description: 'Review everything before creating the project configuration.' },
  ];

  const setupWizardCanContinue = step === 0 ||
    (step === 1 && Boolean(wizardProject.projectName.trim() && wizardProject.phpNamespace.trim())) ||
    (step === 2) ||
    (step === 3) ||
    (step === 4);

  const createProjectFromWizard = () => {
    const projectToSave: BuilderProject = {
      ...wizardProject,
      projectName: wizardProject.projectName.trim(),
      projectVersion: wizardProject.projectVersion.trim(),
      phpNamespace: wizardProject.phpNamespace.trim(),
      widgetNamespace: wizardProject.widgetNamespace.trim(),
      templateNamespace: wizardProject.templateNamespace.trim(),
      projectPrefix: wizardProject.projectPrefix.trim(),
      textDomain: wizardProject.textDomain.trim(),
    };

    if (!projectToSave.projectName || !projectToSave.phpNamespace) {
      notify?.({ type: 'error', message: 'Project name and namespace are required.' });
      return;
    }

    onProjectChange?.(projectToSave);
    setRunningProjectCreate(true);
    setProjectCreationDots('.');
    onProjectSave?.(projectToSave);
    notify?.({ type: 'success', message: 'Project created successfully.' });
  };

  const enabledSettings = [
    wizardProject.projectSettings.psr4Enabled && 'PSR-4',
    wizardProject.projectSettings.widgetsEnabled && 'Widgets',
    wizardProject.projectSettings.enableFinder && 'Finder',
    wizardProject.projectSettings.enableControls && 'Controls',
    wizardProject.projectSettings.enableDynamicTags && 'Dynamic Tags',
    wizardProject.projectSettings.enableThemeConditions && 'Theme Conditions',
    wizardProject.projectSettings.enableThemeLocations && 'Theme Locations',
    wizardProject.projectSettings.enableFormFields && 'Form Fields',
    wizardProject.projectSettings.enableFormActions && 'Form Actions',
    wizardProject.projectSettings.enableContextMenus && 'Context Menus',
  ].filter((item): item is string => Boolean(item));

  const renderDialogContent = () => {
    if (runningProjectCreate) {
      return (
        <div className="d-flex flex-column gap-3 align-items-center py-3">
          <Spinner animation="border" role="status" style={{ width: '3rem', height: '3rem' }} />
          <h5 className="mb-0">Creating project...</h5>
          <p className="mb-0 text-center">Creating the workspace root, project config, and enabled module folders.</p>
          <Alert variant="info" className="w-100 mb-0">
            <strong>Elementor Builder</strong>
            <div>Creating .elementor-builder, the project JSON file, and all selected folders.</div>
          </Alert>
        </div>
      );
    }

    return (
      <div className="d-flex flex-column gap-3">
        <p className="mb-0">{setupWizardSteps[step]?.description}</p>

        {step === 0 && (
          <div style={sectionCardStyle}>
            <h5 className="mb-3">Project setup</h5>
            <div className="d-grid gap-2">
              <div>Workspace root: <strong>{workspaceFolderName}</strong></div>
              <div>Establish the plugin metadata, source namespaces, and feature flags for the Elementor widget project.</div>
              <div>Default settings remain blank and disabled until you complete this wizard.</div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Project Name</Form.Label>
                <Form.Control value={wizardProject.projectName} onChange={(event) => setWizardProject((current) => ({ ...current, projectName: event.target.value }))} />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Project Version</Form.Label>
                <Form.Control value={wizardProject.projectVersion} onChange={(event) => setWizardProject((current) => ({ ...current, projectVersion: event.target.value }))} />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Project Namespace</Form.Label>
                <Form.Control value={wizardProject.phpNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, phpNamespace: event.target.value }))} />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group>
                <Form.Label>Project Prefix</Form.Label>
                <Form.Control value={wizardProject.projectPrefix} onChange={(event) => setWizardProject((current) => ({ ...current, projectPrefix: event.target.value }))} />
              </Form.Group>
            </div>
            <div className="col-12">
              <Form.Group>
                <Form.Label>Text Domain</Form.Label>
                <Form.Control value={wizardProject.textDomain} onChange={(event) => setWizardProject((current) => ({ ...current, textDomain: event.target.value }))} />
              </Form.Group>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="row g-3">
            {[
              { key: 'psr4Enabled', label: 'PSR-4', hint: 'Enable PSR-4 autoloading for your Elementor project.' },
              { key: 'widgetsEnabled', label: 'Widgets', hint: 'Enable custom Widgets for your Elementor project.' },
              { key: 'enableFinder', label: 'Finder Categories', hint: 'Enable custom Finder Categories for your Elementor project.' },
              { key: 'enableControls', label: 'Controls', hint: 'Enable custom Controls for your Elementor project.' },
              { key: 'enableDynamicTags', label: 'Dynamic Tags', hint: 'Enable custom Dynamic Tags for your Elementor project.' },
              { key: 'enableThemeConditions', label: 'Theme Conditions', hint: 'Enable custom Theme Conditions for your Elementor project.' },
              { key: 'enableThemeLocations', label: 'Theme Locations', hint: 'Enable custom Theme Locations for your Elementor project.' },
              { key: 'enableFormFields', label: 'Form Fields', hint: 'Enable custom Form Fields for your Elementor project.' },
              { key: 'enableFormActions', label: 'Form Actions', hint: 'Enable custom Form Actions for your Elementor project.' },
              { key: 'enableContextMenus', label: 'Context Menus', hint: 'Enable custom Context Menus for your Elementor project.' },
            ].map(({ key, label, hint }) => (
              <div key={key} className="col-md-6">
                <div className="border rounded p-3 h-100">
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <div>
                      <div className="fw-semibold">{label}</div>
                      <small className="text-muted">{hint}</small>
                    </div>
                    <Form.Check
                      type="switch"
                      checked={Boolean(wizardProject.projectSettings[key as keyof BuilderProject['projectSettings']])}
                      onChange={(event) => setWizardProject((current) => ({
                        ...current,
                        projectSettings: {
                          ...current.projectSettings,
                          [key]: event.target.checked,
                        },
                      }))}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="d-grid gap-3">
            {(wizardProject.projectSettings.widgetsEnabled || wizardProject.projectSettings.psr4Enabled) && (
              <Form.Group>
                <Form.Label>Widget Namespace</Form.Label>
                <Form.Control value={wizardProject.widgetNamespace || `${(wizardProject.phpNamespace || 'MyPlugin\\Elementor').trim() || 'MyPlugin\\Elementor'}\\Widgets`} onChange={(event) => setWizardProject((current) => ({ ...current, widgetNamespace: event.target.value }))} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label>Template Namespace</Form.Label>
              <Form.Control value={wizardProject.templateNamespace || `${(wizardProject.phpNamespace || 'MyPlugin\\Elementor').trim() || 'MyPlugin\\Elementor'}\\Templates`} onChange={(event) => setWizardProject((current) => ({ ...current, templateNamespace: event.target.value }))} />
            </Form.Group>
            {wizardProject.projectSettings.enableFinder && (
              <Form.Group>
                <Form.Label>Finder Namespace</Form.Label>
                <Form.Control value={wizardProject.finderNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, finderNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableControls && (
              <Form.Group>
                <Form.Label>Controls Namespace</Form.Label>
                <Form.Control value={wizardProject.controlsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, controlsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableDynamicTags && (
              <Form.Group>
                <Form.Label>Dynamic Tags Namespace</Form.Label>
                <Form.Control value={wizardProject.tagsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, tagsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableThemeConditions && (
              <Form.Group>
                <Form.Label>Theme Conditions Namespace</Form.Label>
                <Form.Control value={wizardProject.themeConditionsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, themeConditionsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableThemeLocations && (
              <Form.Group>
                <Form.Label>Theme Locations Namespace</Form.Label>
                <Form.Control value={wizardProject.themeLocationsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, themeLocationsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableFormFields && (
              <Form.Group>
                <Form.Label>Form Fields Namespace</Form.Label>
                <Form.Control value={wizardProject.formFieldsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, formFieldsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableFormActions && (
              <Form.Group>
                <Form.Label>Form Actions Namespace</Form.Label>
                <Form.Control value={wizardProject.formActionsNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, formActionsNamespace: event.target.value }))} />
              </Form.Group>
            )}
            {wizardProject.projectSettings.enableContextMenus && (
              <Form.Group>
                <Form.Label>Context Menus Namespace</Form.Label>
                <Form.Control value={wizardProject.contextMenusNamespace} onChange={(event) => setWizardProject((current) => ({ ...current, contextMenusNamespace: event.target.value }))} />
              </Form.Group>
            )}
            <small className="text-muted">Start from the project namespace and extend it for each generated feature. Leave a field blank if you do not want to generate that module in the project.</small>
          </div>
        )}

        {step === 4 && (
          <div style={sectionCardStyle}>
            <div className="d-grid gap-2">
              <div><strong>Project name:</strong> {wizardProject.projectName || 'Not set'}</div>
              <div><strong>Version:</strong> {wizardProject.projectVersion || 'Not set'}</div>
              <div><strong>Namespace:</strong> {wizardProject.phpNamespace || 'Not set'}</div>
              <div><strong>Prefix:</strong> {wizardProject.projectPrefix || 'Not set'}</div>
              <div><strong>Text domain:</strong> {wizardProject.textDomain || 'Not set'}</div>
              <div><strong>Enabled settings:</strong></div>
              <ul className="mb-0 ps-3">
                {enabledSettings.length > 0 ? enabledSettings.map((item) => <li key={item}>{item}</li>) : <li>None enabled</li>}
              </ul>
            </div>
          </div>
        )}

        {saveResult && !runningProjectCreate && (
          <Alert variant={saveResult.type === 'success' ? 'success' : 'danger'} className="mb-0">
            <strong>{saveResult.type === 'success' ? 'Project created' : 'Project creation failed'}</strong>
            <div>{saveResult.message}</div>
          </Alert>
        )}
      </div>
    );
  };

  return (
    <Modal show={open} onHide={onClose} centered size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>{setupWizardSteps[step]?.title ?? 'Setup Wizard'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {renderDialogContent()}
      </Modal.Body>
      <Modal.Footer>
        {!runningProjectCreate && (
          <>
            <Button variant="outline-secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>{l.back}</Button>
            {step < setupWizardSteps.length - 1 ? (
              <Button variant="outline-primary" onClick={() => {
                if (step === 1) {
                  applyWizardStepOneDefaults();
                }
                setStep((current) => Math.min(setupWizardSteps.length - 1, current + 1));
              }} disabled={!setupWizardCanContinue}>{l.next}</Button>
            ) : (
              <Button variant="outline-primary" onClick={createProjectFromWizard} disabled={!wizardProject.projectName.trim() || !wizardProject.phpNamespace.trim()}>{l.create}</Button>
            )}
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export const Wizard: React.FC<{
  project?: BuilderProject;
  notify?: (result: { type: 'success' | 'error'; message: string }) => void;
  onProjectChange?: (nextProject: BuilderProject) => void;
  onProjectSave?: (nextProject: BuilderProject) => void;
  onClose?: () => void;
}> = ({ project = createDefaultProject(), notify, onProjectChange, onProjectSave, onClose }) => (
  <ProjectSetupWizard
    open={true}
    project={project}
    onClose={onClose ?? (() => undefined)}
    notify={notify}
    onProjectChange={onProjectChange}
    onProjectSave={onProjectSave}
  />
);

export default ProjectSetupWizard;
