/**
 * Stage Failure Prompt Utility
 *
 * Provides interactive prompts when pipeline stages fail,
 * allowing users to retry, skip (if allowed), or abort.
 */

import readline from 'readline';
import { timmy, colors } from '@/shared/ui';

/**
 * Stage configuration
 */
export interface StageConfig {
  name: string;
  canSkip: boolean; // Can this stage be skipped on failure?
  description?: string;
}

/**
 * User action choice
 */
export type StageAction = 'retry' | 'skip' | 'abort';

/**
 * Stage failure result
 */
export interface StagePromptResult {
  action: StageAction;
}

/**
 * Predefined stage configurations
 */
export const STAGE_CONFIGS: Record<string, StageConfig> = {
  analysis: {
    name: 'Gemini Analysis',
    canSkip: true,
    description: 'Task analysis and feature specification'
  },
  implementation: {
    name: 'Claude Implementation',
    canSkip: false,
    description: 'Code implementation (CRITICAL - cannot skip)'
  },
  review: {
    name: 'Codex Code Review',
    canSkip: true,
    description: 'Code quality review'
  },
  fixes: {
    name: 'Claude Fixes',
    canSkip: true,
    description: 'Fix TODO/FIXME comments'
  }
};

/**
 * Prompt user for action when a stage fails
 *
 * @param stageName - Name of the failed stage
 * @param error - Error message
 * @returns User's chosen action
 */
export async function promptStageFailure(
  stageName: string,
  error: string
): Promise<StagePromptResult> {
  const config = STAGE_CONFIGS[stageName];

  if (!config) {
    throw new Error(`Unknown stage: ${stageName}`);
  }

  console.log('\n' + timmy.doubleDivider());
  console.log(timmy.error(`❌ Stage Failed: ${config.name}`));
  console.log(timmy.divider());
  console.log(`  ${timmy.label('Error', error)}`);
  if (config.description) {
    console.log(`  ${timmy.label('Stage', config.description)}`);
  }
  console.log(timmy.divider());

  console.log('\n' + `${colors.bright}${colors.yellow}What would you like to do?${colors.reset}`);
  console.log(`  ${colors.cyan}[1]${colors.reset} ${colors.bright}Retry${colors.reset} - Try this stage again`);

  if (config.canSkip) {
    console.log(`  ${colors.cyan}[2]${colors.reset} ${colors.bright}Skip${colors.reset}  - Skip this stage and continue (stage is optional)`);
    console.log(`  ${colors.cyan}[3]${colors.reset} ${colors.bright}Abort${colors.reset} - Stop the workflow`);
  } else {
    console.log(`  ${colors.dim}[2] Skip  - Not available (stage is CRITICAL)${colors.reset}`);
    console.log(`  ${colors.cyan}[3]${colors.reset} ${colors.bright}Abort${colors.reset} - Stop the workflow`);
  }

  console.log(timmy.doubleDivider());

  const action = await getUserChoice(config.canSkip);

  return { action };
}

/**
 * Get user's choice via readline
 */
function getUserChoice(canSkip: boolean): Promise<StageAction> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const validChoices = canSkip ? ['1', '2', '3'] : ['1', '3'];

    const promptUser = () => {
      rl.question(`${colors.bright}${colors.yellow}Choose an option [${validChoices.join('/')}]:${colors.reset} `, (answer) => {
        const choice = answer.trim();

        if (choice === '1') {
          rl.close();
          console.log(timmy.info('🔄 Retrying stage...\n'));
          resolve('retry');
        } else if (choice === '2' && canSkip) {
          rl.close();
          console.log(timmy.warning('⏭️  Skipping stage...\n'));
          resolve('skip');
        } else if (choice === '3') {
          rl.close();
          console.log(timmy.error('🛑 Aborting workflow...\n'));
          resolve('abort');
        } else {
          console.log(timmy.error(`Invalid choice "${choice}". Please enter ${validChoices.join(' or ')}.`));
          promptUser(); // Ask again
        }
      });
    };

    promptUser();
  });
}

/**
 * Quick helper to check if stage is critical
 */
export function isStageCritical(stageName: string): boolean {
  const config = STAGE_CONFIGS[stageName];
  return config ? !config.canSkip : false;
}
