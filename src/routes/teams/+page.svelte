<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Teams · Sprint retro fun</title>
</svelte:head>

<section class="page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Your teams</p>
			<h1>Where should we retro?</h1>
		</div>
		<a class="button" href="/teams/new">New team</a>
	</div>
	{#if data.teams.length === 0}
		<div class="card-panel empty">
			<h2>No teams yet</h2>
			<p>A retro belongs to a team. Create one, then invite the people who just finished the sprint.</p>
			<a class="button" href="/teams/new">Create a team</a>
		</div>
	{:else}
		<ul class="team-grid">
			{#each data.teams as team}
				<li>
					<a href={`/teams/${team.id}`}>
						<strong>{team.name}</strong>
						<span>{team.role === 'owner' ? 'Owner' : 'Member'}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
