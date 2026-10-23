type Listener = (retroId: string) => void;

type Hub = Map<string, Set<Listener>>;

const KEY = Symbol.for('sprint-retro-fun.hub');

function hub(): Hub {
	const g = globalThis as unknown as Record<symbol, Hub>;
	if (!g[KEY]) g[KEY] = new Map();
	return g[KEY];
}

export function subscribe(retroId: string, listener: Listener): () => void {
	const rooms = hub();
	const set = rooms.get(retroId) ?? new Set();
	set.add(listener);
	rooms.set(retroId, set);
	return () => {
		set.delete(listener);
		if (set.size === 0) rooms.delete(retroId);
	};
}

export function publish(retroId: string) {
	const listeners = hub().get(retroId);
	if (!listeners) return;
	for (const listener of listeners) listener(retroId);
}
