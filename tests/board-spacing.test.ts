import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

function ruleBody(css: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
}

function remGap(rule: string): number | null {
	const match = rule.match(/(?:^|[^-])gap:\s*([0-9.]+)rem/);
	return match ? Number(match[1]) : null;
}

test('notes, vote rows, and the add-note control clear the hard card shadow', () => {
	const css = readFileSync('src/app.css', 'utf8');
	const shadow = css.match(/--note-shadow:\s*(\d+)px/)?.[1];
	expect(shadow).toBe('8');

	const topicGap = remGap(ruleBody(css, '.topic'));
	const groupRule = ruleBody(css, '.topic.group');
	const groupGap = remGap(groupRule);
	const topicsGap = remGap(ruleBody(css, '.topics'));
	const formGap = ruleBody(css, '.column > form').match(/margin-bottom:\s*([0-9.]+)rem/)?.[1];

	// 8px shadow plus at least ~12px of clear paper (1.25rem = 20px at the root size).
	expect(topicGap).not.toBeNull();
	expect(topicGap!).toBeGreaterThanOrEqual(1.25);
	expect(groupGap ?? topicGap!).toBeGreaterThanOrEqual(1.25);
	expect(topicsGap).not.toBeNull();
	expect(topicsGap!).toBeGreaterThanOrEqual(1.15);
	expect(Number(formGap)).toBeGreaterThanOrEqual(1);

	expect(ruleBody(css, '.topic')).toMatch(/display:\s*grid/);
	expect(ruleBody(css, '.vote-row')).not.toMatch(/margin-top:\s*-/);
	expect(css).toMatch(/\.note\s*\{[^}]*box-shadow:\s*0\s+var\(--note-shadow\)\s+0/);
	expect(css).toMatch(/\.note\.mine\s*\{[^}]*box-shadow:\s*0\s+var\(--note-shadow\)\s+0/);
});
