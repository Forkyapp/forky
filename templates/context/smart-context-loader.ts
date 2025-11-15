#!/usr/bin/env ts-node
/**
 * Smart Context Loader - Runtime MD File Parser
 *
 * Loads relevant documentation context on-demand without requiring pre-build steps.
 * Parses frontmatter at runtime and uses intelligent matching to find relevant files.
 *
 * Usage:
 *   import { loadContext } from './templates/context/smart-context-loader';
 *   const docs = await loadContext('How do I create a repository?');
 */

import fs from 'fs/promises';
import path from 'path';

interface FrontmatterData {
  title?: string;
  category?: string;
  tags?: string[];
  related?: string[];
  difficulty?: string;
  description?: string;
}

interface DocumentMetadata extends FrontmatterData {
  path: string;
  content: string;
  relevanceScore: number;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): FrontmatterData {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return {};

  const frontmatter: Record<string, unknown> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      currentArray.push(line.trim().substring(2));
    } else if (line.includes(':')) {
      if (inArray && currentKey) {
        frontmatter[currentKey] = currentArray;
        currentArray = [];
        inArray = false;
      }

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      currentKey = key.trim();

      if (value === '' || value === '[]') {
        inArray = true;
        currentArray = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        const arrayContent = value.slice(1, -1);
        frontmatter[currentKey] = arrayContent
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      } else {
        frontmatter[currentKey] = value;
      }
    }
  }

  if (inArray && currentKey) {
    frontmatter[currentKey] = currentArray;
  }

  return frontmatter;
}

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !entry.name.startsWith('_') && entry.name !== 'node_modules') {
          const subFiles = await findMarkdownFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (!entry.name.startsWith('_') && !entry.name.startsWith('.')) {
          files.push(fullPath);
        }
      }
    }
  } catch (_error) {
    // Ignore errors for non-existent directories
  }

  return files;
}

/**
 * Calculate relevance score for a document based on query
 */
function calculateRelevance(query: string, metadata: FrontmatterData, content: string): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Title match (highest weight)
  if (metadata.title) {
    const titleLower = metadata.title.toLowerCase();
    if (titleLower.includes(queryLower)) score += 100;
    queryWords.forEach(word => {
      if (titleLower.includes(word)) score += 20;
    });
  }

  // Tag match (high weight)
  if (metadata.tags) {
    metadata.tags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (queryLower.includes(tagLower) || tagLower.includes(queryLower)) score += 30;
      queryWords.forEach(word => {
        if (tagLower.includes(word)) score += 10;
      });
    });
  }

  // Category match (medium weight)
  if (metadata.category) {
    const categoryLower = metadata.category.toLowerCase();
    queryWords.forEach(word => {
      if (categoryLower.includes(word)) score += 15;
    });
  }

  // Description match (medium weight)
  if (metadata.description) {
    const descLower = metadata.description.toLowerCase();
    queryWords.forEach(word => {
      if (descLower.includes(word)) score += 5;
    });
  }

  // Content match (low weight, avoid loading entire content)
  const contentPreview = content.substring(0, 2000).toLowerCase();
  queryWords.forEach(word => {
    const matches = (contentPreview.match(new RegExp(word, 'g')) || []).length;
    score += Math.min(matches * 2, 10); // Cap at 10 points per word
  });

  return score;
}

/**
 * Load and rank documents by relevance
 */
export async function loadContext(
  query: string,
  options: {
    contextDir?: string;
    maxResults?: number;
    minScore?: number;
    includeRelated?: boolean;
  } = {}
): Promise<DocumentMetadata[]> {
  const {
    contextDir = path.resolve(__dirname),
    maxResults = 5,
    minScore = 10,
    includeRelated = true,
  } = options;

  // Find all markdown files
  const mdFiles = await findMarkdownFiles(contextDir);

  // Parse and score each file
  const documents: DocumentMetadata[] = [];

  for (const filePath of mdFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);

      if (!frontmatter.title) continue; // Skip files without proper frontmatter

      const score = calculateRelevance(query, frontmatter, content);

      if (score >= minScore) {
        documents.push({
          ...frontmatter,
          path: path.relative(contextDir, filePath),
          content,
          relevanceScore: score,
        });
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  // Sort by relevance score (descending)
  documents.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Take top N results
  let results = documents.slice(0, maxResults);

  // Include related documents if requested
  if (includeRelated && results.length > 0) {
    const relatedPaths = new Set<string>();
    results.forEach(doc => {
      if (doc.related) {
        doc.related.forEach(rel => relatedPaths.add(rel));
      }
    });

    // Load related documents
    const relatedDocs: DocumentMetadata[] = [];
    for (const relPath of relatedPaths) {
      const matchingDoc = documents.find(d =>
        d.path.includes(relPath) || d.title?.toLowerCase().includes(relPath.toLowerCase())
      );
      if (matchingDoc && !results.includes(matchingDoc)) {
        relatedDocs.push({ ...matchingDoc, relevanceScore: matchingDoc.relevanceScore * 0.5 });
      }
    }

    results = [...results, ...relatedDocs.slice(0, 3)]; // Add up to 3 related docs
  }

  return results;
}

/**
 * Get context by category
 */
export async function loadByCategory(
  category: string,
  options: { contextDir?: string } = {}
): Promise<DocumentMetadata[]> {
  const { contextDir = path.resolve(__dirname) } = options;
  const mdFiles = await findMarkdownFiles(contextDir);
  const documents: DocumentMetadata[] = [];

  for (const filePath of mdFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.category === category) {
        documents.push({
          ...frontmatter,
          path: path.relative(contextDir, filePath),
          content,
          relevanceScore: 100,
        });
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  return documents;
}

/**
 * Get context by tag
 */
export async function loadByTag(
  tag: string,
  options: { contextDir?: string } = {}
): Promise<DocumentMetadata[]> {
  const { contextDir = path.resolve(__dirname) } = options;
  const mdFiles = await findMarkdownFiles(contextDir);
  const documents: DocumentMetadata[] = [];

  for (const filePath of mdFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const frontmatter = parseFrontmatter(content);

      if (frontmatter.tags && frontmatter.tags.includes(tag)) {
        documents.push({
          ...frontmatter,
          path: path.relative(contextDir, filePath),
          content,
          relevanceScore: 100,
        });
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  return documents;
}

/**
 * CLI usage
 */
if (require.main === module) {
  const query = process.argv.slice(2).join(' ');

  if (!query) {
    console.log('Usage: ts-node smart-context-loader.ts <query>');
    console.log('Example: ts-node smart-context-loader.ts "How do I create a repository?"');
    process.exit(1);
  }

  loadContext(query).then(results => {
    console.log(`\n📚 Found ${results.length} relevant documents:\n`);
    results.forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.title} (score: ${doc.relevanceScore})`);
      console.log(`   Path: ${doc.path}`);
      console.log(`   Category: ${doc.category}`);
      console.log(`   Tags: ${doc.tags?.join(', ') || 'none'}`);
      console.log();
    });
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
