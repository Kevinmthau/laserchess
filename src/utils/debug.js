const ERROR_STORAGE_KEY = "laserChess:lastClientError";
const SNAPSHOT_STORAGE_PREFIX = "laserChess:";

const getDebugRoot = () => {
	if (typeof window === "undefined") {
		return null;
	}

	window.__laserChessDebug = window.__laserChessDebug || {};
	return window.__laserChessDebug;
};

const normalizeValue = (value) => {
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack
		};
	}

	if (Array.isArray(value)) {
		return value.map(normalizeValue);
	}

	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entryValue]) => [key, normalizeValue(entryValue)])
		);
	}

	return value;
};

export const setDebugSnapshot = (key, value) => {
	const normalizedValue = normalizeValue(value);
	const debugRoot = getDebugRoot();
	if (debugRoot) {
		debugRoot[key] = normalizedValue;
	}

	if (typeof sessionStorage !== "undefined") {
		try {
			sessionStorage.setItem(`${SNAPSHOT_STORAGE_PREFIX}${key}`, JSON.stringify(normalizedValue));
		} catch (error) {
			// Best effort only.
		}
	}

	return normalizedValue;
};

export const recordClientError = (event, details = {}) => {
	const payload = {
		timestamp: new Date().toISOString(),
		event,
		details: normalizeValue(details)
	};

	const debugRoot = getDebugRoot();
	if (debugRoot) {
		debugRoot.lastClientError = payload;
		debugRoot.clientErrors = [...(debugRoot.clientErrors || []).slice(-9), payload];
	}

	if (typeof sessionStorage !== "undefined") {
		try {
			sessionStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(payload));
		} catch (error) {
			// Best effort only.
		}
	}

	return payload;
};

export const installGlobalErrorLogging = () => {
	if (typeof window === "undefined" || window.__laserChessGlobalErrorLoggingInstalled) {
		return;
	}

	window.__laserChessGlobalErrorLoggingInstalled = true;

	window.addEventListener("error", (event) => {
		recordClientError("window-error", {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
			error: event.error
		});
	});

	window.addEventListener("unhandledrejection", (event) => {
		recordClientError("unhandled-rejection", {
			reason: event.reason
		});
	});
};
