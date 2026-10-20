if (typeof document !== 'undefined') {
  require('@vscode/codicons/dist/codicon.css');
}
import { createRoot } from 'react-dom/client';
import type { elementorBuilderThemeMode } from './elementorBuilderTheme';
import type { BuilderProject, ProjectSettings } from '../types';
import { App } from './App';

declare let __webpack_public_path__: string; // eslint-disable-line @typescript-eslint/no-unused-vars

const setWebpackPublicPath = () => {
  const currentScript = document.currentScript as HTMLScriptElement | null;
  const scriptEl = currentScript ?? (() => {
    const scripts = document.getElementsByTagName('script');
    return scripts.length ? scripts[scripts.length - 1] : undefined;
  })();

  if (scriptEl?.src) {
    const lastSlashIndex = scriptEl.src.lastIndexOf('/') + 1;
    __webpack_public_path__ = scriptEl.src.substring(0, lastSlashIndex);
  }
};

setWebpackPublicPath();

declare global {
  interface Window {
    acquireVsCodeApi?: () => unknown;
    __elementorBuilderInitialState?: {
      theme?: elementorBuilderThemeMode;
      hasProject?: boolean;
      projectName?: string;
      workspaceFolderName?: string;
      widgetCount?: number;
      projectSettings?: ProjectSettings;
      project?: Partial<BuilderProject>;
    };
    __elementorBuilderVsCodeApi?: {
      postMessage: (message: unknown) => void;
      getState?: () => unknown;
      setState?: (newState: unknown) => void;
    };
  }
}

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}