#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

interface FileMetadata {
  path: string;
  title: string;
  category: string;
  tags: string[];
  related: string[];
  difficulty: string;
  lines: number;
  lastUpdated: string;
}

interface ContextIndex {
  generatedAt: string;
  totalFiles: number;
  files: FileMetadata[];
  categories: Record<string, string[]>;
  tags: Record<string, string[]>;
  relatedGraph: Record<string, string[]>;
}

/**
 * Parse frontmatter from markdown file
 */
function parseFrontmatter(content: string): Record<string, any> | null {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return null;

  const frontmatter: Record<string, any> = {};
  const lines = match[1].split('\n');
  let currentKey = '';
  let currentArray: string[] = [];
  let inArray = false;

  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      // Array item
      currentArray.push(line.trim().substring(2));
    } else if (line.includes(':')) {
      // Save previous array if exists
      if (inArray && currentKey) {
        frontmatter[currentKey] = currentArray;
        currentArray = [];
        inArray = false;
      }

      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      currentKey = key.trim();

      if (value === '' || value === '[]') {
        // Start of array
        inArray = true;
        currentArray = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
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

  // Save last array if exists
  if (inArray && currentKey) {
    frontmatter[currentKey] = currentArray;
  }

  return frontmatter;
}

/**
 * Process a single markdown file
 */
function processMarkdownFile(filePath: string, contextDir: string): FileMetadata | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter || !frontmatter.title) {
      return null; // Skip files without proper frontmatter
    }

    const relativePath = path.relative(contextDir, filePath).replace(/\\/g, '/');
    const lines = content.split('\n').length;

    return {
      path: relativePath,
      title: frontmatter.title,
      category: frontmatter.category || 'uncategorized',
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
      related: Array.isArray(frontmatter.related) ? frontmatter.related : [],
      difficulty: frontmatter.difficulty || 'beginner',
      lines,
      lastUpdated: frontmatter.last_updated || new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.warn(`⚠️  Failed to process ${filePath}:`, error);
    return null;
  }
}

/**
 * Recursively scan directory for markdown files
 */
function scanDirectory(dir: string, contextDir: string, files: FileMetadata[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories and certain folders
      if (!entry.name.startsWith('.') && !entry.name.startsWith('node_modules')) {
        scanDirectory(fullPath, contextDir, files);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Skip index files and special files
      if (!entry.name.startsWith('_') && !entry.name.startsWith('.')) {
        const metadata = processMarkdownFile(fullPath, contextDir);
        if (metadata) {
          files.push(metadata);
        }
      }
    }
  }
}

/**
 * Build the context index
 */
function buildContextIndex(contextDir: string): ContextIndex {
  const files: FileMetadata[] = [];
  const categories: Record<string, string[]> = {};
  const tags: Record<string, string[]> = {};
  const relatedGraph: Record<string, string[]> = {};

  console.log('🔍 Scanning markdown files...');
  scanDirectory(contextDir, contextDir, files);

  console.log(`📝 Processing ${files.length} files...`);

  // Build indexes
  for (const file of files) {
    // Index by category
    if (!categories[file.category]) {
      categories[file.category] = [];
    }
    categories[file.category].push(file.path);

    // Index by tags
    for (const tag of file.tags) {
      if (!tags[tag]) {
        tags[tag] = [];
      }
      if (!tags[tag].includes(file.path)) {
        tags[tag].push(file.path);
      }
    }

    // Build related graph
    if (file.related.length > 0) {
      relatedGraph[file.path] = file.related;
    }
  }

  // Sort files by path
  files.sort((a, b) => a.path.localeCompare(b.path));

  return {
    generatedAt: new Date().toISOString(),
    totalFiles: files.length,
    files,
    categories,
    tags,
    relatedGraph
  };
}

/**
 * Generate human-readable report
 */
function generateReport(index: ContextIndex): string {
  const report: string[] = [];

  report.push('# Context Index Report\n');
  report.push(`Generated: ${index.generatedAt}`);
  report.push(`Total Files: ${index.totalFiles}\n`);

  // Categories
  report.push('## Categories\n');
  for (const [category, files] of Object.entries(index.categories).sort()) {
    report.push(`- **${category}** (${files.length} files)`);
  }

  // Tags
  report.push('\n## Top Tags\n');
  const sortedTags = Object.entries(index.tags)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20);

  for (const [tag, files] of sortedTags) {
    report.push(`- **${tag}** (${files.length} files)`);
  }

  // File size distribution
  report.push('\n## File Size Distribution\n');
  const sizeRanges = {
    'Small (<100 lines)': 0,
    'Medium (100-200 lines)': 0,
    'Large (200-300 lines)': 0,
    'Very Large (>300 lines)': 0
  };

  for (const file of index.files) {
    if (file.lines < 100) sizeRanges['Small (<100 lines)']++;
    else if (file.lines < 200) sizeRanges['Medium (100-200 lines)']++;
    else if (file.lines < 300) sizeRanges['Large (200-300 lines)']++;
    else sizeRanges['Very Large (>300 lines)']++;
  }

  for (const [range, count] of Object.entries(sizeRanges)) {
    report.push(`- ${range}: ${count} files`);
  }

  return report.join('\n');
}

/**
 * Main execution
 */
function main(): void {
  const contextDir = path.resolve(__dirname, '../templates/context');

  if (!fs.existsSync(contextDir)) {
    console.error(`❌ Context directory not found: ${contextDir}`);
    process.exit(1);
  }

  console.log('🚀 Building context index...\n');

  // Build index
  const index = buildContextIndex(contextDir);

  // Write JSON index
  const indexPath = path.join(contextDir, 'context-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✅ Index written to: ${indexPath}`);

  // Write human-readable report
  const reportPath = path.join(contextDir, 'CONTEXT_REPORT.md');
  const report = generateReport(index);
  fs.writeFileSync(reportPath, report);
  console.log(`✅ Report written to: ${reportPath}`);

  // Print summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total files: ${index.totalFiles}`);
  console.log(`   Categories: ${Object.keys(index.categories).length}`);
  console.log(`   Tags: ${Object.keys(index.tags).length}`);
  console.log(`   Files with relations: ${Object.keys(index.relatedGraph).length}`);
}

main();
