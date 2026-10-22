<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<div class="shell">
	<header class="topbar">
		<a class="brand" href={data.user ? '/teams' : '/'}>
			<span class="mark" aria-hidden="true"></span>
			<span>Sprint <em>retro</em> fun</span>
		</a>
		{#if data.user}
			<div class="who">
				<span class="who-name">{data.user.name}</span>
				<form method="POST" action="/signout">
					<input type="hidden" name="redirectTo" value="/" />
					<button class="ghost" type="submit">Sign out</button>
				</form>
			</div>
		{/if}
	</header>
	<main>
		{@render children()}
	</main>
</div>
