#!/usr/bin/env ts-node
/**
 * List all available projects
 * Usage: npm run projects
 */

import { workspace } from '../lib/workspace';

workspace.listProjects();
