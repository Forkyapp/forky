#!/usr/bin/env node

/**
 * Test Context Loading System
 *
 * This script tests the context orchestrator to verify:
 * 1. RAG system (if OPENAI_API_KEY is set)
 * 2. Smart Loader fallback
 * 3. Context quality and metrics
 */

import 'tsconfig-paths/register';
import dotenv from 'dotenv';
dotenv.config();

import { initializeContextOrchestrator } from './src/core/context/context-orchestrator';
import { timmy, colors } from './src/shared/ui';

async function testContextLoading() {
  console.clear();
  console.log(timmy.banner());
  console.log(timmy.section('🧪 Context Loading Test'));
  console.log('');

  // Check if OpenAI API key is set
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  console.log(timmy.label('  OpenAI API Key', hasApiKey ? '✓ Set (RAG enabled)' : '✗ Not set (Smart Loader only)'));
  console.log(timmy.label('  Context Mode', process.env.CONTEXT_MODE || 'hybrid (default)'));
  console.log('');

  try {
    // Initialize context orchestrator
    console.log(timmy.processing('Initializing context orchestrator...'));
    const orchestrator = await initializeContextOrchestrator(process.env.OPENAI_API_KEY);
    console.log(timmy.success('✓ Context orchestrator initialized'));
    console.log('');

    // Test context loading with a sample task description
    console.log(timmy.section('📝 Test Query'));
    const testQuery = 'Implement user authentication with error handling and logging';
    console.log(`  Query: "${colors.cyan}${testQuery}${colors.reset}"`);
    console.log('');

    console.log(timmy.processing('Loading context...'));
    const startTime = Date.now();

    const context = await orchestrator.loadContext({
      model: 'claude',
      taskDescription: testQuery,
      topK: 5,
      minRelevance: 0.7
    });

    const loadTime = Date.now() - startTime;
    console.log(timmy.success(`✓ Context loaded in ${loadTime}ms`));
    console.log('');

    // Display results
    console.log(timmy.section('📊 Results'));

    if (context && context.trim().length > 0) {
      const lines = context.split('\n').length;
      const chars = context.length;
      const tokens = Math.ceil(chars / 4); // Rough estimate

      console.log(timmy.label('  Status', '✓ Context found'));
      console.log(timmy.label('  Lines', lines.toString()));
      console.log(timmy.label('  Characters', chars.toString()));
      console.log(timmy.label('  Estimated Tokens', tokens.toString()));
      console.log('');

      console.log(timmy.section('📄 Context Preview (first 20 lines)'));
      console.log(colors.gray + '─'.repeat(80) + colors.reset);
      const preview = context.split('\n').slice(0, 20).join('\n');
      console.log(preview);
      if (lines > 20) {
        console.log(colors.gray + `\n... (${lines - 20} more lines)` + colors.reset);
      }
      console.log(colors.gray + '─'.repeat(80) + colors.reset);
    } else {
      console.log(timmy.warning('⚠ No context returned (empty result)'));
      console.log('');
      console.log('This might mean:');
      console.log('  1. .context/ directory is empty');
      console.log('  2. No files match the query');
      console.log('  3. Relevance threshold is too high');
    }

    console.log('');

    // Get statistics
    console.log(timmy.section('📈 Statistics'));
    const stats = orchestrator.getStats();
    console.log(timmy.label('  Total Loads', stats.totalLoads.toString()));
    console.log(timmy.label('  RAG Loads', stats.ragLoads.toString()));
    console.log(timmy.label('  Smart Loads', stats.smartLoads.toString()));
    console.log(timmy.label('  RAG Usage', `${stats.ragPercentage.toFixed(1)}%`));
    console.log(timmy.label('  Avg Load Time', `${stats.avgLoadTimeMs}ms`));
    console.log(timmy.label('  Cache Hit Rate', `${stats.cacheHitRate}%`));
    console.log(timmy.label('  Avg Chunks', stats.avgChunksReturned.toString()));
    console.log('');

    // Success summary
    console.log(timmy.section('✅ Test Complete'));
    if (hasApiKey && stats.ragLoads > 0) {
      console.log(timmy.success('  RAG system is working correctly!'));
    } else if (!hasApiKey && stats.smartLoads > 0) {
      console.log(timmy.success('  Smart Loader is working correctly!'));
      console.log(timmy.info('  Add OPENAI_API_KEY to .env to test RAG mode'));
    } else {
      console.log(timmy.warning('  Context loaded but provider unclear'));
    }
    console.log('');

  } catch (error) {
    console.log(timmy.error('✗ Test failed'));
    console.error(error);
    process.exit(1);
  }
}

// Run test
testContextLoading().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
