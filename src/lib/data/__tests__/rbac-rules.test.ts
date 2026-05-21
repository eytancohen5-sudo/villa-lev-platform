// Rules-text assertion suite for the RBAC change.
//
// Why this exists (and what it doesn't do):
//   The canonical way to test Firestore rules is `@firebase/rules-unit-
//   testing`, which spins up the Firestore emulator (Java required). The
//   build host for tonight's ship has no JRE installed, so we can't run
//   the emulator-based suite without out-of-scope infra changes.
//
//   This test is a structural/lexical guard: it loads the rules file as
//   text and asserts that the BLOCKER guards from plan-challenger are
//   present on the right predicates. It will catch:
//     - role-enum check accidentally dropped from a users/ write predicate
//     - lastSignInAt whitelist accidentally widened
//     - legacy-admin fallback accidentally removed before its time
//     - canEdit() guard accidentally dropped from scenarios writes
//
//   It will NOT catch logic errors inside the rules language (e.g. an
//   `allow` with a typo'd helper name that resolves to false silently).
//   That coverage is the follow-up emulator suite.
//
//   The pragmatic substitute is documented in the RBAC ADR (0002) and in
//   the implementer's final report.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Rules file lives in the sibling admin repo. The platform's vitest CWD is
// `villa-lev-platform/`, so resolve relative to the project root.
// __dirname = villa-lev-platform/src/lib/data/__tests__ — six levels up
// lands at ~/Desktop, then back down into the sibling `Villa Lev Claude`
// workspace where the admin repo lives.
const RULES_PATH = resolve(
  __dirname,
  "../../../../../../Villa Lev Claude/villa-lev-admin/firestore.rules",
);

function loadRules(): string {
  return readFileSync(RULES_PATH, "utf8");
}

// Extract a `match /<path>/ { ... }` block by collection name. Returns the
// substring including the opening match line and closing brace.
//
// Subtle: rule paths contain `{placeholder}` segments (e.g.
// `match /users/{uid}`) — those braces are NOT block delimiters. We start
// counting body braces only AFTER skipping past the header up to the first
// space-followed-by-`{` (the block open).
function extractMatchBlock(rules: string, matchHeader: string): string {
  const startIdx = rules.indexOf(matchHeader);
  if (startIdx < 0) {
    throw new Error(`No match block found for header: ${matchHeader}`);
  }
  // Find the body-opening brace: the first `{` that comes AFTER the header
  // and is preceded by whitespace (so we don't catch a `{placeholder}` brace).
  const headerEnd = startIdx + matchHeader.length;
  let bodyOpen = -1;
  for (let i = headerEnd; i < rules.length; i += 1) {
    if (rules[i] === "{" && /\s/.test(rules[i - 1] ?? "")) {
      bodyOpen = i;
      break;
    }
  }
  if (bodyOpen < 0) {
    throw new Error(`No body brace found for: ${matchHeader}`);
  }
  // Now walk forward from the body open, ignoring nested `{placeholder}`
  // braces inside any further `match` headers (none expected today, but
  // safe).
  let depth = 1;
  for (let i = bodyOpen + 1; i < rules.length; i += 1) {
    const ch = rules[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return rules.slice(startIdx, i + 1);
      }
    }
  }
  throw new Error(`Unterminated match block for: ${matchHeader}`);
}

describe("firestore.rules — RBAC structural guards", () => {
  it("rules file is readable from the admin repo", () => {
    const rules = loadRules();
    expect(rules.length).toBeGreaterThan(100);
    expect(rules).toContain("rules_version = '2';");
  });

  // ── BLOCKER #1: role-enum validation ──────────────────────────────────

  it("defines isValidRoleWrite() with all three valid roles", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isValidRoleWrite\s*\(\s*\)/);
    expect(rules).toMatch(
      /request\.resource\.data\.role\s+in\s+\[\s*'admin'\s*,\s*'editor'\s*,\s*'viewer'\s*\]/,
    );
  });

  it("users/{uid} create predicate gates on isValidRoleWrite()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    // Find the create allow line(s) and assert isValidRoleWrite is in scope.
    expect(usersBlock).toMatch(/allow\s+create\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/);
  });

  it("users/{uid} update predicate gates on isValidRoleWrite() for admin path", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(/allow\s+update\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/);
  });

  it("invites/{inviteId} create predicate gates on isValidRoleWrite()", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(
      /allow\s+create\s*:[\s\S]*?isValidRoleWrite\s*\(\s*\)/,
    );
  });

  it("the role enum is exactly ['admin','editor','viewer'] — no 'owner' / 'Editor' / etc.", () => {
    // Strip rules-language comments (// to end-of-line) so example values
    // referenced in BLOCKER documentation don't trigger false positives.
    const rules = loadRules().replace(/\/\/[^\n]*/g, "");
    expect(rules).toContain("'admin'");
    expect(rules).toContain("'editor'");
    expect(rules).toContain("'viewer'");
    expect(rules).not.toMatch(/['"]Editor['"]/);
    expect(rules).not.toMatch(/['"]Admin['"]/);
    expect(rules).not.toMatch(/['"]Viewer['"]/);
    expect(rules).not.toMatch(/['"]owner['"]/);
    expect(rules).not.toMatch(/['"]Owner['"]/);
  });

  // ── BLOCKER #2: self-update whitelist ─────────────────────────────────

  it("defines isLastSignInOnly() using diff().affectedKeys().hasOnly(['lastSignInAt'])", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isLastSignInOnly\s*\(\s*\)/);
    expect(rules).toMatch(
      /request\.resource\.data\.diff\s*\(\s*resource\.data\s*\)\s*\.\s*affectedKeys\s*\(\s*\)\s*\.\s*hasOnly\s*\(\s*\[\s*'lastSignInAt'\s*\]\s*\)/,
    );
  });

  it("users/{uid} self-update gates on isLastSignInOnly()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    expect(usersBlock).toMatch(
      /request\.auth\.uid\s*==\s*uid\s*&&\s*isLastSignInOnly\s*\(\s*\)/,
    );
  });

  // ── BLOCKER #3: legacy fallback stays alive ───────────────────────────

  it("isLegacyAdmin() is still defined in the rules file", () => {
    const rules = loadRules();
    expect(rules).toMatch(/function\s+isLegacyAdmin\s*\(\s*\)/);
    expect(rules).toContain("eytancohen5@gmail.com");
  });

  it("isAdmin() unions hasRole('admin') with isLegacyAdmin()", () => {
    const rules = loadRules();
    expect(rules).toMatch(
      /function\s+isAdmin\s*\(\s*\)[\s\S]*?hasRole\s*\(\s*['"]admin['"]\s*\)[\s\S]*?isLegacyAdmin\s*\(\s*\)/,
    );
  });

  it("canEdit() unions hasRole('admin') / hasRole('editor') / isLegacyAdmin()", () => {
    const rules = loadRules();
    expect(rules).toMatch(
      /function\s+canEdit\s*\(\s*\)[\s\S]*?hasRole\s*\(\s*['"]editor['"]\s*\)[\s\S]*?isLegacyAdmin\s*\(\s*\)/,
    );
  });

  // ── Scenarios write — must use canEdit() ──────────────────────────────

  it("scenarios/{scenarioId} write predicate gates on canEdit()", () => {
    const scenariosBlock = extractMatchBlock(
      loadRules(),
      "match /scenarios/{scenarioId}",
    );
    expect(scenariosBlock).toMatch(
      /allow\s+create\s*,\s*update\s*:[\s\S]*?canEdit\s*\(\s*\)/,
    );
  });

  it("scenarios/{scenarioId} read is still public (`allow read: if true`)", () => {
    const scenariosBlock = extractMatchBlock(
      loadRules(),
      "match /scenarios/{scenarioId}",
    );
    // Preserves the banker share-link path.
    expect(scenariosBlock).toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
  });

  it("scenarios/{scenarioId} delete stays blocked", () => {
    const scenariosBlock = extractMatchBlock(
      loadRules(),
      "match /scenarios/{scenarioId}",
    );
    expect(scenariosBlock).toMatch(/allow\s+delete\s*:\s*if\s+false\s*;/);
  });

  it("seasonSnapshots read is still public (banker share-link path)", () => {
    const ssBlock = extractMatchBlock(
      loadRules(),
      "match /seasonSnapshots/{snapshotId}",
    );
    expect(ssBlock).toMatch(/allow\s+read\s*:\s*if\s+true\s*;/);
  });

  // ── Invites write hygiene ─────────────────────────────────────────────

  it("invites/{inviteId} update is forbidden", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(/allow\s+update\s*:\s*if\s+false\s*;/);
  });

  it("invites/{inviteId} delete allows matching-email session", () => {
    const invitesBlock = extractMatchBlock(
      loadRules(),
      "match /invites/{inviteId}",
    );
    expect(invitesBlock).toMatch(
      /allow\s+delete\s*:[\s\S]*?request\.auth\.token\.email\.lower\s*\(\s*\)\s*==\s*inviteId/,
    );
  });

  // ── Document-level negative assertions ────────────────────────────────
  // These guards catch the most-likely regressions in subsequent edits.

  it("users/{uid} create predicate does NOT default-allow on isAuthenticated()", () => {
    const usersBlock = extractMatchBlock(loadRules(), "match /users/{uid}");
    // Sanity: an `allow create: if isAuthenticated();` would defeat the
    // invite-claim flow. The actual create predicate is the longer
    // conjunction that references isValidRoleWrite + isAdmin/invite match.
    expect(usersBlock).not.toMatch(
      /allow\s+create\s*:\s*if\s+isAuthenticated\s*\(\s*\)\s*;/,
    );
  });
});
