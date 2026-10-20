import * as React from 'react';
import { Button } from 'react-bootstrap';
import { getElementorBuilderTheme, type ElementorBuilderThemeMode } from './elementorBuilderTheme';

const rootStyle: React.CSSProperties = {
  padding: '20px 16px',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  justifyContent: 'flex-start',
  width: '100%',
  gap: '12px',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '8px',
};

const statRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  marginBottom: '8px',
};

export const MainSidebar: React.FC = () => {
  const initialState = window.__elementorBuilderInitialState ?? {};
  const [themeMode, setThemeMode] = React.useState<ElementorBuilderThemeMode>(initialState.theme ?? 'light');
  const [hasProject, setHasProject] = React.useState<boolean>(initialState.hasProject ?? false);
  const [projectName, setProjectName] = React.useState<string>(initialState.projectName ?? 'Project');
  const [widgetCount, setWidgetCount] = React.useState<number>(initialState.widgetCount ?? 0);

  const openControlCentre = React.useCallback(() => {
    if (window.__elementorBuilderVsCodeApi?.postMessage) {
      window.__elementorBuilderVsCodeApi.postMessage({ command: 'openControlCentre' });
    }
  }, []);

  React.useEffect(() => {
    getElementorBuilderTheme(themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    const listener = (event: MessageEvent<{ type?: string; theme?: ElementorBuilderThemeMode; payload?: unknown }>) => {
      if (event.data?.type === 'theme' && event.data.theme) {
        setThemeMode(event.data.theme);
      }

      if (event.data?.type === 'elementorBuilder.setProjectState') {
        const payload = event.data.payload as { hasProject?: boolean; projectName?: string; widgetCount?: number } | undefined;
        if (payload) {
          setHasProject(Boolean(payload.hasProject));
          if (payload.projectName) {
            setProjectName(payload.projectName);
          }
          setWidgetCount(typeof payload.widgetCount === 'number' ? payload.widgetCount : 0);
        }
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  React.useEffect(() => {
    const currentState = window.__elementorBuilderInitialState ?? {};
    setHasProject(Boolean(currentState.hasProject));
    setProjectName(currentState.projectName ?? 'Project');
    setWidgetCount(currentState.widgetCount ?? 0);
  }, []);

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <h6 className="mb-0">Elementor Builder</h6>
      </div>

      {!hasProject ? (
        <>
          <p className="text-muted mb-0">No project is configured in this workspace.</p>
          <Button variant="primary" onClick={openControlCentre}>
            Start Setup Wizard
          </Button>
        </>
      ) : (
        <>
          <div style={statRowStyle}>
            <strong>{projectName}</strong>
            <small className="text-muted">
              {widgetCount} widget{widgetCount === 1 ? '' : 's'}
            </small>
          </div>
          <Button variant="secondary" onClick={openControlCentre}>
            Edit Project
          </Button>
        </>
      )}
    </div>
  );
};

export default MainSidebar;
