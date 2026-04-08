const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `cadence-app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `cadence-runtime-${CACHE_VERSION}`;
const APP_SHELL_ASSETS = [
	"/",
	"/manifest.webmanifest",
	"/favicon.svg",
	"/icons.svg",
	"/apple-touch-icon.png",
	"/pwa-192.png",
	"/pwa-512.png",
];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(APP_SHELL_CACHE)
			.then((cache) => cache.addAll(APP_SHELL_ASSETS)),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			await Promise.all(
				cacheNames
					.filter(
						(cacheName) =>
							cacheName !== APP_SHELL_CACHE && cacheName !== RUNTIME_CACHE,
					)
					.map((cacheName) => caches.delete(cacheName)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;

	if (request.method !== "GET") {
		return;
	}

	const url = new URL(request.url);

	if (url.origin !== self.location.origin) {
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(handleNavigationRequest(request));
		return;
	}

	if (
		["font", "image", "script", "style", "worker"].includes(request.destination)
	) {
		event.respondWith(staleWhileRevalidate(request));
	}
});

async function handleNavigationRequest(request) {
	try {
		const response = await fetch(request);
		const cache = await caches.open(RUNTIME_CACHE);
		cache.put(request, response.clone());
		return response;
	} catch {
		const cachedResponse = await caches.match(request);

		if (cachedResponse) {
			return cachedResponse;
		}

		return caches.match("/");
	}
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(RUNTIME_CACHE);
	const cachedResponse = await cache.match(request);
	const networkResponsePromise = fetch(request)
		.then((response) => {
			cache.put(request, response.clone());
			return response;
		})
		.catch(() => null);

	if (cachedResponse) {
		void networkResponsePromise;
		return cachedResponse;
	}

	const networkResponse = await networkResponsePromise;

	if (networkResponse) {
		return networkResponse;
	}

	return caches.match(request);
}
