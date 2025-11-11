#!/usr/bin/env ts-node
/**
 * Project switcher CLI
 * Usage: npm run switch <project-name>
 */

import { workspace } from '../lib/workspace';

const projectName = process.argv[2];

if (!projectName) {
  console.error('Error: Project name required');
  console.log('\nUsage: npm run switch <project-name>');
  console.log('\nTo see available projects: npm run projects\n');
  process.exit(1);
}

const success = workspace.switchProject(projectName);
process.exit(success ? 0 : 1);
