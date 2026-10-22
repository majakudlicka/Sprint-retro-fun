<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Local sign-in · Sprint retro fun</title>
</svelte:head>

<section class="narrow card-panel">
	<p class="eyebrow">Development only</p>
	<h1>Local sign-in</h1>
	<p>This exists for `vite dev` on localhost when a dev secret is set. Production builds do not honor it.</p>
	{#if form?.message}
		<p class="alert" role="alert">{form.message}</p>
	{/if}
	<form method="POST" class="stack">
		<label>
			Secret
			<input name="secret" type="password" required autocomplete="off" />
		</label>
		<label>
			Name
			<input name="name" required maxlength="120" placeholder="Alex" />
		</label>
		<label>
			Email
			<input name="email" type="email" required placeholder="alex@example.com" />
		</label>
		<button class="button" type="submit">Sign in locally</button>
	</form>
</section>
