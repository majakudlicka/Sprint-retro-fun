<script lang="ts">
	import { untrack } from 'svelte';
	import { FORMATS } from '$lib/domain/formats';
	import { FORMAT_IDS } from '$lib/domain/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Checked unless this render is a failed submit where the facilitator opted out.
	let anonymous = $state(untrack(() => form?.anonymous !== false));
</script>

<svelte:head>
	<title>New retro · {data.teamName}</title>
</svelte:head>

<section class="narrow">
	<p class="eyebrow">{data.teamName}</p>
	<h1>Start a retro</h1>
	<p>You will facilitate this one. Pick the columns, the vote budget, and whether names stay hidden.</p>
	{#if form?.message}
		<p class="alert" role="alert">{form.message}</p>
	{/if}
	<form method="POST" class="stack">
		<label>
			Title
			<input name="title" maxlength="120" value={data.defaultTitle} placeholder="Sprint 42" />
		</label>
		<fieldset>
			<legend>Format</legend>
			<div class="formats">
				{#each FORMAT_IDS as id, index}
					<label class="format">
						<input type="radio" name="format" value={id} checked={index === 0} required />
						<span>
							<strong>{FORMATS[id].label}</strong>
							<small>{FORMATS[id].description}</small>
							<em>{FORMATS[id].columns.map((column) => column.label).join(' · ')}</em>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
		<label>
			Votes per person
			<select name="voteBudget">
				<option value="3">3</option>
				<option value="4">4</option>
				<option value="5" selected>5</option>
			</select>
		</label>
		<label class="check">
			<input type="hidden" name="anonymous" value="off" />
			<input type="checkbox" name="anonymous" value="on" bind:checked={anonymous} />
			Anonymous notes. Authors are stored, but other people never see who wrote what.
		</label>
		<button class="button" type="submit">Open the board</button>
	</form>
</section>
