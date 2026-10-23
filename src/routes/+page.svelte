<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Sprint retro fun</title>
</svelte:head>

<section class="hero">
	<p class="eyebrow">Self-hosted retros</p>
	<h1>Write it down. Hide it until everyone's done. Then vote like you mean it.</h1>
	<p class="lede">
		A small retrospective board for one team at a time: sticky notes, groups, a vote budget, and action
		items that show up at the start of the next sprint.
	</p>
	<div class="row">
		{#if data.user}
			<a class="button" href="/teams">Open your teams</a>
		{:else}
			<a class="button" href="/login">Continue with Google</a>
			{#if data.devLogin}
				<a class="button ghost" href="/dev/login">Local sign-in</a>
			{/if}
		{/if}
	</div>
	<ol class="steps">
		<li><strong>Write</strong><span>Notes stay private until the facilitator moves on.</span></li>
		<li><strong>Group</strong><span>Drag similar notes together and name the pile.</span></li>
		<li><strong>Vote</strong><span>A few votes each. Stack them if something really matters.</span></li>
		<li><strong>Discuss</strong><span>The loudest votes go first.</span></li>
		<li><strong>Act</strong><span>Owners, dates, and leftovers from last time.</span></li>
	</ol>
</section>
