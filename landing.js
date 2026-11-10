/** @module LapaLanding */
var LapaLanding = (/**
 * Connect the landing page to the proxy without inline event handlers.
 * @return {Object} Landing API.
 * @memberOf module:LapaLanding
 */
function () {

	"use strict";
	const input = document.getElementById ("destination");
	const status = document.getElementById ("status");
	const button = document.getElementById ("go");
	const __EMPTY_STRING__ = "";
	let navigating = 0;

	/**
	 * Show accessible status text.
	 * @param {string} message Status text.
	 * @param {number} failed Error indicator.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function notify (message, failed) {

		status.textContent = message;
		status.classList.toggle ("error", Boolean (failed));
	};

	/**
	 * Begin navigation and allow retry after a failed initialization.
	 * @param {string} value Address or search.
	 * @return {Promise<void>}
	 * @memberOf module:LapaLanding
	 */
	async function browse (value) {

		if (navigating) return;
		navigating = 1;
		button.disabled = true;
		notify ("Getting your next page ready...", 0);
		try {
			await LapaProxy.navigate (value);
		} catch (error) {
			notify (error.message, 1);
			button.disabled = false;
			navigating = 0;
		}
	};

	/**
	 * Submit the search form.
	 * @param {Event} event Submit event.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function submit (event) {

		event.preventDefault ();
		browse (input.value);
	};

	/**
	 * Handle shortcut buttons through DOM event delegation.
	 * @param {MouseEvent} event Click event.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function shortcut (event) {

		const target = event.target.closest ("button[data-url]");
		if (target) browse (target.dataset.url);
	};

	/**
	 * Draw stored destinations using text nodes rather than HTML strings.
	 * @param {string} kind List kind.
	 * @param {string} sectionId Containing section.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function draw (kind, sectionId) {

		const entries = LapaPreferences.list (kind);
		const container = document.getElementById (kind);
		container.replaceChildren ();
		for (let index = 0; index < entries.length; index++) {
			try {
				const url = new URL (entries[index]);
				const chip = document.createElement ("button");
				chip.className = "destination-chip";
				chip.type = "button";
				chip.dataset.url = url.href;
				chip.title = url.href;
				chip.textContent = url.hostname + (url.pathname === "/" ? __EMPTY_STRING__ : url.pathname);
				container.appendChild (chip);
			} catch (error) {
				// Ignore malformed destinations from manually edited browser storage.
			}
		}
		document.getElementById (sectionId).hidden = container.childElementCount === 0;
	};

	/**
	 * Save the currently entered destination.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function bookmark () {

		try {
			const url = LapaProxy.destination (input.value);
			LapaPreferences.remember ("bookmarks", url);
			draw ("bookmarks", "saved-section");
			notify ("Saved to your places in this browser.", 0);
		} catch (error) {
			notify (error.message, 1);
		}
	};

	/**
	 * Clear a destination list after an explicit user click.
	 * @param {MouseEvent} event Click event.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function clearList (event) {

		try {
			const kind = event.currentTarget.id === "clear-history" ? "history" : "bookmarks";
			LapaPreferences.clear (kind);
			draw (kind, kind === "history" ? "history-section" : "saved-section");
			notify ("Cleared from this browser.", 0);
		} catch (error) {
			notify ("Browser storage is unavailable.", 1);
		}
	};

	/**
	 * Open the blank wrapper in direct response to a user gesture.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function cloak () {

		try {
			LapaPreferences.cloak ();
		} catch (error) {
			notify (error.message, 1);
		}
	};

	/**
	 * Focus the URL bar with slash while preserving normal typing.
	 * @param {KeyboardEvent} event Key event.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function keyboard (event) {

		if (event.key === "/" && event.target.tagName !== "INPUT" && event.target.tagName !== "TEXTAREA" && !event.target.isContentEditable && !event.ctrlKey && !event.metaKey && !event.altKey) {
			event.preventDefault ();
			input.focus ();
		}
	};

	/**
	 * Restore controls and history when returning through the browser back button.
	 * @return {void}
	 * @memberOf module:LapaLanding
	 */
	function restore () {

		navigating = 0;
		button.disabled = false;
		LapaPreferences.applyTab ();
		draw ("history", "history-section");
		draw ("bookmarks", "saved-section");
		notify ("Enter a website or a search to get started.", 0);
	};
	document.getElementById ("search-form").addEventListener ("submit", submit);
	document.querySelector (".landing").addEventListener ("click", shortcut);
	document.getElementById ("bookmark").addEventListener ("click", bookmark);
	document.getElementById ("clear-history").addEventListener ("click", clearList);
	document.getElementById ("clear-bookmarks").addEventListener ("click", clearList);
	document.getElementById ("cloak").addEventListener ("click", cloak);
	document.addEventListener ("keydown", keyboard);
	window.addEventListener ("pageshow", restore);
	restore ();
	return { browse: browse };
} ());
