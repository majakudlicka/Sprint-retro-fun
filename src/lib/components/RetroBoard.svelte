<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { PHASE_HINTS, PHASE_LABELS, nextPhase, phaseIndex } from '$lib/domain/phases';
	import { PHASES, type PresentedCard, type RetroView, type Topic } from '$lib/domain/types';

	let { initial }: { initial: RetroView } = $props();
	let retro = $state(untrack(() => initial));
	let errorMessage = $state('');
	let live = $state(false);
	let drafts = $state<Record<string, string>>({});
	let editing = $state<string | null>(null);
	let editText = $state('');
	let dragId = $state<string | null>(null);
	let overId = $state<string | null>(null);
	let groupDrafts = $state<Record<string, string>>({});
	let actionText = $state('');
	let ownerId = $state('');
	let dueDate = $state('');
	let link = $state('');

	const upcoming = $derived(nextPhase(retro.phase));
	const showOrder = $derived(retro.phase === 'discuss' || retro.phase === 'actions' || retro.phase === 'closed');
	const showVotes = $derived(phaseIndex(retro.phase) >= phaseIndex('vote'));

	onMount(() => {
		let socket: WebSocket | null = null;
		let stopped = false;
		let attempt = 0;
		const connect = () => {
			if (stopped) return;
			const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
			socket = new WebSocket(`${protocol}//${location.host}/ws`);
			socket.onopen = () => {
				attempt = 0;
				live = true;
				socket?.send(JSON.stringify({ type: 'subscribe', retroId: retro.id }));
			};
			socket.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as { type?: string; retro?: RetroView; message?: string };
					if (message.type === 'state' && message.retro) retro = message.retro;
					if (message.type === 'error' && message.message) errorMessage = message.message;
				} catch {
					errorMessage = 'Live update was unreadable.';
				}
			};
			socket.onclose = () => {
				live = false;
				if (stopped) return;
				attempt += 1;
				setTimeout(connect, Math.min(4000, 300 * attempt));
			};
		};
		connect();
		return () => {
			stopped = true;
			socket?.close();
		};
	});

	async function command(body: Record<string, unknown>) {
		errorMessage = '';
		try {
			const response = await fetch(`/api/retros/${retro.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify(body)
			});
			const payload = (await response.json()) as { retro?: RetroView; error?: string };
			if (!response.ok || !payload.retro) {
				errorMessage = payload.error ?? 'Something went wrong';
				return;
			}
			retro = payload.retro;
		} catch {
			errorMessage = 'Network problem. Try again.';
		}
	}

	function addNote(columnKey: string) {
		const text = (drafts[columnKey] ?? '').trim();
		if (!text) return;
		drafts[columnKey] = '';
		void command({ type: 'add-card', columnKey, text });
	}

	function onNoteKey(event: KeyboardEvent, columnKey: string) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			addNote(columnKey);
		}
	}

	function startDrag(event: DragEvent, cardId: string) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('button, input, textarea, select, a')) {
			event.preventDefault();
			return;
		}
		dragId = cardId;
		event.dataTransfer?.setData('text/plain', cardId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function dropOnCard(event: DragEvent, targetId: string) {
		event.preventDefault();
		event.stopPropagation();
		overId = null;
		const source = event.dataTransfer?.getData('text/plain') || dragId;
		dragId = null;
		if (!source || source === targetId) return;
		void command({ type: 'group-cards', sourceCardId: source, targetCardId: targetId });
	}

	function dropOnGroup(event: DragEvent, groupId: string) {
		event.preventDefault();
		overId = null;
		const source = event.dataTransfer?.getData('text/plain') || dragId;
		dragId = null;
		if (!source) return;
		void command({ type: 'move-to-group', cardId: source, groupId });
	}

	function groupWith(cardId: string, value: string) {
		if (!value) return;
		if (value.startsWith('group:')) {
			void command({ type: 'move-to-group', cardId, groupId: value.slice(6) });
			return;
		}
		void command({ type: 'group-cards', sourceCardId: cardId, targetCardId: value });
	}

	async function addAction(event: SubmitEvent) {
		event.preventDefault();
		const text = actionText.trim();
		if (!text) return;
		const [kind, id] = link.split(':');
		await command({
			type: 'add-action',
			text,
			ownerId: ownerId || null,
			dueDate: dueDate || null,
			cardId: kind === 'card' ? id : null,
			groupId: kind === 'group' ? id : null
		});
		if (!errorMessage) {
			actionText = '';
			link = '';
			dueDate = '';
		}
	}

	function topicChoices(columnKey: string, cardId: string) {
		const column = retro.columns.find((item) => item.key === columnKey);
		const choices: { value: string; label: string }[] = [];
		for (const topic of column?.topics ?? []) {
			if (topic.kind === 'group') {
				const contains = topic.cards.some((card) => card.id === cardId);
				if (!contains) choices.push({ value: `group:${topic.id}`, label: topic.name?.trim() || 'Untitled group' });
			} else if (topic.id !== cardId && !topic.cards[0]?.hidden) {
				choices.push({ value: topic.id, label: topic.cards[0]?.text ?? 'Note' });
			}
		}
		return choices;
	}
</script>

<svelte:head>
	<title>{retro.title} · Sprint retro fun</title>
</svelte:head>

<section class="board" data-phase={retro.phase}>
	<header class="board-head">
		<div>
			<p class="eyebrow"><a href={`/teams/${retro.teamId}`}>{retro.teamName}</a></p>
			<h1>{retro.title}</h1>
			<p class="muted">{PHASE_HINTS[retro.phase]}</p>
		</div>
		<div class="board-meta">
			<p class="live" class:on={live}>{live ? 'Live' : 'Reconnecting…'}</p>
			<p>
				Facilitator {retro.facilitatorName}
				{#if retro.anonymous} · names hidden{/if}
			</p>
			{#if retro.phase === 'vote'}
				<p><strong>{retro.votesRemaining}</strong> votes left of {retro.voteBudget}</p>
			{/if}
			{#if retro.isFacilitator && upcoming}
				<button class="button" type="button" onclick={() => command({ type: 'advance-phase' })}>
					Move to {PHASE_LABELS[upcoming]}
				</button>
			{:else if upcoming}
				<p class="muted">Waiting for {retro.facilitatorName} to start {PHASE_LABELS[upcoming]}.</p>
			{/if}
		</div>
	</header>

	<ol class="phase-track">
		{#each PHASES as phase, index}
			<li class:current={phase === retro.phase} class:done={index < phaseIndex(retro.phase)}>
				{PHASE_LABELS[phase]}
			</li>
		{/each}
	</ol>

	{#if errorMessage}
		<p class="alert" role="alert">{errorMessage}</p>
	{/if}

	{#if retro.previousActions.length > 0}
		<section class="carry">
			<h2>Still open from earlier retros</h2>
			<ul>
				{#each retro.previousActions as action}
					<li>
						<span>
							{action.text}
							<small>
								{action.retroTitle}
								{#if action.ownerName} · {action.ownerName}{/if}
								{#if action.dueDate} · due {action.dueDate}{/if}
							</small>
						</span>
						<button class="ghost" type="button" onclick={() => command({ type: 'set-action-status', actionId: action.id, status: 'done' })}>
							Done
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if showOrder}
		<section class="order">
			<h2>Discussion order</h2>
			{#if retro.discussionOrder.length === 0}
				<p class="muted">No notes to talk through.</p>
			{:else}
				<ol>
					{#each retro.discussionOrder as item, index}
						<li>
							<span class="rank">{index + 1}</span>
							<span>
								<strong>{item.label}</strong>
								<small>{item.columnLabel} · {item.voteCount} {item.voteCount === 1 ? 'vote' : 'votes'}</small>
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	{/if}

	<div class="columns">
		{#each retro.columns as column}
			<section class="column tone-{column.tone}" data-column={column.key}>
				<header>
					<h2>{column.label}</h2>
					<p>{column.hint}</p>
				</header>
				{#if retro.phase === 'write'}
					<form
						onsubmit={(event) => {
							event.preventDefault();
							addNote(column.key);
						}}
					>
						<label class="sr" for={`note-${column.key}`}>Add a {column.label} note</label>
						<textarea
							id={`note-${column.key}`}
							maxlength="2000"
							placeholder={column.hint}
							value={drafts[column.key] ?? ''}
							oninput={(event) => {
								drafts[column.key] = event.currentTarget.value;
							}}
							onkeydown={(event) => onNoteKey(event, column.key)}
						></textarea>
						<button class="button" type="submit">Add note</button>
					</form>
				{/if}
				<div class="topics">
					{#each column.topics as topic (topic.id)}
						{@render topicBlock(topic, column.key)}
					{/each}
					{#if column.topics.length === 0 && retro.phase !== 'write'}
						<p class="muted empty-col">Nothing here.</p>
					{/if}
				</div>
			</section>
		{/each}
	</div>

	{#if retro.phase === 'actions' || retro.phase === 'closed'}
		<section class="actions-panel">
			<h2>Action items</h2>
			{#if retro.phase === 'actions'}
				<form class="stack action-form" onsubmit={addAction}>
					<label>
						What will we do?
						<textarea bind:value={actionText} maxlength="2000" required></textarea>
					</label>
					<div class="action-grid">
						<label>
							Owner
							<select bind:value={ownerId}>
								<option value="">Unassigned</option>
								{#each retro.members as member}
									<option value={member.id}>{member.name}</option>
								{/each}
							</select>
						</label>
						<label>
							Due date
							<input type="date" bind:value={dueDate} />
						</label>
						<label>
							Link
							<select bind:value={link}>
								<option value="">No link</option>
								{#each retro.discussionOrder as item}
									<option value={`${item.kind}:${item.topicId}`}>{item.columnLabel}: {item.label}</option>
								{/each}
							</select>
						</label>
					</div>
					<button class="button" type="submit">Add action</button>
				</form>
			{/if}
			<ul class="action-list">
				{#each retro.actions as action}
					<li class:done={action.status === 'done'}>
						<div>
							<strong>{action.text}</strong>
							<small>
								{#if action.ownerName}{action.ownerName}{:else}Unassigned{/if}
								{#if action.dueDate} · due {action.dueDate}{/if}
								{#if action.linkLabel} · {action.linkLabel}{/if}
							</small>
						</div>
						<button
							class="ghost"
							type="button"
							onclick={() =>
								command({
									type: 'set-action-status',
									actionId: action.id,
									status: action.status === 'done' ? 'open' : 'done'
								})}
						>
							{action.status === 'done' ? 'Reopen' : 'Done'}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

{#snippet topicBlock(topic: Topic, columnKey: string)}
	<article
		class="topic"
		class:group={topic.kind === 'group'}
		class:over={overId === topic.id}
		ondragover={(event) => {
			if (retro.phase !== 'group') return;
			event.preventDefault();
			overId = topic.id;
		}}
		ondragleave={() => {
			if (overId === topic.id) overId = null;
		}}
		ondrop={(event) => {
			if (topic.kind === 'group') dropOnGroup(event, topic.id);
		}}
	>
		{#if topic.kind === 'group'}
			<header class="group-head">
				{#if retro.phase === 'group'}
					<input
						aria-label="Group name"
						maxlength="80"
						placeholder="Name this group"
						value={groupDrafts[topic.id] ?? topic.name ?? ''}
						oninput={(event) => {
							groupDrafts[topic.id] = event.currentTarget.value;
						}}
					/>
					<button
						class="ghost"
						type="button"
						onclick={() =>
							command({
								type: 'rename-group',
								groupId: topic.id,
								name: groupDrafts[topic.id] ?? topic.name ?? ''
							})}
					>
						Save name
					</button>
				{:else}
					<h3>{topic.name?.trim() || 'Untitled group'}</h3>
				{/if}
			</header>
		{/if}
		{#each topic.cards as card (card.id)}
			{@render note(card, topic, columnKey)}
		{/each}
		{#if showVotes}
			<div class="vote-row">
				{#if retro.phase === 'vote'}
					<button
						type="button"
						class="vote"
						disabled={topic.myVotes === 0}
						onclick={() => command({ type: 'remove-vote', targetType: topic.kind, targetId: topic.id })}
						aria-label="Remove a vote"
					>
						−
					</button>
				{/if}
				<strong>{topic.voteCount}</strong>
				<span>{topic.voteCount === 1 ? 'vote' : 'votes'}</span>
				{#if topic.myVotes > 0}<span class="mine-votes">you {topic.myVotes}</span>{/if}
				{#if retro.phase === 'vote'}
					<button
						type="button"
						class="vote"
						disabled={retro.votesRemaining === 0}
						onclick={() => command({ type: 'add-vote', targetType: topic.kind, targetId: topic.id })}
						aria-label="Add a vote"
					>
						+
					</button>
				{/if}
			</div>
		{/if}
	</article>
{/snippet}

{#snippet note(card: PresentedCard, topic: Topic, columnKey: string)}
	{#if card.hidden}
		<div class="note hidden" aria-label="Hidden note">
			<span>Hidden until grouping</span>
		</div>
	{:else}
		<div
			class="note"
			role="group"
			class:mine={card.mine}
			class:over={overId === card.id}
			draggable={retro.phase === 'group'}
			ondragstart={(event) => startDrag(event, card.id)}
			ondragover={(event) => {
				if (retro.phase !== 'group') return;
				event.preventDefault();
				overId = card.id;
			}}
			ondrop={(event) => dropOnCard(event, card.id)}
		>
			{#if editing === card.id}
				<form
					onsubmit={(event) => {
						event.preventDefault();
						const text = editText.trim();
						if (!text) return;
						editing = null;
						void command({ type: 'edit-card', cardId: card.id, text });
					}}
				>
					<textarea bind:value={editText} maxlength="2000"></textarea>
					<div class="row">
						<button class="button" type="submit">Save</button>
						<button class="ghost" type="button" onclick={() => (editing = null)}>Cancel</button>
					</div>
				</form>
			{:else}
				<p>{card.text}</p>
				<footer>
					{#if card.authorName}
						<span>{card.mine ? 'You' : card.authorName}</span>
					{:else if card.mine}
						<span>You</span>
					{/if}
					{#if retro.phase === 'write' && card.mine}
						<button
							class="texty"
							type="button"
							onclick={() => {
								editing = card.id;
								editText = card.text ?? '';
							}}>Edit</button
						>
						<button class="texty" type="button" onclick={() => command({ type: 'delete-card', cardId: card.id })}
							>Delete</button
						>
					{/if}
					{#if retro.phase === 'group' && topic.kind === 'group'}
						<button class="texty" type="button" onclick={() => command({ type: 'ungroup-card', cardId: card.id })}
							>Remove from group</button
						>
					{/if}
				</footer>
				{#if retro.phase === 'group'}
					<label class="mini">
						Group with
						<select
							onchange={(event) => {
								const value = event.currentTarget.value;
								event.currentTarget.value = '';
								groupWith(card.id, value);
							}}
						>
							<option value="">Choose…</option>
							{#each topicChoices(columnKey, card.id) as choice}
								<option value={choice.value}>{choice.label}</option>
							{/each}
						</select>
					</label>
				{/if}
			{/if}
		</div>
	{/if}
{/snippet}
