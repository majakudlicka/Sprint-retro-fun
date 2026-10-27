import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('shared form styles space fields and inset every select arrow', () => {
	const css = readFileSync('src/app.css', 'utf8');
	const formRule = css.match(/\nform\s*\{([^}]+)\}/)?.[1] ?? '';
	expect(formRule).toMatch(/display:\s*grid/);
	expect(formRule).toMatch(/gap:\s*1rem/);
	const stackRule = css.match(/\.stack\s*\{([^}]+)\}/)?.[1] ?? '';
	expect(stackRule).toMatch(/gap:\s*1rem/);
	const selectRule = css.match(/\nselect\s*\{([^}]+)\}/)?.[1] ?? '';
	expect(selectRule).toMatch(/appearance:\s*none/);
	expect(selectRule).toMatch(/padding-right:\s*2\.5rem/);
	expect(selectRule).toMatch(/background-position:\s*right\s+0\.85rem\s+center/);
});

test('new retros start anonymous and an unchecked box still opts out', () => {
	const page = readFileSync('src/routes/teams/[teamId]/retros/new/+page.svelte', 'utf8');
	expect(page).toContain('value="off"');
	expect(page).toContain('name="anonymous"');
	expect(page).toContain('bind:checked={anonymous}');
	expect(page).toContain('form?.anonymous !== false');
	const server = readFileSync('src/routes/teams/[teamId]/retros/new/+page.server.ts', 'utf8');
	expect(server).toContain('anonymousFromFormValues');
	expect(server).toContain("form.getAll('anonymous')");
	expect(server).not.toContain("form.get('anonymous') === 'on'");
});

test('the new retro title is prefilled and can be submitted blank', () => {
	const page = readFileSync('src/routes/teams/[teamId]/retros/new/+page.svelte', 'utf8');
	const input = page.match(/<input\b[^>]*\bname="title"[^>]*>/)?.[0] ?? '';
	expect(input).toContain('defaultTitle');
	expect(input).not.toContain('required');
	const server = readFileSync('src/routes/teams/[teamId]/retros/new/+page.server.ts', 'utf8');
	expect(server).toContain('defaultRetroTitle');
});
