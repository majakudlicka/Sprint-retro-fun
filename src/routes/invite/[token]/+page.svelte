<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Join {data.teamName} · Sprint retro fun</title>
</svelte:head>

<section class="narrow card-panel">
	<p class="eyebrow">Team invite</p>
	<h1>Join {data.teamName}?</h1>
	<p>You will be able to see this team's retros and add notes.</p>
	{#if form?.message}
		<p class="alert" role="alert">{form.message}</p>
	{/if}
	<form method="POST">
		<button class="button" type="submit">Join the team</button>
	</form>
</section>
