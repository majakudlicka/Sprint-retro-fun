<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	const team = $derived(data.team);
</script>

<svelte:head>
	<title>{team.name} · Sprint retro fun</title>
</svelte:head>

<section class="page">
	<div class="page-head">
		<div>
			<p class="eyebrow">Team</p>
			<h1>{team.name}</h1>
		</div>
		<a class="button" href={`/teams/${team.id}/retros/new`}>New retro</a>
	</div>
	{#if form?.message}
		<p class="flash" role="status">{form.message}</p>
	{/if}
	{#if form?.inviteUrl}
		<p class="invite-url">
			Invite link
			<code>{form.inviteUrl}</code>
		</p>
	{/if}

	<div class="split">
		<div>
			<h2>Retros</h2>
			{#if team.retros.length === 0}
				<p class="muted">No retros yet. The facilitator is whoever creates one.</p>
			{:else}
				<ul class="retro-list">
					{#each team.retros as retro}
						<li>
							<a href={`/retros/${retro.id}`}>
								<strong>{retro.title}</strong>
								<span class="pill">{data.phaseLabels[retro.phase]}</span>
							</a>
							<small>
								{retro.facilitatorName} facilitates
								{#if retro.anonymous} · anonymous{/if}
							</small>
						</li>
					{/each}
				</ul>
			{/if}

			<h2>Open actions</h2>
			{#if team.openActions.length === 0}
				<p class="muted">Nothing open. That is either great, or you have not retrospected yet.</p>
			{:else}
				<ul class="action-list">
					{#each team.openActions as action}
						<li>
							<div>
								<strong>{action.text}</strong>
								<small>
									{action.retroTitle}
									{#if action.ownerName} · {action.ownerName}{/if}
									{#if action.dueDate} · due {action.dueDate}{/if}
								</small>
							</div>
							<form method="POST" action="?/actionStatus">
								<input type="hidden" name="actionId" value={action.id} />
								<input type="hidden" name="status" value="done" />
								<button class="ghost" type="submit">Done</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<aside class="card-panel side">
			<h2>People</h2>
			<ul class="people">
				{#each team.members as member}
					<li>
						<span>{member.name} <small>{member.role}</small></span>
						{#if team.role === 'owner' && member.id !== data.user?.id}
							<form method="POST" action="?/remove">
								<input type="hidden" name="userId" value={member.id} />
								<button class="texty" type="submit">Remove</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>

			<h2>Invite</h2>
			<form method="POST" action="?/invite">
				<button class="button" type="submit">Create invite link</button>
			</form>
			{#if team.invites.length > 0}
				<ul class="invite-list">
					{#each team.invites as invite}
						<li>
							<span>Expires {invite.expiresAt.slice(0, 10)}</span>
							<form method="POST" action="?/revoke">
								<input type="hidden" name="inviteId" value={invite.id} />
								<button class="texty" type="submit">Revoke</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<form method="POST" action="?/email" class="stack">
				<label>
					Add by email
					<input name="email" type="email" required placeholder="teammate@company.com" />
				</label>
				<button class="ghost" type="submit">Add</button>
			</form>
		</aside>
	</div>
</section>
