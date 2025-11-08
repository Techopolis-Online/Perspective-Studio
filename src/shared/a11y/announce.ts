export type PolitenessSetting = 'polite' | 'assertive';

let region: HTMLDivElement | null = null;

function ensureRegion(politeness: PolitenessSetting = 'polite'): HTMLDivElement {
	// Prefer an existing region in the DOM if present (e.g., rendered by App)
	if (!region) {
		const existing = document.getElementById('app-sr-status') as HTMLDivElement | null;
		if (existing) {
			region = existing;
		}
	}
	if (region && document.body.contains(region)) {
		region.setAttribute('aria-live', politeness);
		return region;
	}
	const el = document.createElement('div');
	el.id = 'app-sr-status';
	el.className = 'sr-only';
	el.setAttribute('role', 'status');
	el.setAttribute('aria-live', politeness);
	el.setAttribute('aria-atomic', 'true');
	document.body.appendChild(el);
	region = el;
	return el;
}

export function announce(message: string, politeness: PolitenessSetting = 'polite'): void {
	const el = ensureRegion(politeness);
	// Clear then set to force screen readers to re-announce identical messages
	el.textContent = '';
	// Using a microtask ensures DOM updated state before setting text
	Promise.resolve().then(() => {
		el.textContent = message;
	});
}


