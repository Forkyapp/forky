#!/usr/bin/env ts-node
/**
 * Show current active project
 * Usage: npm run current
 */

import { workspace } from '../lib/workspace';

workspace.showCurrent();
