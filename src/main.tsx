import { createRoot } from "react-dom/client";

import "./index.css";

import { StrictMode } from "react";

import App from "./App.tsx";

async function registerServiceWorker() {
	if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
		return;
	}

	try {
		await navigator.serviceWorker.register("/sw.js");
	} catch (error) {
		console.error("Service worker registration failed", error);
	}
}

void registerServiceWorker();

const root = document.getElementById("root");

if (!root) {
	throw new Error("Root element not found");
}
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
