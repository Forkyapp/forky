import fs from 'fs';
import path from 'path';
import { timmy, colors } from '../../shared/ui';

interface WorkspaceConfig {
  active?: string;
  activeProject?: string; // Support both formats
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

// Use process.cwd() to ensure we're always looking in the project root, not dist/lib
const workspaceFile = path.join(process.cwd(), 'workspace.json');
const projectsFile = path.join(process.cwd(), 'projects.json');

export const workspace = {
  /**
   * Load workspace configuration
   */
  loadWorkspace(): WorkspaceConfig | null {
    try {
      if (fs.existsSync(workspaceFile)) {
        const content = fs.readFileSync(workspaceFile, 'utf8');
        const parsed = JSON.parse(content);
        return parsed;
      } else {
        console.error(timmy.error(`workspace.json not found at: ${workspaceFile}`));
      }
    } catch (error) {
      console.error(timmy.error(`Failed to load workspace.json: ${(error as Error).message}`));
      console.error(timmy.error(`Path: ${workspaceFile}`));
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
      console.error(timmy.error(`Failed to save workspace.json: ${(error as Error).message}`));
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
      console.error(timmy.error(`Failed to load projects.json: ${(error as Error).message}`));
    }
    return null;
  },

  /**
   * Get currently active project
   */
  getActiveProject(): ProjectConfig | null {
    const workspaceConfig = this.loadWorkspace();
    if (!workspaceConfig) {
      console.error(timmy.error('No active project set in workspace.json'));
      return null;
    }

    // Support both 'active' and 'activeProject' field names
    const activeProjectName = workspaceConfig.active || workspaceConfig.activeProject;
    if (!activeProjectName) {
      console.error(timmy.error('No active project set in workspace.json'));
      return null;
    }

    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(timmy.error('Failed to load projects.json'));
      return null;
    }

    const project = projectsConfig.projects[activeProjectName];
    if (!project) {
      console.error(timmy.error(`Project "${activeProjectName}" not found in projects.json`));
      return null;
    }

    return project;
  },

  /**
   * Get active project name
   */
  getActiveProjectName(): string | null {
    const workspaceConfig = this.loadWorkspace();
    return workspaceConfig?.active || workspaceConfig?.activeProject || null;
  },

  /**
   * Switch to a different project
   */
  switchProject(projectName: string): boolean {
    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(timmy.error('Failed to load projects.json'));
      return false;
    }

    if (!projectsConfig.projects[projectName]) {
      console.error(timmy.error(`Project "${projectName}" not found in projects.json`));
      console.log(timmy.info('Available projects:'));
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
    console.log(timmy.success(`Switched to project: ${colors.bright}${project.name}${colors.reset}`));
    console.log(timmy.info(`ClickUp Workspace: ${project.clickup.workspaceId}`));
    console.log(timmy.info(`GitHub: ${project.github.owner}/${project.github.repo}`));
    console.log(timmy.info(`Path: ${project.github.path}`));

    return true;
  },

  /**
   * List all available projects
   */
  listProjects(): void {
    const projectsConfig = this.loadProjects();
    if (!projectsConfig) {
      console.error(timmy.error('Failed to load projects.json'));
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
    console.log(timmy.info('To switch projects: npm run switch <project-name>'));
    console.log('');
  },

  /**
   * Show current project info
   */
  showCurrent(): void {
    const projectName = this.getActiveProjectName();
    const project = this.getActiveProject();

    if (!project || !projectName) {
      console.error(timmy.error('No active project configured'));
      console.log(timmy.info('Run: npm run projects'));
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
