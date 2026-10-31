import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const elements = {
  experiences: document.querySelector("#experiences"),
  title: document.querySelector("#experience-title"),
  meta: document.querySelector("#experience-meta"),
  count: document.querySelector("#evidence-count"),
  status: document.querySelector("#status"),
  form: document.querySelector("#entry-form"),
  description: document.querySelector("#description"),
  save: document.querySelector("#save-button"),
  evidence: document.querySelector("#evidence-list"),
};
const state = { experiences: [], selectedId: null, busy: false, evidence: [] };

function inform(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}
function dateRange(experience) {
  return [experience.start_date || "Date unknown", experience.end_date || "Date unknown"].join(" – ");
}
function renderExperiences() {
  elements.experiences.replaceChildren();
  for (const experience of state.experiences) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "experience-item";
    button.classList.toggle("active", experience.id === state.selectedId);
    button.setAttribute("aria-pressed", String(experience.id === state.selectedId));
    button.disabled = state.busy;
    const title = document.createElement("span");
    title.className = "experience-name";
    title.textContent = experience.title;
    const meta = document.createElement("span");
    meta.className = "experience-org";
    meta.textContent = experience.organization || experience.kind;
    button.append(title, meta);
    button.addEventListener("click", () => selectExperience(experience.id));
    elements.experiences.append(button);
  }
}
function renderEvidence() {
  elements.evidence.replaceChildren();
  elements.count.textContent = `${state.evidence.length} item${state.evidence.length === 1 ? "" : "s"}`;
  if (state.evidence.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No evidence recorded for this experience yet.";
    elements.evidence.append(empty);
    return;
  }
  for (const item of state.evidence) {
    const card = document.createElement("article");
    card.className = "evidence-card";
    const content = document.createElement("p");
    content.className = "evidence-description";
    content.textContent = item.description;
    const reference = document.createElement("code");
    reference.className = "evidence-id";
    reference.textContent = item.id;
    card.append(content, reference);
    elements.evidence.append(card);
  }
}
function updateEntryAvailability() {
  elements.description.disabled = !state.selectedId || state.busy;
  elements.save.disabled = !state.selectedId || state.busy || !elements.description.value.trim();
  elements.save.textContent = state.busy ? "Saving…" : "Add evidence";
}
async function refreshEvidence(id) {
  const record = await invoke("get_experience", { experienceId: id });
  if (state.selectedId !== id) return; // Ignore an outdated selection response.
  state.evidence = record.evidence;
  renderEvidence();
}
async function selectExperience(id) {
  if (!id) return;
  state.selectedId = id;
  const experience = state.experiences.find((entry) => entry.id === id);
  elements.title.textContent = experience.title;
  elements.meta.textContent = `${experience.organization || experience.kind} · ${dateRange(experience)}`;
  state.evidence = [];
  renderExperiences();
  renderEvidence();
  updateEntryAvailability();
  inform("Loading evidence…");
  try {
    await refreshEvidence(id);
    if (state.selectedId === id) inform("");
  } catch (error) {
    if (state.selectedId === id) inform(`Could not load evidence: ${error}`, true);
  }
}
async function loadExperiences() {
  try {
    const records = [];
    let offset = 0;
    while (true) {
      const page = await invoke("list_experiences", { offset });
      records.push(...page.items);
      if (!page.has_more) break;
      if (!page.items.length) throw new Error("Experience pagination stopped advancing");
      offset += page.items.length;
    }
    state.experiences = records;
    renderExperiences();
    if (!records.length) {
      inform("No experiences yet. Use the CLI add-experience command to create one.");
      elements.evidence.replaceChildren();
      return;
    }
    await selectExperience(records[0].id);
  } catch (error) {
    inform(`Unable to open Career Ledger: ${error}`, true);
  }
}
elements.description.addEventListener("input", updateEntryAvailability);
elements.description.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    elements.form.requestSubmit();
  }
});
elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const experienceId = state.selectedId;
  const description = elements.description.value;
  if (state.busy || !experienceId || !description.trim()) return;
  state.busy = true;
  renderExperiences();
  updateEntryAvailability();
  try {
    const result = await invoke("add_evidence", { experienceId, description });
    // The CLI acknowledged the commit. Clear immediately, independently of refresh.
    elements.description.value = "";
    inform(`Saved evidence item ${result.id}`);
    try {
      await refreshEvidence(experienceId);
    } catch (error) {
      inform(`Saved ${result.id}, but could not refresh the list: ${error}`, true);
    }
  } catch (error) {
    inform(`Evidence was not confirmed saved: ${error}`, true);
  } finally {
    state.busy = false;
    renderExperiences();
    updateEntryAvailability();
    elements.description.focus();
  }
});
loadExperiences();
