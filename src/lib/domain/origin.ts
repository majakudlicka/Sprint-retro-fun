export function normalizeOrigin(value: string): string | null {
	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

/**
 * Browsers send Origin on POST and WebSocket handshakes.
 * Allow the configured public origin, or an Origin whose host matches the request Host.
 */
export function requestOriginAllowed(
	originHeader: string | null,
	requestHost: string | undefined,
	configuredOrigin: string | undefined
): boolean {
	if (!originHeader) return false;
	const origin = normalizeOrigin(originHeader);
	if (!origin) return false;
	if (configuredOrigin) {
		const configured = normalizeOrigin(configuredOrigin);
		if (configured && origin === configured) return true;
	}
	if (!requestHost) return false;
	try {
		return new URL(origin).host === requestHost;
	} catch {
		return false;
	}
}
