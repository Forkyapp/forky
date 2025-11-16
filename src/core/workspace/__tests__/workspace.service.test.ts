/**
 * Workspace Service Tests
 * Tests multi-project workspace management
 */

import fs from 'fs';
import path from 'path';
import { workspace } from '../workspace.service';
import type { WorkspaceConfig, ProjectsConfig } from '../workspace.service';

// Mock console methods to avoid cluttering test output
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('Workspace Service', () => {
  const originalCwd = process.cwd();
  let testDir: string;
  let workspaceFile: string;
  let projectsFile: string;

  beforeEach(() => {
    // Create temp directory for test files
    testDir = path.join(__dirname, '__test_workspace__');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    workspaceFile = path.join(testDir, 'workspace.json');
    projectsFile = path.join(testDir, 'projects.json');

    // Change process.cwd to test directory
    process.chdir(testDir);

    // Mock console methods
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    // Restore process.cwd
    process.chdir(originalCwd);

    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('loadWorkspace', () => {
    it('should load existing workspace configuration', () => {
      const config: WorkspaceConfig = {
        active: 'my-project',
        comment: 'Test workspace',
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(config));

      const result = workspace.loadWorkspace();
      expect(result).toEqual(config);
    });

    it('should return null when workspace.json does not exist', () => {
      const result = workspace.loadWorkspace();
      expect(result).toBeNull();
    });

    it('should return null and log error on corrupted JSON', () => {
      fs.writeFileSync(workspaceFile, 'invalid json');

      const result = workspace.loadWorkspace();
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should support activeProject field for backward compatibility', () => {
      const config: WorkspaceConfig = {
        activeProject: 'legacy-project',
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(config));

      const result = workspace.loadWorkspace();
      expect(result).toEqual(config);
    });
  });

  describe('saveWorkspace', () => {
    it('should save workspace configuration', () => {
      const config: WorkspaceConfig = {
        active: 'my-project',
        comment: 'Test workspace',
      };

      workspace.saveWorkspace(config);

      const savedContent = fs.readFileSync(workspaceFile, 'utf8');
      const savedConfig = JSON.parse(savedContent);
      expect(savedConfig).toEqual(config);
    });

    it('should format JSON with indentation', () => {
      const config: WorkspaceConfig = {
        active: 'my-project',
      };

      workspace.saveWorkspace(config);

      const savedContent = fs.readFileSync(workspaceFile, 'utf8');
      expect(savedContent).toContain('\n');
      expect(savedContent).toContain('  ');
    });

    it('should handle write errors gracefully', () => {
      const readonlyDir = path.join(testDir, 'readonly');
      fs.mkdirSync(readonlyDir);

      // Change to readonly directory
      process.chdir(readonlyDir);

      // Make it readonly
      fs.chmodSync(readonlyDir, 0o444);

      workspace.saveWorkspace({ active: 'test' });

      expect(console.error).toHaveBeenCalled();

      // Restore permissions for cleanup
      fs.chmodSync(readonlyDir, 0o755);
    });
  });

  describe('loadProjects', () => {
    it('should load existing projects configuration', () => {
      const config: ProjectsConfig = {
        projects: {
          'my-app': {
            name: 'My Application',
            description: 'Main app',
            clickup: {
              workspaceId: '12345',
            },
            github: {
              owner: 'test-owner',
              repo: 'test-repo',
              path: '/test/path',
              baseBranch: 'main',
            },
          },
        },
      };

      fs.writeFileSync(projectsFile, JSON.stringify(config));

      const result = workspace.loadProjects();
      expect(result).toEqual(config);
    });

    it('should return null when projects.json does not exist', () => {
      const result = workspace.loadProjects();
      expect(result).toBeNull();
    });

    it('should return null and log error on corrupted JSON', () => {
      fs.writeFileSync(projectsFile, 'invalid json');

      const result = workspace.loadProjects();
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getActiveProject', () => {
    it('should return active project configuration', () => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'my-app',
      };
      const projectsConfig: ProjectsConfig = {
        projects: {
          'my-app': {
            name: 'My Application',
            clickup: {
              workspaceId: '12345',
            },
            github: {
              owner: 'test-owner',
              repo: 'test-repo',
              path: '/test/path',
              baseBranch: 'main',
            },
          },
        },
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));
      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));

      const result = workspace.getActiveProject();
      expect(result).toEqual(projectsConfig.projects['my-app']);
    });

    it('should return null when workspace.json does not exist', () => {
      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null when no active project is set', () => {
      const workspaceConfig: WorkspaceConfig = {};
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null when projects.json does not exist', () => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'my-app',
      };
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should return null when active project not found in projects.json', () => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'non-existent',
      };
      const projectsConfig: ProjectsConfig = {
        projects: {
          'my-app': {
            name: 'My Application',
            clickup: {
              workspaceId: '12345',
            },
            github: {
              owner: 'test-owner',
              repo: 'test-repo',
              path: '/test/path',
              baseBranch: 'main',
            },
          },
        },
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));
      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));

      const result = workspace.getActiveProject();
      expect(result).toBeNull();
    });

    it('should support activeProject field for backward compatibility', () => {
      const workspaceConfig: WorkspaceConfig = {
        activeProject: 'my-app',
      };
      const projectsConfig: ProjectsConfig = {
        projects: {
          'my-app': {
            name: 'My Application',
            clickup: {
              workspaceId: '12345',
            },
            github: {
              owner: 'test-owner',
              repo: 'test-repo',
              path: '/test/path',
              baseBranch: 'main',
            },
          },
        },
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));
      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));

      const result = workspace.getActiveProject();
      expect(result).toBeDefined();
      expect(result?.name).toBe('My Application');
    });
  });

  describe('getActiveProjectName', () => {
    it('should return active project name', () => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'my-app',
      };
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      const result = workspace.getActiveProjectName();
      expect(result).toBe('my-app');
    });

    it('should return null when workspace.json does not exist', () => {
      const result = workspace.getActiveProjectName();
      expect(result).toBeNull();
    });

    it('should return null when no active project is set', () => {
      const workspaceConfig: WorkspaceConfig = {};
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      const result = workspace.getActiveProjectName();
      expect(result).toBeNull();
    });

    it('should support activeProject field', () => {
      const workspaceConfig: WorkspaceConfig = {
        activeProject: 'legacy-app',
      };
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      const result = workspace.getActiveProjectName();
      expect(result).toBe('legacy-app');
    });
  });

  describe('switchProject', () => {
    beforeEach(() => {
      const projectsConfig: ProjectsConfig = {
        projects: {
          'project-a': {
            name: 'Project A',
            description: 'First project',
            clickup: {
              workspaceId: 'workspace-a',
            },
            github: {
              owner: 'owner-a',
              repo: 'repo-a',
              path: '/path/a',
              baseBranch: 'main',
            },
          },
          'project-b': {
            name: 'Project B',
            clickup: {
              workspaceId: 'workspace-b',
            },
            github: {
              owner: 'owner-b',
              repo: 'repo-b',
              path: '/path/b',
              baseBranch: 'develop',
            },
          },
        },
      };

      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));
    });

    it('should switch to specified project', () => {
      const result = workspace.switchProject('project-a');

      expect(result).toBe(true);

      const workspaceConfig = workspace.loadWorkspace();
      expect(workspaceConfig?.active).toBe('project-a');
    });

    it('should create workspace.json with comment', () => {
      workspace.switchProject('project-a');

      const workspaceConfig = workspace.loadWorkspace();
      expect(workspaceConfig?.comment).toContain('currently active project');
    });

    it('should return false for non-existent project', () => {
      const result = workspace.switchProject('non-existent');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should list available projects when switching to non-existent project', () => {
      workspace.switchProject('non-existent');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Available projects:'));
    });

    it('should return false when projects.json does not exist', () => {
      fs.unlinkSync(projectsFile);

      const result = workspace.switchProject('project-a');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should log project details after successful switch', () => {
      workspace.switchProject('project-a');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Switched to project:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ClickUp Workspace:'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GitHub:'));
    });
  });

  describe('listProjects', () => {
    beforeEach(() => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'project-a',
      };
      const projectsConfig: ProjectsConfig = {
        projects: {
          'project-a': {
            name: 'Project A',
            description: 'First project',
            clickup: {
              workspaceId: 'workspace-a',
            },
            github: {
              owner: 'owner-a',
              repo: 'repo-a',
              path: '/path/a',
              baseBranch: 'main',
            },
          },
          'project-b': {
            name: 'Project B',
            clickup: {
              workspaceId: 'workspace-b',
            },
            github: {
              owner: 'owner-b',
              repo: 'repo-b',
              path: '/path/b',
              baseBranch: 'develop',
            },
          },
        },
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));
      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));
    });

    it('should list all projects', () => {
      workspace.listProjects();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Available Projects'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('project-a'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('project-b'));
    });

    it('should indicate active project', () => {
      workspace.listProjects();

      // Active project should have ● marker
      const calls = (console.log as jest.Mock).mock.calls.map((call) => call[0]).join('\n');
      expect(calls).toContain('●');
    });

    it('should show project descriptions when available', () => {
      workspace.listProjects();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('First project'));
    });

    it('should show switch command hint', () => {
      workspace.listProjects();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('npm run switch'));
    });

    it('should handle missing projects.json', () => {
      fs.unlinkSync(projectsFile);

      workspace.listProjects();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load'));
    });
  });

  describe('showCurrent', () => {
    beforeEach(() => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'my-app',
      };
      const projectsConfig: ProjectsConfig = {
        projects: {
          'my-app': {
            name: 'My Application',
            description: 'Main application',
            clickup: {
              workspaceId: 'workspace-123',
            },
            github: {
              owner: 'my-owner',
              repo: 'my-repo',
              path: '/my/path',
              baseBranch: 'main',
            },
          },
        },
      };

      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));
      fs.writeFileSync(projectsFile, JSON.stringify(projectsConfig));
    });

    it('should show current project details', () => {
      workspace.showCurrent();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Current Active Project'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('My Application'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('workspace-123'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('my-owner/my-repo'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/my/path'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('main'));
    });

    it('should show description if available', () => {
      workspace.showCurrent();

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Main application'));
    });

    it('should show error when no active project', () => {
      fs.unlinkSync(workspaceFile);

      workspace.showCurrent();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No active project'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('npm run projects'));
    });

    it('should show error when active project not found', () => {
      const workspaceConfig: WorkspaceConfig = {
        active: 'non-existent',
      };
      fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig));

      workspace.showCurrent();

      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('No active project'));
    });
  });
});
