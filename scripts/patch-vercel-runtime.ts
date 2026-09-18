/**
 * Rewrites the Serverless Function runtime in the Astro Vercel adapter's build output.
 *
 * Why this exists: `@astrojs/vercel` derives the runtime from the Node.js version running
 * the build, looked up in a table hardcoded inside the adapter. In 7.x that table only
 * knows 18 and 20, so a build on any newer major falls through to a literal `nodejs18.x`
 * fallback. Vercel builds with Node 24 and no longer accepts 18, so the deploy was
 * rejected with:
 *
 *   The following Serverless Functions contain an invalid "runtime":
 *     - _render (nodejs18.x)
 *
 * Bumping the adapter does not help: 7.7.0 and 7.8.2 carry the same date-blind table
 * (`{ 18: retiring, 20: default }`), so 22 and 24 fall through to 18 just the same. The
 * only version that fixes it properly is `@astrojs/vercel` 8+, which requires Astro 5.
 * Pinning the build to Node 20 would work for exactly two weeks: Vercel disables Node 20
 * for Functions and Builds on 2026-10-01.
 *
 * So the runtime is written here instead. `.vc-config.json` is the documented place a
 * Build Output API v3 project declares a function's runtime, so this sets a supported
 * value in the file that owns it; it does not reach into anything undocumented.
 *
 * Usage: `bun run scripts/patch-vercel-runtime.ts [output-functions-dir]`
 *
 * Every failure exits non-zero on purpose. The dangerous outcome is not a broken build,
 * it is a build that quietly deploys `nodejs18.x` again, so anything this script cannot
 * recognise is an error rather than a skip. Delete this file once the adapter knows the
 * target major.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Vercel supports 24.x, 22.x and 20.x; 20 is disabled on 2026-10-01, so this targets 22. */
const TARGET_RUNTIME = "nodejs22.x";

/** Where the adapter writes the Build Output API tree, relative to the project root. */
const DEFAULT_FUNCTIONS_DIR = ".vercel/output/functions";

/** Any `nodejs<major>.x` value, which is what the adapter is expected to have written. */
const RUNTIME_PATTERN = /^nodejs\d+\.x$/;

function fail(message: string): never {
  console.error(`patch-vercel-runtime: ${message}`);
  process.exit(1);
}

interface FunctionConfig {
  config: Record<string, unknown>;
  runtime: string;
}

/**
 * Reads one function's `.vc-config.json` and validates the runtime it declares.
 *
 * The read and the parse are both wrapped: a truncated or hand-edited file has to fail
 * with the reason this script exists for, not with a raw stack trace that reads like a
 * bug in the patch itself.
 */
function readFunctionConfig(configPath: string): FunctionConfig {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    fail(`"${configPath}" is not readable JSON (${(error as Error).message}).`);
  }

  const runtime = parsed.runtime;
  if (typeof runtime !== "string" || !RUNTIME_PATTERN.test(runtime)) {
    fail(
      `"${configPath}" declares an unexpected runtime (${JSON.stringify(runtime)}). ` +
        `Expected a string matching ${RUNTIME_PATTERN}.`,
    );
  }

  return { config: parsed, runtime };
}

function main(): void {
  const functionsDir = process.argv[2] ?? DEFAULT_FUNCTIONS_DIR;

  if (!existsSync(functionsDir) || !statSync(functionsDir).isDirectory()) {
    fail(
      `expected the adapter's function output at "${functionsDir}" and found no such directory. ` +
        `If the adapter changed where it writes its build output, this script needs updating ` +
        `rather than skipping: a skipped patch deploys an unsupported runtime.`,
    );
  }

  const bundles = readdirSync(functionsDir).filter((entry) => {
    const path = join(functionsDir, entry);
    return entry.endsWith(".func") && statSync(path).isDirectory();
  });

  if (bundles.length === 0) {
    fail(`found no "*.func" bundle under "${functionsDir}". The output shape changed.`);
  }

  let changed = 0;
  let alreadyCurrent = 0;

  for (const bundle of bundles) {
    const configPath = join(functionsDir, bundle, ".vc-config.json");
    if (!existsSync(configPath)) {
      fail(`"${configPath}" is missing, so the function's runtime cannot be set.`);
    }

    const { config, runtime } = readFunctionConfig(configPath);

    if (runtime === TARGET_RUNTIME) {
      alreadyCurrent += 1;
      continue;
    }

    config.runtime = TARGET_RUNTIME;
    // The adapter writes tab-indented JSON, so the rewrite keeps the file's own style.
    writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
    console.log(`patch-vercel-runtime: ${bundle} ${runtime} -> ${TARGET_RUNTIME}`);
    changed += 1;
  }

  console.log(
    `patch-vercel-runtime: ${changed} runtime(s) rewritten, ${alreadyCurrent} already on ${TARGET_RUNTIME}.`,
  );
}

main();
