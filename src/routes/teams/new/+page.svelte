<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>New team · Sprint retro fun</title>
</svelte:head>

<section class="narrow card-panel">
	<p class="eyebrow">New team</p>
	<h1>Name the crew</h1>
	{#if form?.message}
		<p class="alert" role="alert">{form.message}</p>
	{/if}
	<form method="POST">
		<label>
			Team name
			<input name="name" maxlength="80" required placeholder="Platform squad" />
		</label>
		<button class="button" type="submit">Create team</button>
	</form>
</section>
