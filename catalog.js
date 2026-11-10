/** @module HomeworkCatalog */
var HomeworkCatalog = (/**
 * Render grade pathways and an accessible searchable lesson catalog.
 * @return {Object} Catalog marker.
 * @memberOf module:HomeworkCatalog
 */
function () {

	"use strict";
	const library = HomeworkCurriculum;
	const __EMPTY_STRING__ = "";
	const __STRING_ALL__ = "all";
	const grid = document.getElementById ("grade-grid");
	const resultStatus = document.getElementById ("catalog-status");
	const search = document.getElementById ("lesson-search");
	let data;
	let selectedBand = __STRING_ALL__;
	let selectedSubject = new URLSearchParams (location.search).get ("subject") || "math";
	if (!["math", "physics", "chemistry"].includes (selectedSubject)) selectedSubject = "math";
	const descriptions = {
		math: "Math for every stage, with visual models from counting to calculus.",
		physics: "Six first steps into physics. Move a cart, close a circuit, and see what the numbers mean.",
		chemistry: "Six first steps into chemistry. Look inside atoms, count molecules, and follow every particle."
	};

	/**
	 * Build a readable grade card with topic previews and real navigation.
	 * @param {Object} grade Grade record.
	 * @param {string} query Search query.
	 * @return {HTMLElement} Grade card.
	 * @memberOf module:HomeworkCatalog
	 */
	function card (grade, query) {

		const node = library.element ("article", "grade-card " + grade.band + (grade.subject ? " " + grade.subject : ""));
		const top = library.element ("div", "grade-card-top");
		top.appendChild (library.element ("span", "grade-badge", grade.subject ? (grade.subject === "physics" ? "F" : "H₂") : grade.id === "k" ? "K" : grade.id));
		top.appendChild (library.element ("span", "grade-meta", grade.lessons.length + " lessons"));
		node.appendChild (top);
		const title = library.element ("h3", __EMPTY_STRING__);
		const link = library.element ("a", "grade-title", grade.label);
		link.href = library.href (grade);
		title.appendChild (link);
		node.appendChild (title);
		node.appendChild (library.element ("p", "grade-description", grade.description));
		const topics = library.element ("ul", "grade-topics");
		let visible = 0;
		for (let index = 0; index < grade.lessons.length; index++) {
			const lesson = grade.lessons[index];
			if (query && (lesson.title + " " + lesson.concept).toLowerCase ().indexOf (query) === -1) continue;
			if (!query && visible >= 3 && !grade.subject) break;
			const item = library.element ("li", __EMPTY_STRING__);
			const topic = library.element ("a", __EMPTY_STRING__, lesson.title + (grade.subject ? " →" : ""));
			topic.href = library.href (grade, lesson);
			item.appendChild (topic);
			topics.appendChild (item);
			visible++;
		}
		node.appendChild (topics);
		const bottom = library.element ("div", "grade-card-bottom");
		const completed = library.count (grade);
		bottom.appendChild (library.element ("span", "grade-meta", completed ? completed + "/" + grade.lessons.length + " complete" : "Learn at your pace"));
		const open = library.element ("a", "grade-open", "Explore " + grade.label + " \u2192");
		open.href = library.href (grade);
		bottom.appendChild (open);
		node.appendChild (bottom);
		return node;
	};

	/**
	 * Filter by school band and matching grade, topic, or explanation.
	 * @return {void}
	 * @memberOf module:HomeworkCatalog
	 */
	function render () {

		if (data === undefined) return;
		const query = search.value.trim ().toLowerCase ();
		grid.replaceChildren ();
		grid.classList.toggle ("science-grid", selectedSubject !== "math");
		document.getElementById ("grade-filters").hidden = selectedSubject !== "math";
		document.getElementById ("subject-description").textContent = descriptions[selectedSubject];
		search.placeholder = selectedSubject === "math" ? "Find a topic, like fractions" : selectedSubject === "physics" ? "Find a topic, like forces" : "Find a topic, like atoms";
		let visible = 0;
		for (const grade of library.pathways (data)) {
			if ((grade.subject || "math") !== selectedSubject) continue;
			if (selectedSubject === "math" && selectedBand !== __STRING_ALL__ && grade.band !== selectedBand) continue;
			let matches = !query || (grade.label + " " + grade.description).toLowerCase ().indexOf (query) !== -1;
			for (let lessonIndex = 0; lessonIndex < grade.lessons.length && !matches; lessonIndex++) {
				const lesson = grade.lessons[lessonIndex];
				if ((lesson.title + " " + lesson.concept).toLowerCase ().indexOf (query) !== -1) matches = 1;
			}
			if (matches) {
				grid.appendChild (card (grade, query));
				visible++;
			}
		}
		resultStatus.textContent = visible ? visible + (selectedSubject === "math" ? " grade pathways" : " introductory pathway") + (query ? " matching your search" : " to explore") : "No lessons match in " + selectedSubject + " yet. Try another topic or clear the filters.";
		document.getElementById ("catalog-note").textContent = selectedSubject === "math" ? data.note : data.pathways.find (path => path.subject === selectedSubject).note;
		document.getElementById ("catalog-empty").hidden = visible !== 0;
	};

	function subject (event) {
		const target = event.target.closest ("button[data-subject]");
		if (!target) return;
		selectedSubject = target.dataset.subject;
		search.value = __EMPTY_STRING__;
		for (const button of document.querySelectorAll ("button[data-subject]")) button.setAttribute ("aria-pressed", String (button === target));
		const url = new URL (location.href);
		url.searchParams.set ("subject", selectedSubject);
		history.replaceState (null, "", url);
		render ();
	}

	/**
	 * Select a grade band using buttons with explicit pressed state.
	 * @param {MouseEvent} event Filter click.
	 * @return {void}
	 * @memberOf module:HomeworkCatalog
	 */
	function filter (event) {

		const target = event.target.closest ("button[data-band]");
		if (!target) return;
		selectedBand = target.dataset.band;
		const buttons = document.querySelectorAll ("button[data-band]");
		for (let index = 0; index < buttons.length; index++) buttons[index].setAttribute ("aria-pressed", String (buttons[index] === target));
		render ();
	};

	/**
	 * Clear both filters and return keyboard focus to the search field.
	 * @return {void}
	 * @memberOf module:HomeworkCatalog
	 */
	function reset () {

		search.value = __EMPTY_STRING__;
		document.querySelector ("button[data-band='all']").click ();
		search.focus ();
	};

	/**
	 * Load content and offer a continuation link only for valid saved lessons.
	 * @return {Promise<void>}
	 * @memberOf module:HomeworkCatalog
	 */
	async function start () {

		try {
			data = await library.load ();
			for (const button of document.querySelectorAll ("button[data-subject]")) button.setAttribute ("aria-pressed", String (button.dataset.subject === selectedSubject));
			render ();
			const recent = library.recent (data);
			if (recent !== undefined) {
				const resume = document.getElementById ("resume-link");
				resume.href = library.href (recent.grade, recent.lesson);
				resume.textContent = recent.grade.label + ": " + recent.lesson.title + " \u2192";
				document.getElementById ("resume-panel").hidden = false;
			}
		} catch (error) {
			resultStatus.textContent = error.message;
			resultStatus.classList.add ("error");
		}
	};
	/**
	 * Refresh progress and the recent lesson after a cached history restore.
	 * @param {PageTransitionEvent} event Page restoration event.
	 * @return {void}
	 * @memberOf module:HomeworkCatalog
	 */
	function restore (event) {

		if (event.persisted) location.reload ();
	};
	window.addEventListener ("pageshow", restore);
	search.addEventListener ("input", render);
	document.getElementById ("subject-filters").addEventListener ("click", subject);
	document.getElementById ("grade-filters").addEventListener ("click", filter);
	document.getElementById ("reset-catalog").addEventListener ("click", reset);
	start ();
	return {};
} ());
