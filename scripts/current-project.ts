#!/usr/bin/env ts-node
/**
 * Show current active project
 * Usage: npm run current
 */

import { workspace } from '../src/core/workspace/workspace.service';

workspace.showCurrent();
