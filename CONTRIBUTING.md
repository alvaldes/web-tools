# Contributing to web-tools

Thanks for your interest in contributing! This guide explains how to help.

## How to Contribute

### 1. Improve an Existing Tool

Many tools are missing images, better names, summaries, or main features.

**Steps:**

1. Fork the repository
2. Open the [Notion database](https://notion.so) (request access if needed)
3. Find the tool you want to improve
4. Update the content:
   - **Image**: Add a good screenshot or logo (URL or upload)
   - **Name**: Fix typos or make more descriptive
   - **Summary**: Add a 1-2 sentence description in the page body (first paragraph)
   - **Main Features**: Add bullet points in the page body (after the divider)
5. Create a PR mentioning which tool you improved

**Content structure in Notion:**
```
[Summary paragraph]
---
- Feature 1
- Feature 2
- Feature 3
```

### 2. Add a New Tool

**Steps:**

1. Fork the repository
2. Open the [Notion database](https://notion.so) (request access if needed)
3. Add a new row with:
   - **Name**: Tool name
   - **URL**: Tool website
   - **Tags**: Relevant categories
   - **Image**: Screenshot or logo
4. Add content in the page body:
   - Summary paragraph
   - Divider
   - Feature bullets (3-5 items)
5. Create a PR with:
   - Link to the tool
   - Why it should be included
   - Which category it belongs to

**Quality criteria:**
- Tool must be actively maintained
- Free or has a generous free tier
- Useful for web developers/designers
- Not a duplicate of existing tools

### 3. Code Contributions

**Setup:**
```sh
git clone https://github.com/alvaldes/web-tools.git
cd web-tools
bun install
bun run dev
```

**Project structure:**
```
src/
  components/     # Preact UI components
  layouts/        # Astro layouts
  lib/            # Notion API, utilities
  pages/          # Routes and API endpoints
scripts/          # Automation scripts
```

**Common tasks:**
- Fix a bug
- Add a feature
- Improve performance
- Update dependencies

**Guidelines:**
- Follow existing code style
- Add tests for new functionality
- Update documentation if needed
- Keep PRs focused (one change per PR)

## PR Process

1. Create a branch from `main`
2. Make your changes
3. Run tests: `bun test`
4. Push and create PR
5. Describe what you changed and why
6. Wait for review

## Questions?

Open an issue or reach out directly.
