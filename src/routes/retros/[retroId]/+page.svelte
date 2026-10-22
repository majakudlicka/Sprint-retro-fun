<script lang="ts">
	import RetroBoard from '$lib/components/RetroBoard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

{#key data.retro.id}
	<RetroBoard initial={data.retro} />
{/key}
