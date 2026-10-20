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

export const Troubleshoot: React.FC = () => (
  <div style={panelStyle}>
    <div style={headerRowStyle}>
      <h5 className="mb-0">Troubleshooting</h5>
      <Button variant="outline-primary">Run diagnostics</Button>
    </div>

    <div style={cardStyle}>
      <p className="mb-0">Diagnostic and validation output will appear here when project checks are run.</p>
    </div>
  </div>
);

export default Troubleshoot;
