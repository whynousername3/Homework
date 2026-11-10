/** @module HomeworkCurriculum */
var HomeworkCurriculum = (/**
 * Share the lesson library, safe DOM helpers, and browser-local progress.
 * @return {Object} Curriculum API.
 * @memberOf module:HomeworkCurriculum
 */
function () {

	"use strict";
	const __STRING_DATA__ = "/assets/data/curriculum.json";
	const __STRING_PROGRESS__ = "homework.progress.v1";
	const __STRING_RECENT__ = "homework.recent.v1";
	const __EMPTY_STRING__ = "";
	let pending;
	let completed = [];
	try {
		const saved = JSON.parse (localStorage.getItem (__STRING_PROGRESS__));
		if (Array.isArray (saved)) {
			for (let index = 0; index < saved.length && index < 200; index++) {
				if (typeof saved[index] === "string" && /^(?:[k0-9]+|(?:physics|chemistry)\/[a-z-]+)\/[a-z-]+$/.test (saved[index]) && completed.indexOf (saved[index]) === -1) completed.push (saved[index]);
			}
		}
	} catch (error) {
		// Lessons remain usable when storage is unavailable or has been edited.
	}

	/**
	 * Fetch the same-origin curriculum once per page.
	 * @return {Promise<Object>} Valid curriculum.
	 * @memberOf module:HomeworkCurriculum
	 */
	async function request () {

		const response = await fetch (__STRING_DATA__);
		if (!response.ok) throw new Error ("The lesson library could not load. Please reload the page to try again.");
		const data = await response.json ();
		if (!Array.isArray (data.grades)) throw new Error ("The lesson library is unavailable. Please try again.");
		return data;
	};

	/**
	 * Reuse the curriculum request.
	 * @return {Promise<Object>} Curriculum data.
	 * @memberOf module:HomeworkCurriculum
	 */
	function load () {

		if (pending === undefined) pending = request ();
		return pending;
	};

	/**
	 * Create an element using textContent, never untrusted markup.
	 * @param {string} tag Element tag.
	 * @param {string} className CSS classes.
	 * @param {string|undefined} text Visible text.
	 * @return {HTMLElement} Element.
	 * @memberOf module:HomeworkCurriculum
	 */
	function element (tag, className, text) {

		const node = document.createElement (tag);
		node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	};

	/**
	 * Build a grade or lesson permalink from library identifiers.
	 * @param {Object} grade Grade record.
	 * @param {Object|undefined} lesson Optional lesson record.
	 * @return {string} Same-origin path.
	 * @memberOf module:HomeworkCurriculum
	 */
	function href (grade, lesson) {

		return "/" + (grade.subject || "math") + "/" + grade.id + "/" + (lesson === undefined ? __EMPTY_STRING__ : lesson.id + "/");
	};

	function pathways (data) {
		return data.grades.concat (data.pathways || []);
	}

	// Keep existing math keys so previous progress needs no migration.
	function key (grade) {
		return grade.subject && grade.subject !== "math" ? grade.subject + "/" + grade.id : grade.id;
	}

	/**
	 * Determine whether a lesson was completed in this browser.
	 * @param {Object} grade Grade record.
	 * @param {Object} lesson Lesson record.
	 * @return {boolean} Completion state.
	 * @memberOf module:HomeworkCurriculum
	 */
	function done (grade, lesson) {

		return completed.indexOf (key (grade) + "/" + lesson.id) !== -1;
	};

	/**
	 * Count completed lessons in a grade.
	 * @param {Object} grade Grade record.
	 * @return {number} Completed count.
	 * @memberOf module:HomeworkCurriculum
	 */
	function count (grade) {

		let total = 0;
		for (let index = 0; index < grade.lessons.length; index++) {
			if (done (grade, grade.lessons[index])) total++;
		}
		return total;
	};

	/**
	 * Record completion; report whether durable browser storage succeeded.
	 * @param {Object} grade Grade record.
	 * @param {Object} lesson Lesson record.
	 * @return {number} Whether progress was persisted.
	 * @memberOf module:HomeworkCurriculum
	 */
	function complete (grade, lesson) {

		if (!done (grade, lesson)) completed.push (key (grade) + "/" + lesson.id);
		try {
			localStorage.setItem (__STRING_PROGRESS__, JSON.stringify (completed));
			return 1;
		} catch (error) {
			return 0;
		}
	};

	/**
	 * Remember the current lesson without making storage essential.
	 * @param {Object} grade Grade record.
	 * @param {Object} lesson Lesson record.
	 * @return {void}
	 * @memberOf module:HomeworkCurriculum
	 */
	function visit (grade, lesson) {

		try {
			localStorage.setItem (__STRING_RECENT__, JSON.stringify ({ subject: grade.subject || "math", grade: grade.id, lesson: lesson.id }));
		} catch (error) {
			// Reading and practice do not require persistent storage.
		}
	};

	/**
	 * Resolve saved navigation only against known curriculum records.
	 * @param {Object} data Curriculum.
	 * @return {Object|undefined} Valid recent lesson.
	 * @memberOf module:HomeworkCurriculum
	 */
	function recent (data) {

		try {
			const saved = JSON.parse (localStorage.getItem (__STRING_RECENT__));
			if (!saved || typeof saved !== "object") return;
			for (const grade of pathways (data)) {
				if (grade.id !== saved.grade || (grade.subject || "math") !== (saved.subject || "math")) continue;
				for (let lessonIndex = 0; lessonIndex < grade.lessons.length; lessonIndex++) {
					const lesson = grade.lessons[lessonIndex];
					if (lesson.id === saved.lesson) return { grade: grade, lesson: lesson };
				}
			}
		} catch (error) {
			return;
		}
	};

	/**
	 * Parse a finite decimal or simple fraction without evaluating code.
	 * @param {string} value Student input.
	 * @return {number|undefined} Numeric answer, or undefined when malformed.
	 * @memberOf module:HomeworkCurriculum
	 */
	function answer (value) {

		value = value.trim ();
		const parts = value.split ("/");
		if (parts.length > 2) return;
		for (let index = 0; index < parts.length; index++) {
			parts[index] = parts[index].trim ();
			if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test (parts[index])) return;
		}
		const numerator = Number (parts[0]);
		const denominator = parts.length === 2 ? Number (parts[1]) : 1;
		if (!Number.isFinite (numerator) || !Number.isFinite (denominator) || denominator === 0) return;
		return numerator / denominator;
	};
	return { load: load, element: element, href: href, pathways: pathways, key: key, done: done, count: count, complete: complete, visit: visit, recent: recent, answer: answer };
} ());
