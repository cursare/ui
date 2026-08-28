const lessons = [
	{
		title: "Begin with what you can see.",
		copy: "Describe what happened before interpreting why. Good feedback starts with evidence another person could recognize.",
		prompt: "Separate observation from judgment.",
	},
	{
		title: "Make the impact concrete.",
		copy: "Connect the evidence to a learner, a team or an outcome. Specific impact gives feedback a reason to matter.",
		prompt: "Name who was affected and how.",
	},
	{
		title: "End with one next action.",
		copy: "Agree on a change small enough to try and clear enough to review. A useful loop always has a way back in.",
		prompt: "Choose the action and its review moment.",
	},
];

const lessonLinks = [...document.querySelectorAll("[data-lesson]")];
const lessonNumber = document.querySelector("#lesson-number");
const lessonTitle = document.querySelector("#lesson-title");
const lessonCopy = document.querySelector("#lesson-copy");
const lessonPrompt = document.querySelector("#lesson-prompt");
const nextLesson = document.querySelector("#next-lesson");
const lessonProgress = document.querySelector(".rail-progress i");
const lessonProgressLabel = document.querySelector(".rail-progress span");
let activeLesson = 0;

function selectLesson(index) {
	activeLesson = index % lessons.length;
	const lesson = lessons[activeLesson];
	if (!lesson || !lessonNumber || !lessonTitle || !lessonCopy || !lessonPrompt)
		return;

	lessonNumber.textContent = String(activeLesson + 1).padStart(2, "0");
	lessonTitle.textContent = lesson.title;
	lessonCopy.textContent = lesson.copy;
	lessonPrompt.textContent = lesson.prompt;
	lessonLinks.forEach((link, linkIndex) => {
		link.classList.toggle("is-active", linkIndex === activeLesson);
	});
	lessonProgress?.style.setProperty(
		"--lesson-progress",
		`${((activeLesson + 1) / lessons.length) * 100}%`,
	);
	if (lessonProgressLabel)
		lessonProgressLabel.textContent = `${activeLesson + 1} of ${lessons.length}`;
}

lessonLinks.forEach((link) => {
	link.addEventListener("click", () =>
		selectLesson(Number(link.dataset.lesson)),
	);
});
nextLesson?.addEventListener("click", () => selectLesson(activeLesson + 1));

const itemDescriptions = {
	"course-card":
		"Course discovery with publisher identity, commercial state and learner progress.",
	"course-catalog":
		"Responsive discovery, filtering and catalog empty states for a school storefront.",
	"learner-home":
		"The signed-in learner home with active courses and meaningful next actions.",
	"curriculum-journey":
		"A progress-aware curriculum that turns course structure into forward motion.",
	"enrolled-course-home":
		"The course landing surface after enrollment, ready to resume or begin.",
	"course-player":
		"Rich document playback, activities, media, progress and study context.",
	"course-shell":
		"The responsive application shell around an active learning experience.",
	"course-outline":
		"Compact course navigation for desktop sidebars and mobile sheets.",
	"study-tools":
		"Notes, highlights and learner study projections beside the lesson.",
	"intake-form":
		"Portable learner intake questions with validation and accessible controls.",
	blocks:
		"The complete learner platform, including every surface and the rich player.",
};

function sourceUrl(name) {
	const sourceNames = {
		blocks: "",
		"course-card": "course-card.tsx",
		"course-catalog": "course-catalog.tsx",
		"course-outline": "course-outline.tsx",
		"course-player": "course-player.tsx",
		"course-shell": "course-shell.tsx",
		"curriculum-journey": "curriculum-journey.tsx",
		"enrolled-course-home": "enrolled-course-home.tsx",
		"intake-form": "intake-form.tsx",
		"learner-home": "learner-home.tsx",
		"study-tools": "study-tools.tsx",
	};
	return `https://github.com/cursare/ui/tree/main/registry/learner/${sourceNames[name] ?? ""}`;
}

function registryRow(item, index) {
	const row = document.createElement("article");
	row.className = "registry-row";

	const number = document.createElement("span");
	number.className = "registry-index";
	number.textContent = String(index + 1).padStart(2, "0");

	const name = document.createElement("div");
	name.className = "registry-name";
	name.textContent = item.name;

	const description = document.createElement("div");
	description.className = "registry-description";
	description.textContent = itemDescriptions[item.name] ?? item.description;

	const actions = document.createElement("div");
	actions.className = "registry-actions";

	const source = document.createElement("a");
	source.href = sourceUrl(item.name);
	source.textContent = "Source ↗";

	const install = document.createElement("button");
	install.type = "button";
	install.dataset.copy = `bunx shadcn@4.14.0 add https://cursare.github.io/ui/r/${item.name}.json`;
	install.textContent = "Copy install";

	actions.append(source, install);
	row.append(number, name, description, actions);
	return row;
}

async function loadRegistry() {
	const list = document.querySelector("#registry-list");
	const internals = document.querySelector("#registry-internals");
	if (!list || !internals) return;

	try {
		const response = await fetch("./r/registry.json");
		if (!response.ok) throw new Error("Registry request failed");
		const registry = await response.json();
		const internalNames = new Set(["learner-foundation", "learner-runtime"]);
		const publicItems = registry.items.filter(
			(item) => !internalNames.has(item.name),
		);
		const internalItems = registry.items.filter((item) =>
			internalNames.has(item.name),
		);

		list.replaceChildren(...publicItems.map(registryRow));
		internals.replaceChildren(
			...internalItems.map((item) => {
				const pill = document.createElement("span");
				pill.className = "internal-pill";
				pill.textContent = `${item.name} · installed automatically`;
				return pill;
			}),
		);
	} catch {
		list.innerHTML =
			'<div class="registry-loading">The catalog could not be loaded. <a href="https://github.com/cursare/ui">Browse it on GitHub ↗</a></div>';
	}
}

function copyText(button) {
	const value = button.dataset.copy;
	if (!value) return;
	navigator.clipboard.writeText(value).then(() => {
		const previous = button.textContent;
		button.textContent = "Copied ✓";
		setTimeout(() => {
			button.textContent = previous;
		}, 1600);
	});
}

document.addEventListener("click", (event) => {
	const button = event.target.closest("[data-copy]");
	if (button) copyText(button);
});

const observer = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			entry.target.classList.add("is-visible");
			observer.unobserve(entry.target);
		}
	},
	{ threshold: 0.12 },
);

document.querySelectorAll("[data-reveal]").forEach((element) => {
	observer.observe(element);
});
await loadRegistry();
