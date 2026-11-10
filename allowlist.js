/** @module LapaAllowlist */
var LapaAllowlist = (/**
 * Decide which websites the proxy may open: taming.io, its mirrors, webgames.io and its games.
 * The same file runs in the page, the service worker, and Node.
 * @return {Object} Allowlist API.
 * @memberOf module:LapaAllowlist
 */
function () {

	"use strict";

	/**
	 * Global constant
	 * @memberOf module:LapaAllowlist
	 */
	// Every subdomain of these entries is allowed too (www., account., game servers...).
	const __DOMAINS__ = [
		// taming.io and its mirrors (taming.io/client/js/proxy.js).
		"taming.io",
		"tamming.io",
		"biologyclass.school",
		"school-homework.com",
		"trymath.org",
		"mynotetaking.com",
		"sandtimer.net",
		// webgames.io and the games of its catalogue (webgames.io/scripts/games-seed.json).
		// The server adds the games published later from https://webgames.io/api/games.
		"webgames.io",
		"starvers.io",
		"ferals.io",
		"craftnite.io",
		"tyran.io",
		"shootup.io",
		"devast.io",
		"shootem.io",
		"tankroyale.io",
		"dogod.io",
		"buildroyale.io",
		"limax.io",
		"sploop.io",
		"footix.io",
		"golfroyale.io",
		"witz.io",
		"starve.io",
		"rollem.io",
		"lordz.io",
		"nend.io",
		"clanker.io",
		"shotwars.io",
		"oib.io",
		"koxo.io",
		"triset.io"
	];
	const __HOSTNAME__ = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

	/**
	 * Global variables
	 * @memberOf module:LapaAllowlist
	 */
	let domains = __DOMAINS__.slice ();

	/**
	 * Normalize a hostname for comparison, or return undefined when it is not a DNS name.
	 * @param {string} hostname Hostname.
	 * @return {string|undefined} Lowercase hostname without a trailing dot.
	 * @memberOf module:LapaAllowlist
	 */
	function normalize (hostname) {

		if (typeof hostname !== "string") return undefined;
		let value = hostname.trim ().toLowerCase ();
		if (value.endsWith (".")) value = value.slice (0, -1);
		if (value.startsWith ("www.")) value = value.slice (4);
		return __HOSTNAME__.test (value) ? value : undefined;
	};

	/**
	 * Replace the extra domains, always keeping the built-in ones.
	 * @param {Array<string>} list Domains, for example from /allowlist.json.
	 * @return {Array<string>} The active domains.
	 * @memberOf module:LapaAllowlist
	 */
	function set (list) {

		const next = __DOMAINS__.slice ();
		if (Array.isArray (list)) {
			for (let index = 0; index < list.length; index++) {
				const value = normalize (list[index]);
				if (value !== undefined && next.indexOf (value) === -1) next.push (value);
			}
		}
		domains = next;
		return domains.slice ();
	};

	/**
	 * Return the active domains.
	 * @return {Array<string>} Domains.
	 * @memberOf module:LapaAllowlist
	 */
	function list () {

		return domains.slice ();
	};

	/**
	 * Check one hostname against the domains and their subdomains.
	 * @param {string} hostname Hostname.
	 * @return {number} 1 when allowed.
	 * @memberOf module:LapaAllowlist
	 */
	function allowsHost (hostname) {

		const value = normalize (hostname);
		if (value === undefined) return 0;
		for (let index = 0; index < domains.length; index++) {
			const domain = domains[index];
			if (value === domain || value.endsWith ("." + domain)) return 1;
		}
		return 0;
	};

	/**
	 * Check an absolute HTTP or HTTPS address.
	 * @param {string} address Absolute URL.
	 * @return {number} 1 when allowed.
	 * @memberOf module:LapaAllowlist
	 */
	function allows (address) {

		let url;
		try {
			url = new URL (address);
		} catch (error) {
			return 0;
		}
		if (url.protocol !== "https:" && url.protocol !== "http:") return 0;
		if (url.username || url.password) return 0;
		return allowsHost (url.hostname);
	};

	/**
	 * Extract the game hostnames from a webgames.io /api/games answer.
	 * @param {Object} catalog Parsed JSON, { games : [{ _link : "https://..." }] }.
	 * @return {Array<string>} Hostnames.
	 * @memberOf module:LapaAllowlist
	 */
	function fromCatalog (catalog) {

		const hosts = [];
		if (catalog === null || typeof catalog !== "object" || !Array.isArray (catalog.games)) return hosts;
		for (let index = 0; index < catalog.games.length; index++) {
			const game = catalog.games[index];
			if (game === null || typeof game !== "object" || typeof game._link !== "string") continue;
			try {
				const url = new URL (game._link);
				if (url.protocol !== "https:" && url.protocol !== "http:") continue;
				const value = normalize (url.hostname);
				if (value !== undefined && hosts.indexOf (value) === -1) hosts.push (value);
			} catch (error) {
				// Ignore a malformed catalogue entry.
			}
		}
		return hosts;
	};
	const api = { allows: allows, allowsHost: allowsHost, set: set, list: list, fromCatalog: fromCatalog };
	if (typeof module === "object" && module.exports) module.exports = api;
	return api;
} ());
