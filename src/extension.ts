import * as vscode from 'vscode';
import { ControlCentrePanel } from './controlCentrePanel';
import { registerElementorBuilderCommandsView } from './elementorBuilderSidebarView';
import { runWorkspaceSetupWizard } from './projectConfig';

export function activate(context: vscode.ExtensionContext): void {

  registerElementorBuilderCommandsView(context);

  const openSidebar = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.openSidebar', async () => {
    await vscode.commands.executeCommand('elementor-builder-main.focus');
  });

  const openControlCentre = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.openControlCentre', async () => {
    ControlCentrePanel.createOrShow(context);
  });

  const setupWorkspace = vscode.commands.registerCommand('trilbdev-elementor-builder-vscode.setupWorkspace', async () => {
    await runWorkspaceSetupWizard();
  });

  context.subscriptions.push(openSidebar, openControlCentre, setupWorkspace);
}

export function deactivate(): void {
  // no-op
}
