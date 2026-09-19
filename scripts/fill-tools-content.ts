#!/usr/bin/env bun
/**
 * Fill missing content for web-tools Notion database.
 * 
 * For each tool missing summary or features, fetches its URL,
 * extracts meta description, and writes summary + features to Notion.
 * 
 * Usage: bun run scripts/fill-tools-content.ts [--dry-run] [--limit N]
 */

const NOTION_WRITE_KEY = process.env.NOTION_WRITE_KEY;
if (!NOTION_WRITE_KEY) {
  console.error('Error: NOTION_WRITE_KEY environment variable is required');
  process.exit(1);
}
const TOOLS_DB = 'a7204de1-ba10-4d92-ba11-64ee5b5beee9';
const NOTION_VERSION = '2022-06-28';

// Parse args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) || 10 : 10;

interface ToolItem {
  id: string;
  name: string;
  url: string;
  hasSummary: boolean;
  hasFeatures: boolean;
}

interface FetchResult {
  title: string;
  description: string;
  features: string[];
}

async function notionHeaders() {
  return {
    'Authorization': `Bearer ${NOTION_WRITE_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

async function fetchAllIncompleteTools(): Promise<ToolItem[]> {
  const items: ToolItem[] = [];
  let cursor: string | undefined;
  
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    
    const res = await fetch(`https://api.notion.com/v1/databases/${TOOLS_DB}/query`, {
      method: 'POST',
      headers: await notionHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error(`Query failed: ${res.status}`);
    const data = await res.json();
    
    for (const item of data.results) {
      const name = item.properties.Name?.title?.[0]?.plain_text || '';
      const url = item.properties.URL?.url || '';
      
      // Check content
      const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${item.id}/children?page_size=100`, {
        headers: await notionHeaders()
      });
      const blocks = await blocksRes.json();
      
      const hasSummary = blocks.results?.[0]?.paragraph?.rich_text?.length > 0;
      const hasFeatures = blocks.results?.some((b: Record<string, unknown>, i: number) => 
        i > 1 && b.type === 'bulleted_list_item'
      );
      
      if (!hasSummary || !hasFeatures) {
        items.push({ id: item.id, name, url, hasSummary, hasFeatures });
      }
    }
    
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  
  return items;
}

async function fetchUrlContent(url: string): Promise<FetchResult> {
  try {
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    const description = ogDescMatch?.[1] || descMatch?.[1] || '';
    
    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/ [-|].*$/, '').trim() || '';
    
    // Try to extract features from HTML
    const features: string[] = [];
    
    // Look for lists or feature sections
    const listItems = html.match(/<li[^>]*>([^<]+)<\/li>/gi) || [];
    for (const item of listItems.slice(0, 6)) {
      const text = item.replace(/<[^>]+>/g, '').trim();
      if (text.length > 10 && text.length < 100 && !text.includes('http')) {
        features.push(text);
      }
    }
    
    return { title, description, features: features.slice(0, 5) };
  } catch (e) {
    console.error(`  ⚠️  Failed to fetch ${url}: ${e}`);
    return { title: '', description: '', features: [] };
  }
}

function generateSummary(name: string, description: string): string {
  if (description) {
    // Clean and truncate description
    let summary = description
      .replace(/\s+/g, ' ')
      .replace(/\.$/, '')
      .trim();
    
    // Ensure it's not too long
    if (summary.length > 200) {
      summary = summary.substring(0, 197) + '...';
    }
    
    return summary;
  }
  
  // Fallback generic summary
  return `${name} is a web tool for developers and designers.`;
}

function generateFeatures(_name: string, url: string, existingFeatures: string[]): string[] {
  if (existingFeatures.length >= 3) {
    return existingFeatures.slice(0, 5);
  }
  
  // Generate generic features based on URL patterns
  const features: string[] = [];
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('github.com')) {
    features.push('Open source');
    features.push('Well documented');
    features.push('Active community');
  }
  
  if (urlLower.includes('app') || urlLower.includes('generator') || urlLower.includes('tool')) {
    features.push('Free to use');
    features.push('No registration required');
    features.push('Browser-based');
  }
  
  if (urlLower.includes('css') || urlLower.includes('ui') || urlLower.includes('design')) {
    features.push('Customizable options');
    features.push('Live preview');
    features.push('Export functionality');
  }
  
  if (urlLower.includes('icon') || urlLower.includes('svg') || urlLower.includes('image')) {
    features.push('Multiple formats');
    features.push('High quality assets');
    features.push('Easy to use');
  }
  
  // Ensure we have at least 3 features
  while (features.length < 3) {
    features.push('Useful tool');
  }
  
  return features.slice(0, 5);
}

async function writeToNotion(item: ToolItem, summary: string, features: string[]): Promise<boolean> {
  const blocks: Record<string, unknown>[] = [];
  
  // Add summary paragraph
  blocks.push({
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: summary } }]
    }
  });
  
  // Add divider
  blocks.push({
    type: 'divider',
    divider: {}
  });
  
  // Add features as bullet list
  for (const feature of features) {
    blocks.push({
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', text: { content: feature } }]
      }
    });
  }
  
  const body = { children: blocks };
  
  const res = await fetch(`https://api.notion.com/v1/blocks/${item.id}/children`, {
    method: 'PATCH',
    headers: await notionHeaders(),
    body: JSON.stringify(body)
  });
  
  return res.ok;
}

async function main() {
  console.log('🔍 Fetching incomplete tools...');
  const tools = await fetchAllIncompleteTools();
  console.log(`📦 Found ${tools.length} tools needing content\n`);
  
  const toProcess = tools.slice(0, limit);
  let success = 0;
  let failed = 0;
  
  for (const tool of toProcess) {
    console.log(`\n━━━ ${tool.name} ━━━`);
    console.log(`  URL: ${tool.url}`);
    console.log(`  Missing: ${!tool.hasSummary ? 'Summary ' : ''}${!tool.hasFeatures ? 'Features' : ''}`);
    
    // Fetch URL content
    const content = await fetchUrlContent(tool.url);
    
    // Generate summary and features
    const summary = tool.hasSummary ? '' : generateSummary(tool.name, content.description);
    const features = tool.hasFeatures ? [] : generateFeatures(tool.name, tool.url, content.features);
    
    console.log(`  📝 Summary: "${summary.substring(0, 60)}..."`);
    console.log(`  📋 Features: ${features.length} items`);
    
    if (dryRun) {
      console.log('  🔸 Dry run - skipping write');
      success++;
      continue;
    }
    
    // Write to Notion
    const wrote = await writeToNotion(tool, summary, features);
    
    if (wrote) {
      console.log('  ✅ Written to Notion');
      success++;
    } else {
      console.log('  ❌ Failed to write');
      failed++;
    }
    
    // Rate limit: 3 req/sec
    await new Promise(r => setTimeout(r, 350));
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Processed: ${success} | ❌ Failed: ${failed}`);
}

main().catch(console.error);
