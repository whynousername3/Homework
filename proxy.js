/** @module LapaProxy */
var LapaProxy = (/**
 * Adapt the two established proxy engines to the same transport and navigation API.
 * @return {Object} Proxy API.
 * @memberOf module:LapaProxy
 */
function () {

	"use strict";
	const __STRING_VENDOR__ = "/assets/vendor/";
	const __EMPTY_STRING__ = "";
	let connection;
	let controller;
	let engine;
	let preparation;
	let activeTransport;
	let allowlist;

	/**
	 * Turn a URL or a search phrase into an HTTP destination.
	 * @param {string} input User input.
	 * @return {string} Absolute destination.
	 * @memberOf module:LapaProxy
	 */
	function destination (input) {

		let value = input.trim ();
		if (value === __EMPTY_STRING__) throw new Error ("Enter a website or something to search for.");
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test (value) && !/^https?:\/\//i.test (value)) {
			throw new Error ("Only http:// and https:// websites can be opened.");
		}
		if (/^(javascript|data|file|about|mailto):/i.test (value)) throw new Error ("Enter an HTTP website or a search query.");
		if (!/^https?:\/\//i.test (value)) {
			if (/^(localhost|\[[a-f0-9:]+\]|[^\s/:]+\.[^\s/:]+)(:\d+)?([/?#][^\s]*)?$/i.test (value)) {
				value = "https://" + value;
			} else {
				return "https://www.google.com/search?q=" + encodeURIComponent (value);
			}
		}
		const url = new URL (value);
		if (url.username || url.password) throw new Error ("URLs containing usernames or passwords are not supported.");
		return url.href;
	};

	/**
	 * Check a destination against the server allowlist, loaded once per page.
	 * @param {string} url Absolute destination.
	 * @return {Promise<number>} 1 when the website may be opened.
	 * @memberOf module:LapaProxy
	 */
	async function allowed (url) {

		if (allowlist === undefined) {
			allowlist = fetch ("/allowlist.json", { cache: "no-store" }).then (readAllowlist).catch (keepAllowlist);
		}
		await allowlist;
		return LapaAllowlist.allows (url);
	};

	/**
	 * Apply a downloaded allowlist.
	 * @param {Response} response Allowlist response.
	 * @return {Promise<void>}
	 * @memberOf module:LapaProxy
	 */
	async function readAllowlist (response) {

		if (!response.ok) return;
		const body = await response.json ();
		LapaAllowlist.set (body.domains);
	};

	/**
	 * Keep the built-in allowlist when the server list is unavailable.
	 * @return {void}
	 * @memberOf module:LapaProxy
	 */
	function keepAllowlist () {

		// The built-in domains are always present.
	};

	/**
	 * Bound startup operations so failures appear in the page instead of hanging.
	 * @param {Promise} promise Pending operation.
	 * @param {string} message Timeout explanation.
	 * @return {Promise} Bounded operation.
	 * @memberOf module:LapaProxy
	 */
	async function withTimeout (promise, message) {

		let timer;
		/**
		 * Install the timeout rejection.
		 * @param {Function} resolve Promise resolver.
		 * @param {Function} reject Promise rejecter.
		 * @return {void}
		 * @memberOf module:LapaProxy
		 */
		function deadline (resolve, reject) {

			/**
			 * Report expiration.
			 * @return {void}
			 * @memberOf module:LapaProxy
			 */
			function expired () {

				reject (new Error (message));
			};
			timer = setTimeout (expired, 20000);
		};
		try {
			return await Promise.race ([promise, new Promise (deadline)]);
		} finally {
			clearTimeout (timer);
		}
	};

	/**
	 * Load a dependency before using its API, retrying once with a fresh URL.
	 * @param {string} source Same-origin script path.
	 * @param {Function} available Check the API exported by the script.
	 * @return {Promise<void>}
	 * @memberOf module:LapaProxy
	 */
	async function loadScript (source, available) {

		if (available ()) return;
		for (let attempt = 0; attempt < 2; attempt++) {
			const script = document.createElement ("script");
			script.src = attempt === 0 ? source : source + "?retry=" + Date.now ();
			try {
				await withTimeout (new Promise (function (resolve, reject) {

					script.onload = function () {

						if (available ()) resolve ();
						else reject (new Error ("Script did not provide its expected API: " + source));
					};
					script.onerror = function () {

						reject (new Error ("Could not download " + source));
					};
					document.head.appendChild (script);
				}), "Timed out loading " + source);
				return;
			} catch (error) {
				if (attempt === 1) {
					console.error ("Proxy startup failed:", error);
					throw new Error ("The browser engine could not load. Check your connection and reload the page. If this continues, try an up-to-date browser.");
				}
			} finally {
				script.onload = null;
				script.onerror = null;
				script.remove ();
			}
		}
	};

	/**
	 * Configure one compatible bare-mux transport without modifying its files.
	 * @param {string} transport Epoxy or libcurl.
	 * @param {string} endpoint Wisp WebSocket URL.
	 * @return {Promise<void>}
	 * @memberOf module:LapaProxy
	 */
	async function setTransport (transport, endpoint) {

		const options = transport === "epoxy" ? { wisp: endpoint } : { websocket: endpoint, transport: "wisp" };
		await withTimeout (connection.setTransport (__STRING_VENDOR__ + transport + "/index.mjs", [options]), "Transport startup timed out. Try another transport in Settings.");
		activeTransport = transport;
	};

	/**
	 * Wait for the requested worker to control this page, including engine swaps.
	 * @param {string} scriptUrl Expected service worker URL.
	 * @return {Promise<void>}
	 * @memberOf module:LapaProxy
	 */
	function controlledBy (scriptUrl) {

		/**
		 * Observe controller changes with a bounded lifetime.
		 * @param {Function} resolve Completion callback.
		 * @param {Function} reject Error callback.
		 * @return {void}
		 * @memberOf module:LapaProxy
		 */
		function observe (resolve, reject) {

			let timer;
			/**
			 * Finish once the expected controller has claimed this page.
			 * @return {void}
			 * @memberOf module:LapaProxy
			 */
			function changed () {

				const worker = navigator.serviceWorker.controller;
				if (worker && worker.scriptURL === scriptUrl) {
					clearTimeout (timer);
					navigator.serviceWorker.removeEventListener ("controllerchange", changed);
					resolve ();
				}
			};
			/**
			 * Remove the listener and report failed activation.
			 * @return {void}
			 * @memberOf module:LapaProxy
			 */
			function expired () {

				navigator.serviceWorker.removeEventListener ("controllerchange", changed);
				reject (new Error ("The proxy worker could not take control. Close other proxy tabs and reload."));
			};
			timer = setTimeout (expired, 20000);
			navigator.serviceWorker.addEventListener ("controllerchange", changed);
			changed ();
		};
		return new Promise (observe);
	};

	/**
	 * Initialize the engine, transport, and root-scope service worker.
	 * @return {Promise<string>} Active transport name.
	 * @memberOf module:LapaProxy
	 */
	async function initialize () {

		if (!window.isSecureContext || !("serviceWorker" in navigator)) throw new Error ("A trusted HTTPS connection is required to browse.");
		// shared-worker.js provides SharedWorker where the browser lacks it (Chrome on Android).
		if (!("SharedWorker" in window)) throw new Error ("This browser cannot run the proxy workers. Update your browser and try again.");
		if (!window.crossOriginIsolated) throw new Error ("Browser isolation is unavailable. Open this site directly over HTTPS.");
		const response = await fetch ("/config.json", { cache: "no-store" });
		if (!response.ok) throw new Error ("Could not load proxy configuration.");
		const config = await response.json ();
		engine = config.engine;
		if (engine === "scramjet") {
			await loadScript (__STRING_VENDOR__ + "scramjet/scramjet.all.js", function () {

				return typeof window.$scramjetLoadController === "function";
			});
			const api = window.$scramjetLoadController ();
			controller = new api.ScramjetController ({
				prefix: "/scramjet/",
				files: {
					wasm: __STRING_VENDOR__ + "scramjet/scramjet.wasm.wasm",
					all: __STRING_VENDOR__ + "scramjet/scramjet.all.js",
					sync: __STRING_VENDOR__ + "scramjet/scramjet.sync.js"
				}
			});
			await controller.init ();
		} else if (engine === "ultraviolet") {
			await loadScript (__STRING_VENDOR__ + "ultraviolet/uv.bundle.js", function () {

				return window.Ultraviolet && window.Ultraviolet.codec;
			});
			await loadScript ("/assets/js/uv-config.js", function () {

				return window.__uv$config && typeof window.__uv$config.encodeUrl === "function";
			});
		} else {
			throw new Error ("The configured proxy engine is not supported.");
		}
		await loadScript (__STRING_VENDOR__ + "bare-mux/index.js", function () {

			return window.BareMux && typeof window.BareMux.BareMuxConnection === "function";
		});
		const settings = LapaPreferences.load ();
		// The optional UV engine has an intermittent WebSocket failure with this
		// bare-mux Epoxy release. Use the verified compatibility transport for UV.
		const selectedTransport = engine === "ultraviolet" ? "libcurl" : settings.transport;
		const endpoint = LapaPreferences.validateWisp (settings.wisp) || (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/wisp/";
		connection = new BareMux.BareMuxConnection (__STRING_VENDOR__ + "bare-mux/worker.js");
		try {
			await setTransport (selectedTransport, endpoint);
		} catch (error) {
			if (selectedTransport !== "epoxy") throw error;
			await setTransport ("libcurl", endpoint);
		}
		const workerUrl = new URL ("/sw.js?engine=" + engine, location.origin).href;
		await navigator.serviceWorker.register (workerUrl, { scope: "/", updateViaCache: "none" });
		await withTimeout (navigator.serviceWorker.ready, "Service worker activation timed out. Reload this page.");
		await controlledBy (workerUrl);
		return activeTransport;
	};

	/**
	 * Reuse an in-flight setup and permit a deliberate retry after failure.
	 * @return {Promise<string>} Active transport name.
	 * @memberOf module:LapaProxy
	 */
	async function prepare () {

		if (preparation === undefined) preparation = initialize ();
		try {
			return await preparation;
		} catch (error) {
			preparation = undefined;
			throw error;
		}
	};

	/**
	 * Let the selected library encode the destination; no custom URL rewriting.
	 * @param {string} url Validated destination.
	 * @return {string} Service-worker path.
	 * @memberOf module:LapaProxy
	 */
	function encode (url) {

		if (engine === "scramjet") return controller.encodeUrl (url);
		return self.__uv$config.prefix + self.__uv$config.encodeUrl (url);
	};

	/**
	 * Read a frame location using the active library's decoder.
	 * @param {string} url Frame location.
	 * @return {string} Destination URL.
	 * @memberOf module:LapaProxy
	 */
	function decode (url) {

		const parsed = new URL (url);
		if (parsed.origin !== location.origin) return parsed.href;
		if (engine === "scramjet") return controller.decodeUrl (parsed.href);
		return self.__uv$config.decodeUrl (parsed.href.slice ((location.origin + self.__uv$config.prefix).length));
	};

	/**
	 * Open the persistent browsing shell for the chosen destination.
	 * @param {string} input User input.
	 * @return {Promise<void>}
	 * @memberOf module:LapaProxy
	 */
	async function navigate (input) {

		const url = destination (input);
		try {
			if (await allowed (url)) LapaPreferences.remember ("history", url);
		} catch (error) {
			// Browsing still works when browser-local storage is unavailable.
		}
		location.assign ("/browse.html#" + encodeURIComponent (url));
	};
	return { destination: destination, allowed: allowed, prepare: prepare, navigate: navigate, encode: encode, decode: decode };
} ());
