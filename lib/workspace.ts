import fs from 'fs';
import path from 'path';
import { forky, colors } from './ui';

interface WorkspaceConfig {
  active: string;
  comment?: string;
}

interface ProjectClickUpConfig {
  workspaceId: string;
}

interface ProjectGitHubConfig {
  owner: string;
  repo: string;
  path: string;
  baseBranch: string;
}

interface ProjectConfig {
  name: string;
  description?: string;
  clickup: ProjectClickUpConfig;
  github: ProjectGitHubConfig;
}

interface ProjectsConfig {
  projects: {
    [key: string]: ProjectConfig;
  };
}

const workspaceFile = path.join(__dirname, '..', 'workspace.json');
const projectsFile = path.join(__dirname, '..', 'projects.json');

export const workspace = {
  /**
   * Load workspace configuration
   */
  loadWorkspace(): WorkspaceConfig | null {
    try {
      if (fs.existsSync(workspaceFile)) {
        return JSON.parse(fs.readFileSync(workspaceFile, 'utf8'));
      }
    } catch (error) {
      console.error(forky.error(`Failed to load workspace.json: ${(error as Error).message}`));
    }
    return null;
  },

  /**
   * Save workspace configuration
   */
  saveWorkspace(config: WorkspaceConfig): void {
    try {
      fs.writeFileSync(workspaceFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(forky.error(`Failed to save workspace.json: ${(error as Error).message}`));
    }
  },

  /**
   * Load projects configuration
   */
  loadProjects(): ProjectsConfig | null {
    try {
      if (fs.existsSync(projectsFile)) {
        return JSON.parse(fs.readFileSync(projectsFile, 'utf8'));
      }
    } catch (error) {
      console.error(forky.error(`Failed to load projects.json: ${(error as Error).message}`));
    }
    return null;
  },

  /**
   * Get currently active project
   */
  getActiveProject(): ProjectConfig | null {
    const workspaceConfig = this.loadWorkspace();
    if (!workspaceConfig || !workspaceConfig.active) {
      console.error(forky.error('No active project set in workspace.json'));
      return null;
    }

    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(forky.error('Failed to load projects.json'));
      return null;
    }

    const project = projectsConfig.projects[workspaceConfig.active];
    if (!project) {
      console.error(forky.error(`Project "${workspaceConfig.active}" not found in projects.json`));
      return null;
    }

    return project;
  },

  /**
   * Get active project name
   */
  getActiveProjectName(): string | null {
    const workspaceConfig = this.loadWorkspace();
    return workspaceConfig?.active || null;
  },

  /**
   * Switch to a different project
   */
  switchProject(projectName: string): boolean {
    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(forky.error('Failed to load projects.json'));
      return false;
    }

    if (!projectsConfig.projects[projectName]) {
      console.error(forky.error(`Project "${projectName}" not found in projects.json`));
      console.log(forky.info('Available projects:'));
      Object.keys(projectsConfig.projects).forEach(name => {
        const project = projectsConfig.projects[name];
        console.log(`  ${colors.bright}${name}${colors.reset} - ${project.name}`);
      });
      return false;
    }

    this.saveWorkspace({
      active: projectName,
      comment: 'This file tracks your currently active project. Change \'active\' to switch projects.'
    });

    const project = projectsConfig.projects[projectName];
    console.log(forky.success(`Switched to project: ${colors.bright}${project.name}${colors.reset}`));
    console.log(forky.info(`ClickUp Workspace: ${project.clickup.workspaceId}`));
    console.log(forky.info(`GitHub: ${project.github.owner}/${project.github.repo}`));
    console.log(forky.info(`Path: ${project.github.path}`));

    return true;
  },

  /**
   * List all available projects
   */
  listProjects(): void {
    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(forky.error('Failed to load projects.json'));
      return;
    }

    const activeProjectName = this.getActiveProjectName();

    console.log('\n' + colors.bright + '═══ Available Projects ═══' + colors.reset);
    console.log('═══════════════════════════════════════════════════════');

    Object.entries(projectsConfig.projects).forEach(([key, project]) => {
      const isActive = key === activeProjectName;
      const marker = isActive ? '●' : '○';
      const nameColor = isActive ? colors.bright : '';

      console.log(`\n${marker} ${nameColor}${key}${colors.reset} - ${project.name}`);
      if (project.description) {
        console.log(`  ${project.description}`);
      }
      console.log(`  ClickUp: ${project.clickup.workspaceId}`);
      console.log(`  GitHub: ${project.github.owner}/${project.github.repo}`);
      console.log(`  Path: ${project.github.path}`);
      console.log(`  Branch: ${project.github.baseBranch}`);
    });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(forky.info('To switch projects: npm run switch <project-name>'));
    console.log('');
  },

  /**
   * Show current project info
   */
  showCurrent(): void {
    const projectName = this.getActiveProjectName();
    const project = this.getActiveProject();

    if (!project || !projectName) {
      console.error(forky.error('No active project configured'));
      console.log(forky.info('Run: npm run projects'));
      return;
    }

    console.log('\n' + colors.bright + '═══ Current Active Project ═══' + colors.reset);
    console.log('═══════════════════════════════════════════════════════');
    console.log(`${colors.bright}${projectName}${colors.reset} - ${project.name}`);
    if (project.description) {
      console.log(`${project.description}`);
    }
    console.log(`\nClickUp Workspace: ${colors.bright}${project.clickup.workspaceId}${colors.reset}`);
    console.log(`GitHub: ${colors.bright}${project.github.owner}/${project.github.repo}${colors.reset}`);
    console.log(`Path: ${project.github.path}`);
    console.log(`Branch: ${project.github.baseBranch}`);
    console.log('═══════════════════════════════════════════════════════\n');
  }
};

export type { WorkspaceConfig, ProjectConfig, ProjectsConfig, ProjectClickUpConfig, ProjectGitHubConfig };
