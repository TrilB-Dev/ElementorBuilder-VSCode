import type { FC } from 'react';
import { Button } from 'react-bootstrap';

export type DashboardProps = {
  title?: string;
  description?: string;
  projectReadyText?: string;
  hasProject?: boolean;
  onOpenProject?: () => void;
  openProjectLabel?: string;
};

export const Dashboard: FC<DashboardProps> = ({
  title = 'Control Centre',
  description = 'The Control Centre is loading the interactive builder view...',
  projectReadyText = 'Configure the builder metadata, widget groups, and generated Elementor component setup.',
  hasProject = false,
  onOpenProject,
  openProjectLabel = 'Open project'
}) => {
  return (
    <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '18px', padding: '1.25rem', background: 'var(--vscode-panel-background)' }}>
      <div className="d-flex flex-column gap-3">
        <h3 className="mb-0">{title}</h3>
        <div>{projectReadyText || description}</div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" disabled={!hasProject} onClick={onOpenProject}>
            {openProjectLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
