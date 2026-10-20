import * as React from 'react';
import { Button } from 'react-bootstrap';

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

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--vscode-panel-border)',
  borderRadius: '12px',
  padding: '16px',
  background: 'rgba(128, 128, 128, 0.02)',
};

export const ProjectContextMenu: React.FC = () => (
  <div style={panelStyle}>
    <div style={headerRowStyle}>
      <h5 className="mb-0">Context Menus</h5>
      <Button variant="outline-success">Add context menu</Button>
    </div>

    <div style={cardStyle}>
      <p className="mb-0">This project has no context menus configured yet. Add the menu entry details here to register custom editor actions.</p>
    </div>
  </div>
);

export default ProjectContextMenu;
