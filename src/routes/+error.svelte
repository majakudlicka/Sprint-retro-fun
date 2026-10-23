<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · Sprint retro fun</title>
</svelte:head>

<section class="narrow">
	<p class="eyebrow">Something snagged</p>
	<h1>{page.status}</h1>
	<p>{page.error?.message ?? 'That page is not available.'}</p>
	<p><a class="button" href="/teams">Back to teams</a></p>
</section>
