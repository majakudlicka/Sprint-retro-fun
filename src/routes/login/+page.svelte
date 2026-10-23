<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Sign in · Sprint retro fun</title>
</svelte:head>

<section class="narrow card-panel">
	<p class="eyebrow">Welcome in</p>
	<h1>Sign in with Google</h1>
	<p>Retros are private to your team. There is no guest access.</p>
	{#if data.error}
		<p class="alert" role="alert">{data.error}</p>
	{/if}
	<form method="POST">
		<input type="hidden" name="providerId" value="google" />
		<input type="hidden" name="redirectTo" value="/teams" />
		<button class="button" type="submit">Continue with Google</button>
	</form>
</section>
