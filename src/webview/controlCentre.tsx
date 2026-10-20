if (typeof document !== 'undefined') {
  require('@vscode/codicons/dist/codicon.css');
}
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { getElementorBuilderTheme, type elementorBuilderThemeMode } from './elementorBuilderTheme';
import { Sidebar, type ProjectPageSection, PROJECT_PAGE_STORAGE_KEY, getStoredProjectPage } from './controlCentre/Sidebar';
import { Dashboard } from './controlCentre/Dashboard';
import { Wizard } from './controlCentre/Wizard';
import { createDefaultProject, type BuilderProject, type ProjectSettings } from '../types';
import { ProjectOverview } from './controlCentre/ProjectOverview';
import { ProjectAssets } from './controlCentre/ProjectAssets';
import { ProjectContextMenu } from './controlCentre/ProjectContextMenu';
import { ProjectControls } from './controlCentre/ProjectControls';
import { ProjectDynamicTags } from './controlCentre/ProjectDynamicTags';
import { ProjectFinder } from './controlCentre/ProjectFinder';
import { ProjectFormActions } from './controlCentre/ProjectFormActions';
import { ProjectFormFields } from './controlCentre/ProjectFormFields';
import { ProjectThemeConditions } from './controlCentre/ProjectThemeConditions';
import { ProjectThemeLocations } from './controlCentre/ProjectThemeLocations';
import { ProjectWidgets } from './controlCentre/ProjectWidgets';
import { Tools } from './controlCentre/Tools';
import { Troubleshoot } from './controlCentre/Troubleshoot';

// Declare the VS Code API
declare function acquireVsCodeApi(): {
  postMessage: (message: unknown) => void;
  getState?: () => unknown;
  setState?: (newState: unknown) => void;
};

declare global {
  interface Window {
    __elementorBuilderVsCodeApi?: {
      postMessage: (message: unknown) => void;
      getState?: () => unknown;
      setState?: (newState: unknown) => void;
    };
    __elementorBuilderInitialState?: {
      theme?: 'light' | 'dark' | 'highContrast';
      hasProject?: boolean;
      projectName?: string;
      workspaceFolderName?: string;
      widgetCount?: number;
      projectSettings?: ProjectSettings;
      project?: Partial<BuilderProject>;
    };
    __elementorBuilderAppMounted?: boolean;
  }
}

export const getWebviewApi = (): { postMessage: (message: unknown) => void; getState?: () => unknown; setState?: (state: unknown) => void } => {
  if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
    return window.__elementorBuilderVsCodeApi;
  }

  return { postMessage: () => undefined };
};

export type ControlCentrePanelKey =
  | 'dashboard'
  | 'wizard'
  | 'overview'
  | 'assets'
  | 'contextMenus'
  | 'controls'
  | 'dynamicTags'
  | 'finder'
  | 'formActions'
  | 'formFields'
  | 'themeConditions'
  | 'themeLocations'
  | 'widgets'
  | 'tools'
  | 'troubleshoot';

const mapProjectPageToPanel = (page: ProjectPageSection): ControlCentrePanelKey => {
  switch (page) {
    case 'projectAssets':
      return 'assets';
    case 'contextMenus':
      return 'contextMenus';
    case 'controls':
      return 'controls';
    case 'dynamicTags':
      return 'dynamicTags';
    case 'finderCategories':
      return 'finder';
    case 'formActions':
      return 'formActions';
    case 'formFields':
      return 'formFields';
    case 'themeConditions':
      return 'themeConditions';
    case 'themeLocations':
      return 'themeLocations';
    case 'widgets':
      return 'widgets';
    case 'projectSettings':
    case 'overview':
    default:
      return 'overview';
  }
};

export type ControlCentreSaveResult = { type: 'success' | 'error'; message: string };

export const ControlCentre: React.FC = () => {
  const defaultProject = React.useMemo(() => createDefaultProject(), []);
  const initialState = typeof window !== 'undefined' ? window.__elementorBuilderInitialState ?? {} : {};
  const initialHasProject = Boolean(initialState.hasProject);
  const [projectPage, setProjectPage] = React.useState<ProjectPageSection>(() => (initialHasProject ? getStoredProjectPage() : 'overview'));
  const [activePanel, setActivePanel] = React.useState<ControlCentrePanelKey>(() => (initialHasProject ? mapProjectPageToPanel(projectPage) : 'dashboard'));
  const [activeSection, setActiveSection] = React.useState<'controlCentre' | 'project' | 'settings' | 'troubleshooting'>('controlCentre');
  const [hasProject, setHasProject] = React.useState<boolean>(initialHasProject);
  const [saveResult, setSaveResult] = React.useState<ControlCentreSaveResult | null>(null);
  const [project, setProject] = React.useState<BuilderProject>({
    ...defaultProject,
    ...((initialState.project as Partial<BuilderProject> | undefined) ?? {}),
    projectSettings: {
      ...defaultProject.projectSettings,
      ...((initialState.project as Partial<BuilderProject> | undefined)?.projectSettings ?? {}),
    }
  });
  const [projectSettings, setProjectSettings] = React.useState<ProjectSettings>(
    initialState.projectSettings ?? initialState.project?.projectSettings ?? project.projectSettings ?? defaultProject.projectSettings
  );
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(true);

  React.useEffect(() => {
    const initialTheme = initialState.theme ?? 'dark';
    getElementorBuilderTheme(initialTheme);
  }, [initialState.theme]);

  const effectiveProjectSettings = React.useMemo<ProjectSettings>(() => {
    const fallback = defaultProject.projectSettings;
    const base = { ...fallback, ...projectSettings };

    return {
      ...base,
      widgetsEnabled: Boolean(base.widgetsEnabled || (project.widgets?.length ?? 0) > 0 || Boolean(project.widgetNamespace)),
      enableFinder: Boolean(base.enableFinder || (project.finderCategories?.length ?? 0) > 0 || Boolean(project.finderNamespace)),
      enableControls: Boolean(base.enableControls || (project.controls?.length ?? 0) > 0 || Boolean(project.controlsNamespace)),
      enableDynamicTags: Boolean(base.enableDynamicTags || (project.dynamicTags?.length ?? 0) > 0 || Boolean(project.tagsNamespace)),
      enableThemeConditions: Boolean(base.enableThemeConditions || (project.themeConditions?.length ?? 0) > 0 || Boolean(project.themeConditionsNamespace)),
      enableThemeLocations: Boolean(base.enableThemeLocations || (project.themeLocations?.length ?? 0) > 0 || Boolean(project.themeLocationsNamespace)),
      enableFormFields: Boolean(base.enableFormFields || (project.formFields?.length ?? 0) > 0 || Boolean(project.formFieldsNamespace)),
      enableFormActions: Boolean(base.enableFormActions || (project.formActions?.length ?? 0) > 0 || Boolean(project.formActionsNamespace)),
      enableContextMenus: Boolean(base.enableContextMenus || (project.contextMenus?.length ?? 0) > 0 || Boolean(project.contextMenusNamespace)),
    };
  }, [defaultProject.projectSettings, project, projectSettings]);

  React.useEffect(() => {
    const listener = (event: MessageEvent<{
      type?: string;
      theme?: elementorBuilderThemeMode;
      payload?: { completed?: boolean; hasProject?: boolean; project?: Partial<BuilderProject>; projectSettings?: ProjectSettings };
      optionId?: string;
      value?: string;
    }>) => {
      if (event.data?.type === 'theme' && event.data.theme) {
        getElementorBuilderTheme(event.data.theme);
      }

      if (event.data?.type === 'elementorBuilder.setSetupWizardCompleted') {
        const payload = event.data.payload as { completed?: boolean; hasProject?: boolean; project?: Partial<BuilderProject>; projectSettings?: ProjectSettings } | undefined;
        setHasProject(Boolean(payload?.completed ?? payload?.hasProject ?? false));
        if (payload?.project) {
          setProject((current) => ({
            ...current,
            ...payload.project,
            projectSettings: {
              ...current.projectSettings,
              ...((payload.project?.projectSettings ?? {}) as Partial<ProjectSettings>)
            }
          }));
        }
        if (payload?.projectSettings) {
          const nextProjectSettings = payload.projectSettings;
          setProject((current) => ({ ...current, projectSettings: nextProjectSettings }));
          setProjectSettings(nextProjectSettings);
        }
      }

      if (event.data?.type === 'image-file-selected') {
        const optionId = event.data.optionId as string | undefined;
        const value = event.data.value as string | undefined;
        if (!optionId || !value) {
          return;
        }

        window.__elementorBuilderVsCodeApi?.postMessage({
          type: 'visual-choice-image-updated',
          optionId,
          value
        });
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(PROJECT_PAGE_STORAGE_KEY, projectPage);
      } catch {
        // Ignore storage failures and keep the in-memory project page selection stable.
      }
    }
  }, [projectPage]);

  const enabledSettings = React.useMemo(() => {
    const toggles: Array<{ key: string; label: string }> = [
      { key: 'psr4Enabled', label: 'PSR-4' },
      { key: 'widgetsEnabled', label: 'Widgets' },
      { key: 'enableFinder', label: 'Finder' },
      { key: 'enableControls', label: 'Controls' },
      { key: 'enableDynamicTags', label: 'Dynamic Tags' },
      { key: 'enableThemeConditions', label: 'Theme Conditions' },
      { key: 'enableThemeLocations', label: 'Theme Locations' },
      { key: 'enableFormFields', label: 'Form Fields' },
      { key: 'enableFormActions', label: 'Form Actions' },
      { key: 'enableContextMenus', label: 'Context Menus' }
    ];

    return toggles
      .filter(({ key }) => Boolean(effectiveProjectSettings[key as keyof ProjectSettings]))
      .map(({ key, label }) => ({ key, label }));
  }, [effectiveProjectSettings]);

  const handleSidebarNavigate = (nextSection: 'controlCentre' | 'project' | 'settings' | 'troubleshooting', nextProjectPage?: ProjectPageSection) => {
    setActiveSection(nextSection);

    if (nextSection === 'controlCentre') {
      setActivePanel('dashboard');
      return;
    }

    if (nextSection === 'project') {
      const nextPage = nextProjectPage ?? 'overview';
      setProjectPage(nextPage);
      setActivePanel(mapProjectPageToPanel(nextPage));
      return;
    }

    if (nextSection === 'settings') {
      setActivePanel('overview');
      return;
    }

    if (nextSection === 'troubleshooting') {
      setActivePanel('troubleshoot');
    }
  };

  const notify = React.useCallback((nextResult: ControlCentreSaveResult) => {
    setSaveResult(nextResult);
  }, []);

  const dismissSaveResult = () => setSaveResult(null);

  const handleProjectChange = React.useCallback((nextProject: BuilderProject) => {
    setProject(nextProject);
    setProjectSettings(nextProject.projectSettings ?? defaultProject.projectSettings);
  }, [defaultProject.projectSettings]);

  const handleProjectSave = React.useCallback((nextProject: BuilderProject) => {
    setProject(nextProject);
    setProjectSettings(nextProject.projectSettings ?? defaultProject.projectSettings);

    if (typeof window !== 'undefined' && window.__elementorBuilderVsCodeApi) {
      window.__elementorBuilderVsCodeApi.postMessage({ type: 'save-project', state: nextProject });
    }

    notify({ type: 'success', message: 'Project saved.' });
  }, [defaultProject.projectSettings, notify]);

  const renderPanel = () => {
    if (!hasProject) {
      return <Wizard notify={notify} onProjectChange={handleProjectChange} onProjectSave={handleProjectSave} />;
    }

    switch (activePanel) {
      case 'wizard':
        return <Wizard project={project} notify={notify} onProjectChange={handleProjectChange} onProjectSave={handleProjectSave} />;
      case 'overview':
        return <ProjectOverview project={project} enabledSettings={enabledSettings} notify={notify} />;
      case 'assets':
        return <ProjectAssets project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'contextMenus':
        return <ProjectContextMenu />;
      case 'controls':
        return <ProjectControls project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'dynamicTags':
        return <ProjectDynamicTags project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'finder':
        return <ProjectFinder project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'formActions':
        return <ProjectFormActions project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'formFields':
        return <ProjectFormFields project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'themeConditions':
        return <ProjectThemeConditions project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'themeLocations':
        return <ProjectThemeLocations project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'widgets':
        return <ProjectWidgets project={project} onProjectChange={handleProjectChange} onSaveProject={handleProjectSave} notify={notify} />;
      case 'tools':
        return <Tools />;
      case 'troubleshoot':
        return <Troubleshoot />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="d-flex w-100 min-vh-100 text-body" style={{ background: 'var(--vscode-editor-background)', color: 'var(--vscode-editor-foreground)' }}>
      {hasProject && (
        <Sidebar
          project={project}
          hasProject={hasProject}
          projectSettings={projectSettings}
          activeSection={activeSection}
          projectPage={projectPage}
          isOpen={sidebarOpen}
          onToggleOpen={setSidebarOpen}
          onNavigate={handleSidebarNavigate}
        />
      )}
      <main className="flex-grow-1 d-flex flex-column gap-3 px-3 py-3" style={{ minWidth: 0, background: 'transparent' }}>
        {saveResult && (
          <div
            className={`alert ${saveResult.type === 'success' ? 'alert-success' : 'alert-danger'} d-flex align-items-center justify-content-between mb-0`}
            role="alert"
            style={{ gap: '12px' }}
          >
            <span>{saveResult.message}</span>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={dismissSaveResult}>
              Dismiss
            </button>
          </div>
        )}
        {renderPanel()}
      </main>
    </div>
  );
};

const container = typeof document !== 'undefined' ? document.getElementById('root') : null;

if (container) {
  const root = createRoot(container);
  root.render(<ControlCentre />);
  if (typeof window !== 'undefined') {
    window.__elementorBuilderAppMounted = true;
  }
}

export default ControlCentre;
