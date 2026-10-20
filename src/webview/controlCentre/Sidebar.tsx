import * as React from 'react';
import { Button, Image, Nav, Offcanvas } from 'react-bootstrap';
import { createDefaultProject, type BuilderProject, type ProjectSettings } from '../../types';

type SidebarSection = 'controlCentre' | 'project' | 'settings' | 'troubleshooting';
export type ProjectPageSection =
  | 'overview'
  | 'projectAssets'
  | 'contextMenus'
  | 'controls'
  | 'dynamicTags'
  | 'finderCategories'
  | 'formFields'
  | 'formActions'
  | 'themeConditions'
  | 'themeLocations'
  | 'widgets'
  | 'projectSettings';

export const PROJECT_PAGE_STORAGE_KEY = 'elementor-builder-current-project-page';
export const projectPageOptions: ProjectPageSection[] = [
  'overview',
  'projectAssets',
  'contextMenus',
  'controls',
  'dynamicTags',
  'finderCategories',
  'formFields',
  'formActions',
  'themeConditions',
  'themeLocations',
  'widgets',
  'projectSettings'
];

export const getStoredProjectPage = (): ProjectPageSection => {
  const storage =
    typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage
      : typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis
        ? (globalThis as { sessionStorage?: Storage }).sessionStorage
        : undefined;

  if (!storage) {
    return 'overview';
  }

  try {
    const stored = storage.getItem(PROJECT_PAGE_STORAGE_KEY);
    if (stored && projectPageOptions.includes(stored as ProjectPageSection)) {
      return stored as ProjectPageSection;
    }
  } catch {
    // Ignore storage failures and fall back to the default overview page.
  }

  return 'overview';
};

const getProjectPageFromValue = (value: string): ProjectPageSection => {
  switch (value) {
    case 'projectAssets':
      return 'projectAssets';
    case 'contextMenus':
      return 'contextMenus';
    case 'controls':
      return 'controls';
    case 'dynamicTags':
      return 'dynamicTags';
    case 'finder':
    case 'finderCategories':
      return 'finderCategories';
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
      return 'projectSettings';
    case 'project':
    default:
      return 'overview';
  }
};

const getNavValueFromProjectPage = (page: ProjectPageSection): string => {
  switch (page) {
    case 'projectAssets':
      return 'projectAssets';
    case 'contextMenus':
      return 'contextMenus';
    case 'controls':
      return 'controls';
    case 'dynamicTags':
      return 'dynamicTags';
    case 'finderCategories':
      return 'finderCategories';
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
      return 'projectSettings';
    case 'overview':
    default:
      return 'project';
  }
};

const mapNavValueToSection = (value: string): SidebarSection | null => {
  if (value === 'wizard') {
    return null;
  }

  if (value === 'dashboard' || value === 'controlCentre') {
    return 'controlCentre';
  }

  if (
    value === 'project' ||
    value === 'projectAssets' ||
    value === 'contextMenus' ||
    value === 'controls' ||
    value === 'dynamicTags' ||
    value === 'finder' ||
    value === 'finderCategories' ||
    value === 'formActions' ||
    value === 'formFields' ||
    value === 'projectSettings' ||
    value === 'contextSettings' ||
    value === 'templates' ||
    value === 'themeConditions' ||
    value === 'themeLocations' ||
    value === 'widgets'
  ) {
    return 'project';
  }

  if (value === 'settings' || value === 'elementorBuilderSettings') {
    return 'settings';
  }

  if (value === 'tools' || value === 'troubleshooting') {
    return 'troubleshooting';
  }

  return null;
};

export const ControlCentreSidebar: React.FC<{
  project?: BuilderProject;
  projectSettings?: ProjectSettings;
  hasProject?: boolean;
  projectPage?: ProjectPageSection;
  activeSection?: SidebarSection;
  isOpen?: boolean;
  onToggleOpen?: (nextOpen: boolean) => void;
  onOpenSetupWizard?: () => void;
  onNavigate?: (nextSection: SidebarSection, nextProjectPage?: ProjectPageSection) => void;
}> = ({
  project,
  projectSettings,
  hasProject = false,
  projectPage = 'overview',
  activeSection = 'controlCentre',
  isOpen = true,
  onToggleOpen,
  onOpenSetupWizard,
  onNavigate,
}) => {
  const logoSvg = typeof document !== 'undefined' ? (require('../assets/Elementor-Builder-Logo.svg') as string) : '';
  const safeProject = project ?? createDefaultProject();
  const fallbackProjectSettings = createDefaultProject().projectSettings;
  const normalizedProjectSettings: ProjectSettings = {
    ...fallbackProjectSettings,
    ...((projectSettings ?? safeProject.projectSettings ?? fallbackProjectSettings) as Partial<ProjectSettings>)
  };
  const effectiveProjectSettings: ProjectSettings = {
    ...normalizedProjectSettings,
    widgetsEnabled: Boolean(normalizedProjectSettings.widgetsEnabled || (safeProject.widgets?.length ?? 0) > 0 || Boolean(safeProject.widgetNamespace)),
    enableFinder: Boolean(normalizedProjectSettings.enableFinder || (safeProject.finderCategories?.length ?? 0) > 0 || Boolean(safeProject.finderNamespace)),
    enableControls: Boolean(normalizedProjectSettings.enableControls || (safeProject.controls?.length ?? 0) > 0 || Boolean(safeProject.controlsNamespace)),
    enableDynamicTags: Boolean(normalizedProjectSettings.enableDynamicTags || (safeProject.dynamicTags?.length ?? 0) > 0 || Boolean(safeProject.tagsNamespace)),
    enableThemeConditions: Boolean(normalizedProjectSettings.enableThemeConditions || (safeProject.themeConditions?.length ?? 0) > 0 || Boolean(safeProject.themeConditionsNamespace)),
    enableThemeLocations: Boolean(normalizedProjectSettings.enableThemeLocations || (safeProject.themeLocations?.length ?? 0) > 0 || Boolean(safeProject.themeLocationsNamespace)),
    enableFormFields: Boolean(normalizedProjectSettings.enableFormFields || (safeProject.formFields?.length ?? 0) > 0 || Boolean(safeProject.formFieldsNamespace)),
    enableFormActions: Boolean(normalizedProjectSettings.enableFormActions || (safeProject.formActions?.length ?? 0) > 0 || Boolean(safeProject.formActionsNamespace)),
    enableContextMenus: Boolean(normalizedProjectSettings.enableContextMenus || (safeProject.contextMenus?.length ?? 0) > 0 || Boolean(safeProject.contextMenusNamespace)),
  };

  const [projectGroupExpanded, setProjectGroupExpanded] = React.useState<boolean>(true);

  const handleNavSelection = (nextValue: string | null) => {
    const value = String(nextValue ?? '');

    if (value === 'wizard') {
      onOpenSetupWizard?.();
      return;
    }

    const mappedSection = mapNavValueToSection(value);
    if (!mappedSection) {
      return;
    }

    if ((mappedSection === 'project' || mappedSection === 'settings' || mappedSection === 'troubleshooting') && !hasProject) {
      return;
    }

    if (mappedSection === 'project') {
      onNavigate?.(mappedSection, getProjectPageFromValue(value));
      return;
    }

    onNavigate?.(mappedSection);
  };

  const selectedNavValue = activeSection === 'project' ? getNavValueFromProjectPage(projectPage) : activeSection;

  const renderNavItem = (props: { key: string; value: string; label: string; icon?: string; disabled?: boolean }) => (
    <Nav.Item key={props.key}>
      <Nav.Link
        eventKey={props.value}
        disabled={props.disabled}
        active={selectedNavValue === props.value}
        className="nav-link d-flex align-items-center gap-2 rounded px-3 py-2 text-start"
        style={{
          color: 'inherit',
          background: selectedNavValue === props.value ? 'var(--vscode-list-activeSelectionBackground)' : 'transparent'
        }}
      >
        {props.icon && <span aria-hidden="true" className={`codicon codicon-${props.icon}`} />}
        <span>{props.label}</span>
      </Nav.Link>
    </Nav.Item>
  );

  const navBody = (
    <div className="d-flex flex-column h-100" style={{ background: 'var(--vscode-sideBar-background)', color: 'var(--vscode-sideBar-foreground)' }}>
      <div className="px-3 py-3 text-center border-bottom border-secondary-subtle">
        <Image src={logoSvg} alt="Elementor Builder Logo" fluid style={{ maxWidth: '180px', margin: '0 auto' }} />
      </div>

      <Nav className="flex-column gap-1 px-2 py-2" activeKey={selectedNavValue} onSelect={handleNavSelection}>
        {renderNavItem({ key: 'dashboard', value: 'controlCentre', label: 'Dashboard', icon: 'info', disabled: !hasProject })}

        {!hasProject && (
          <Nav.Item>
            <Nav.Link eventKey="wizard" className="nav-link d-flex align-items-center gap-2 rounded px-3 py-2 text-start" style={{ color: 'inherit' }}>
              <span aria-hidden="true" className="codicon codicon-add" />
              <span>Start Setup Wizard</span>
            </Nav.Link>
          </Nav.Item>
        )}

        {hasProject && (
          <>
            <div className="nav-group px-3 pt-3 pb-1 small text-uppercase fw-semibold">
              <button
                type="button"
                className="btn btn-link nav-group d-flex align-items-center justify-content-between w-100 p-0 text-start text-decoration-none"
                aria-expanded={projectGroupExpanded}
                aria-label={projectGroupExpanded ? 'Collapse Project section' : 'Expand Project section'}
                onClick={() => setProjectGroupExpanded((current) => !current)}
                style={{ color: 'inherit', fontSize: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit' }}
              >
                <span>Project</span>
                <span aria-hidden="true" className={`codicon codicon-chevron-${projectGroupExpanded ? 'down' : 'right'}`} />
              </button>
            </div>

            {projectGroupExpanded && (
              <>
                {renderNavItem({ key: 'project', value: 'project', label: 'Project Overview', icon: 'folder-opened' })}
                {renderNavItem({ key: 'projectAssets', value: 'projectAssets', label: 'Project Assets', icon: 'files' })}
                {effectiveProjectSettings.enableContextMenus && renderNavItem({ key: 'contextMenus', value: 'contextMenus', label: 'Context Menus', icon: 'symbol-method' })}
                {effectiveProjectSettings.enableControls && renderNavItem({ key: 'controls', value: 'controls', label: 'Controls', icon: 'list-flat' })}
                {effectiveProjectSettings.enableDynamicTags && renderNavItem({ key: 'dynamicTags', value: 'dynamicTags', label: 'Dynamic Tags', icon: 'tag' })}
                {effectiveProjectSettings.enableFinder && renderNavItem({ key: 'finderCategories', value: 'finderCategories', label: 'Finder Categories', icon: 'search-fuzzy' })}
                {effectiveProjectSettings.enableFormActions && renderNavItem({ key: 'formActions', value: 'formActions', label: 'Form Actions', icon: 'checklist' })}
                {effectiveProjectSettings.enableFormFields && renderNavItem({ key: 'formFields', value: 'formFields', label: 'Form Fields', icon: 'table' })}
                {effectiveProjectSettings.enableThemeConditions && renderNavItem({ key: 'themeConditions', value: 'themeConditions', label: 'Theme Conditions', icon: 'symbol-constant' })}
                {effectiveProjectSettings.enableThemeLocations && renderNavItem({ key: 'themeLocations', value: 'themeLocations', label: 'Theme Locations', icon: 'map' })}
                {effectiveProjectSettings.widgetsEnabled && renderNavItem({ key: 'widgets', value: 'widgets', label: 'Widgets', icon: 'plug' })}
              </>
            )}

            <div className="nav-group px-3 pt-3 pb-1 small text-uppercase fw-semibold text-secondary">Settings</div>
            {renderNavItem({ key: 'settings', value: 'settings', label: 'Project Settings', icon: 'gear', disabled: !hasProject })}
            {renderNavItem({ key: 'elementorBuilderSettings', value: 'elementorBuilderSettings', label: 'Elementor Builder Settings', icon: 'wrench' })}

            <div className="nav-group px-3 pt-3 pb-1 small text-uppercase fw-semibold text-secondary">Tools & Troubleshooting</div>
            {renderNavItem({ key: 'tools', value: 'troubleshooting', label: 'Tools', icon: 'tools' })}
            {renderNavItem({ key: 'troubleshooting', value: 'troubleshooting', label: 'Troubleshooting', icon: 'bug' })}
          </>
        )}
      </Nav>
    </div>
  );

  if (!isOpen && onToggleOpen) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', height: '100vh', padding: '12px 8px', borderRight: '1px solid var(--vscode-panel-border)', background: 'rgba(128, 128, 128, 0.04)' }}>
        <Button variant="outline-secondary" aria-label="Open navigation" onClick={() => onToggleOpen(true)}>
          <span aria-hidden="true" className="codicon codicon-menu" />
        </Button>
      </div>
    );
  }

  return (
    <Offcanvas show={isOpen} onHide={() => onToggleOpen?.(false)} placement="start" backdrop={false} className="border-end" style={{ width: '250px', background: 'var(--vscode-sideBar-background)', color: 'var(--vscode-sideBar-foreground)' }}>
      <Offcanvas.Header closeButton className="border-bottom px-3 py-2" style={{ background: 'var(--vscode-sideBar-background)', color: 'var(--vscode-sideBar-foreground)' }}>
        <Offcanvas.Title className="w-100" style={{ color: 'var(--vscode-sideBar-foreground)' }}>
          <div className="d-flex align-items-center justify-content-between">
          </div>
        </Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="p-0">{navBody}</Offcanvas.Body>
    </Offcanvas>
  );
};

export const Sidebar = ControlCentreSidebar;
export default ControlCentreSidebar;
