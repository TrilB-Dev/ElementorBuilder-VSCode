import { createRoot } from 'react-dom/client';
import { MainSidebar } from './MainSidebar';

// Declare the VS Code API
declare function acquireVsCodeApi(): any;

// Extend Window interface for custom properties
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MainSidebar />);
}