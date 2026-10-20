import * as React from 'react';
import { MainSidebar } from './MainSidebar';

declare global {
  interface Window {
    __elementorBuilderL10n?: Record<string, string>;
  }
}

export const App: React.FC = () => {
  return <MainSidebar />;
};
