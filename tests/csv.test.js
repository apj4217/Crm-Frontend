import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell } from '../src/lib/csv.js';

test("CSV exports neutralize spreadsheet formula injection while preserving numeric values", () => {
  assert.match(escapeCsvCell("=HYPERLINK(\"https://attacker.example\",\"click\")"), /^"'=HYPERLINK/);
  assert.match(escapeCsvCell("  +CMD|\/C calc"), /^"'  \+CMD/);
  assert.equal(escapeCsvCell(-18.52), "\"-18.52\"");
  assert.equal(escapeCsvCell('Medical "A"'), '"Medical ""A"""');
});


