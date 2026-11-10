/** @module LapaPreferences */
var LapaPreferences = (/**
 * Manage browser-local preferences and saved destinations.
 * @return {Object} Preferences API.
 * @memberOf module:LapaPreferences
 */
function () {

	"use strict";
	const __STRING_SETTINGS__ = "lapa.settings.v1";
	const __STRING_HISTORY__ = "lapa.history.v1";
	const __STRING_BOOKMARKS__ = "lapa.bookmarks.v1";
	const __EMPTY_STRING__ = "";
	const __STRING_DEFAULT_TITLE__ = document.title;

	/**
	 * Read JSON without making unavailable storage fatal to browsing.
	 * @param {string} key Storage key.
	 * @param {*} fallback Value for absent or corrupt data.
	 * @return {*} Stored data or fallback.
	 * @memberOf module:LapaPreferences
	 */
	function read (key, fallback) {

		try {
			const value = JSON.parse (localStorage.getItem (key));
			return value || fallback;
		} catch (error) {
			return fallback;
		}
	};

	/**
	 * Load only supported preference values.
	 * @return {Object} Settings.
	 * @memberOf module:LapaPreferences
	 */
	function load () {

		const saved = read (__STRING_SETTINGS__, {});
		return {
			transport: saved.transport === "epoxy" ? "epoxy" : "libcurl",
			wisp: typeof saved.wisp === "string" ? saved.wisp : __EMPTY_STRING__,
			title: typeof saved.title === "string" ? saved.title.slice (0, 80) : __EMPTY_STRING__,
			icon: saved.icon === "leaf" || saved.icon === "book" ? saved.icon : "default"
		};
	};

	/**
	 * Validate a custom endpoint and prevent insecure mixed-content connections.
	 * @param {string} value Wisp URL, or empty for this server.
	 * @return {string} Validated URL.
	 * @memberOf module:LapaPreferences
	 */
	function validateWisp (value) {

		value = value.trim ();
		if (value === __EMPTY_STRING__) return value;
		const parsed = new URL (value);
		if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") throw new Error ("Use a wss:// WebSocket URL.");
		if (location.protocol === "https:" && parsed.protocol !== "wss:") throw new Error ("HTTPS pages require a secure wss:// endpoint.");
		if (parsed.username || parsed.password || parsed.hash || parsed.search) throw new Error ("Use an endpoint without credentials, a query, or a fragment.");
		if (!parsed.pathname.endsWith ("/")) throw new Error ("The Wisp endpoint path must end with /.");
		return parsed.href;
	};

	/**
	 * Persist validated settings.
	 * @param {Object} settings New settings.
	 * @return {void}
	 * @memberOf module:LapaPreferences
	 */
	function save (settings) {

		settings.wisp = validateWisp (settings.wisp);
		localStorage.setItem (__STRING_SETTINGS__, JSON.stringify (settings));
	};

	/**
	 * Set tab identity on application pages.
	 * @return {void}
	 * @memberOf module:LapaPreferences
	 */
	function applyTab () {

		const settings = load ();
		document.title = settings.title || __STRING_DEFAULT_TITLE__;
		const icon = document.getElementById ("tab-icon");
		if (icon) icon.href = "/assets/" + settings.icon + ".svg";
	};

	/**
	 * Read a bounded list of HTTP destinations.
	 * @param {string} kind History or bookmarks.
	 * @return {Array} Valid destinations.
	 * @memberOf module:LapaPreferences
	 */
	function list (kind) {

		const saved = read (kind === "history" ? __STRING_HISTORY__ : __STRING_BOOKMARKS__, []);
		const result = [];
		if (!Array.isArray (saved)) return result;
		for (let index = 0; index < saved.length && result.length < 12; index++) {
			if (typeof saved[index] === "string" && /^https?:\/\//.test (saved[index])) result.push (saved[index]);
		}
		return result;
	};

	/**
	 * Add a destination, removing duplicates and bounding stored history.
	 * @param {string} kind History or bookmarks.
	 * @param {string} url Destination.
	 * @return {void}
	 * @memberOf module:LapaPreferences
	 */
	function remember (kind, url) {

		const previous = list (kind);
		const result = [url];
		for (let index = 0; index < previous.length && result.length < 12; index++) {
			if (previous[index] !== url) result.push (previous[index]);
		}
		localStorage.setItem (kind === "history" ? __STRING_HISTORY__ : __STRING_BOOKMARKS__, JSON.stringify (result));
	};

	/**
	 * Clear only lapa history or bookmarks, preserving other origin storage.
	 * @param {string} kind History or bookmarks.
	 * @return {void}
	 * @memberOf module:LapaPreferences
	 */
	function clear (kind) {

		localStorage.removeItem (kind === "history" ? __STRING_HISTORY__ : __STRING_BOOKMARKS__);
	};

	/**
	 * Open the application inside an about:blank tab without inline scripts.
	 * @return {void}
	 * @memberOf module:LapaPreferences
	 */
	function cloak () {

		const tab = window.open ("about:blank", "_blank");
		if (!tab) throw new Error ("Allow popups for this site to open a blank tab.");
		const settings = load ();
		tab.document.title = settings.title || "New tab";
		const icon = tab.document.createElement ("link");
		icon.rel = "icon";
		icon.href = location.origin + "/assets/" + settings.icon + ".svg";
		tab.document.head.appendChild (icon);
		const frame = tab.document.createElement ("iframe");
		frame.src = location.origin + "/";
		frame.title = "homework.education browser";
		frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;";
		tab.document.body.style.margin = "0";
		tab.document.body.appendChild (frame);
		tab.opener = undefined;
	};
	return { load: load, save: save, applyTab: applyTab, validateWisp: validateWisp, list: list, remember: remember, clear: clear, cloak: cloak };
} ());
