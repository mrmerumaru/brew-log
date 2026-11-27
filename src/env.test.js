import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// The service_role key bypasses every RLS policy, so it must never be
// reachable from anything that ships to a browser. Vite only inlines
// VITE_-prefixed vars, which is the mechanism that protects it — but that
// protection is one careless rename away from gone. These tests make the
// mistake loud instead of silent.

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "dist-qa", "coverage"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(join(ROOT, "src")).filter((f) =>
  /\.(js|jsx|ts|tsx)$/.test(f) && !f.endsWith(".test.js") && !f.endsWith(".test.jsx"),
);

describe("service-role key never reaches the client", () => {
  it("has source files to scan (guard the guard)", () => {
    expect(sourceFiles.length).toBeGreaterThan(10);
  });

  it("no src file references the service role key", () => {
    const offenders = sourceFiles.filter((f) =>
      /SERVICE_ROLE|service_role|serviceRole/i.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no src file reads a custom env var without the VITE_ prefix", () => {
    // VITE_-prefixed names are the only CUSTOM vars Vite inlines. The rest are
    // built-ins it provides itself (MODE, DEV, PROD, SSR, BASE_URL) and are
    // legitimate — flagging those would make this test wrong rather than safe.
    const BUILTIN = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL"]);
    const bad = [];
    for (const f of sourceFiles) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(/import\.meta\.env\.([A-Za-z0-9_]+)/g)) {
        const name = m[1];
        if (name.startsWith("VITE_") || BUILTIN.has(name)) continue;
        bad.push(`${f}: ${name}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it(".env.example does not advertise the service role key as an app variable", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");
    // It may be *mentioned* in a warning; it must not be declared as a value.
    expect(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=/m.test(example)).toBe(false);
  });
});
