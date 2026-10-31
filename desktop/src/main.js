import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

const ui = {
  experiences: document.querySelector("#experiences"),
  title: document.querySelector("#experience-title"),
  meta: document.querySelector("#experience-meta"),
  count: document.querySelector("#evidence-count"),
  status: document.querySelector("#status"),
  entryForm: document.querySelector("#entry-form"),
  description: document.querySelector("#description"),
  save: document.querySelector("#save-button"),
  evidence: document.querySelector("#evidence-list"),
  editExperienceButton: document.querySelector("#edit-experience-button"),
  experienceEditor: document.querySelector("#experience-editor"),
  experienceForm: document.querySelector("#experience-form"),
  experienceKind: document.querySelector("#experience-kind"),
  experienceName: document.querySelector("#experience-name"),
  experienceOrganization: document.querySelector("#experience-organization"),
  experienceStart: document.querySelector("#experience-start"),
  experienceEnd: document.querySelector("#experience-end"),
  cancelExperienceEdit: document.querySelector("#cancel-experience-edit"),
};
const state = {
  experiences: [],
  selectedId: null,
  evidence: [],
  busy: false,
  editorOpen: false,
  action: null,
};

function inform(message, error = false) {
  ui.status.textContent = message;
  ui.status.classList.toggle("error", error);
}
function currentExperience() {
  return state.experiences.find((item) => item.id === state.selectedId);
}
function dateRange(item) {
  return [item.start_date || "Date unknown", item.end_date || "Date unknown"].join(" – ");
}
function actionButton(label, onClick, className = "minor-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.disabled = state.busy;
  button.addEventListener("click", onClick);
  return button;
}
function renderHeader() {
  const experience = currentExperience();
  ui.title.textContent = experience ? experience.title : "Choose an experience";
  ui.meta.textContent = experience
    ? (experience.organization || experience.kind) + " · " + dateRange(experience)
    : "Select a record to view and add evidence.";
  ui.editExperienceButton.disabled = !experience || state.busy;
  ui.editExperienceButton.textContent = state.editorOpen ? "Cancel editing" : "Edit experience";
}
function renderExperiences() {
  ui.experiences.replaceChildren();
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
    ui.experiences.append(button);
  }
}
function renderEvidenceEditor(item, card) {
  if (!state.action || state.action.id !== item.id) return;
  const action = state.action;
  const form = document.createElement("form");
  form.className = "evidence-edit-form";

  if (action.mode === "edit") {
    const label = document.createElement("label");
    label.textContent = "Edit description";
    const input = document.createElement("textarea");
    input.value = action.draft;
    input.rows = 4;
    input.disabled = state.busy;
    input.addEventListener("input", () => {
      action.draft = input.value;
      save.disabled = state.busy || !action.draft.trim();
    });
    label.append(input);
    form.append(label);
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Save changes";
    save.disabled = state.busy || !action.draft.trim();
    const actions = document.createElement("div");
    actions.className = "action-row";
    actions.append(actionButton("Cancel", () => setAction(null)), save);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.busy && action.draft.trim()) manageEvidence("edit", item.id, action.draft);
    });
  } else if (action.mode === "move") {
    const label = document.createElement("label");
    label.textContent = "Move to experience";
    const select = document.createElement("select");
    select.disabled = state.busy;
    for (const experience of state.experiences) {
      if (experience.id === item.experience_id) continue;
      const option = document.createElement("option");
      option.value = experience.id;
      option.textContent = experience.title + " — " + (experience.organization || experience.kind);
      select.append(option);
    }
    select.value = action.targetId;
    select.addEventListener("change", () => { action.targetId = select.value; });
    label.append(select);
    form.append(label);
    const move = document.createElement("button");
    move.type = "submit";
    move.textContent = "Move evidence";
    move.disabled = state.busy || !action.targetId;
    const actions = document.createElement("div");
    actions.className = "action-row";
    actions.append(actionButton("Cancel", () => setAction(null)), move);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.busy && action.targetId) manageEvidence("move", item.id, action.targetId);
    });
  }
  card.append(form);
}
function renderEvidence() {
  ui.evidence.replaceChildren();
  ui.count.textContent = state.evidence.length + " item" + (state.evidence.length === 1 ? "" : "s");
  if (!state.evidence.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No evidence recorded for this experience yet.";
    ui.evidence.append(empty);
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
    const actions = document.createElement("div");
    actions.className = "evidence-actions";
    actions.append(
      actionButton("Edit", () => setAction({
        id: item.id, mode: "edit", draft: item.description,
      })),
      actionButton("Move", () => setAction({
        id: item.id, mode: "move",
        targetId: state.experiences.find((experience) => experience.id !== item.experience_id)?.id || "",
      })),
      actionButton("Delete", () => confirmDelete(item), "minor-button destructive")
    );
    card.append(content, reference, actions);
    renderEvidenceEditor(item, card);
    ui.evidence.append(card);
  }
}
function updateAvailability() {
  ui.description.disabled = !state.selectedId || state.busy;
  ui.save.disabled = !state.selectedId || state.busy || !ui.description.value.trim();
  ui.save.textContent = state.busy ? "Working…" : "Add evidence";
  for (const field of ui.experienceForm.querySelectorAll("input, select, button")) {
    field.disabled = state.busy;
  }
}
function repaint() {
  renderHeader();
  renderExperiences();
  renderEvidence();
  updateAvailability();
}
function hasUnsavedEvidenceDraft() {
  if (!state.action || state.action.mode !== "edit") return false;
  const item = state.evidence.find((entry) => entry.id === state.action.id);
  return Boolean(item && state.action.draft !== item.description);
}
function setAction(action) {
  if (state.busy) return;
  if (hasUnsavedEvidenceDraft() &&
      !window.confirm("Discard unsaved evidence description changes?")) return;
  state.action = action;
  renderEvidence();
}
async function readExperienceCatalogue() {
  const results = [];
  let offset = 0;
  while (true) {
    const page = await invoke("list_experiences", { offset });
    results.push(...page.items);
    if (!page.has_more) return results;
    if (!page.items.length) throw new Error("Experience pagination did not advance");
    offset += page.items.length;
  }
}
async function refreshEvidence(id) {
  const record = await invoke("get_experience", { experienceId: id });
  if (state.selectedId !== id) return;
  state.evidence = record.evidence;
  renderEvidence();
}
function getExperienceForm() {
  return {
    kind: ui.experienceKind.value,
    title: ui.experienceName.value,
    organization: ui.experienceOrganization.value || null,
    startDate: ui.experienceStart.value || null,
    endDate: ui.experienceEnd.value || null,
  };
}
function hasChangedExperienceDraft() {
  const record = currentExperience();
  if (!record || !state.editorOpen) return false;
  const draft = getExperienceForm();
  return (
    draft.kind !== record.kind || draft.title !== record.title ||
    draft.organization !== record.organization ||
    draft.startDate !== record.start_date || draft.endDate !== record.end_date
  );
}
function closeExperienceEditor() {
  state.editorOpen = false;
  ui.experienceEditor.hidden = true;
  renderHeader();
}
function openExperienceEditor() {
  if (state.busy) return;
  if (state.editorOpen) {
    if (hasChangedExperienceDraft() && !window.confirm("Discard unsaved experience changes?")) return;
    closeExperienceEditor();
    return;
  }
  const experience = currentExperience();
  if (!experience) return;
  ui.experienceKind.value = experience.kind;
  ui.experienceName.value = experience.title;
  ui.experienceOrganization.value = experience.organization || "";
  ui.experienceStart.value = experience.start_date || "";
  ui.experienceEnd.value = experience.end_date || "";
  state.editorOpen = true;
  ui.experienceEditor.hidden = false;
  renderHeader();
  ui.experienceName.focus();
}
async function selectExperience(id) {
  if (!id || state.busy || id === state.selectedId) return;
  if (state.editorOpen && hasChangedExperienceDraft() &&
      !window.confirm("Discard unsaved experience changes?")) return;
  if (hasUnsavedEvidenceDraft() &&
      !window.confirm("Discard unsaved evidence description changes?")) return;
  if (ui.description.value.trim() &&
      !window.confirm("Discard the unsaved new evidence description?")) return;
  closeExperienceEditor();
  state.action = null;
  ui.description.value = "";
  state.selectedId = id;
  state.evidence = [];
  repaint();
  inform("Loading evidence…");
  try {
    await refreshEvidence(id);
    if (state.selectedId === id) inform("");
  } catch (error) {
    if (state.selectedId === id) inform("Could not load evidence: " + error, true);
  }
}
async function loadExperiences() {
  try {
    state.experiences = await readExperienceCatalogue();
    if (!state.experiences.length) {
      inform("No experiences yet. Use the CLI add-experience command to create one.");
      repaint();
      return;
    }
    await selectExperience(state.experiences[0].id);
  } catch (error) {
    inform("Unable to open Career Ledger: " + error, true);
  }
}
async function committedRefresh(successMessage, id) {
  try {
    await refreshEvidence(id);
    inform(successMessage);
  } catch (error) {
    inform(successMessage + ", but the evidence list did not refresh: " + error, true);
  }
}
async function manageEvidence(operation, id, payload) {
  if (state.busy) return;
  const parentId = state.selectedId;
  state.busy = true;
  repaint();
  try {
    let result;
    if (operation === "edit") {
      result = await invoke("update_evidence", { id, description: payload });
    } else if (operation === "move") {
      result = await invoke("move_evidence", { id, experienceId: payload });
    } else if (operation === "delete") {
      result = await invoke("delete_evidence", { id });
    } else {
      throw new Error("Unsupported evidence operation");
    }
    state.action = null;
    const label = operation === "edit" ? "Updated " :
      operation === "move" ? "Moved " : "Deleted ";
    await committedRefresh(label + result.id, parentId);
  } catch (error) {
    inform("Evidence " + operation + " was not confirmed: " + error, true);
  } finally {
    state.busy = false;
    repaint();
  }
}
function confirmDelete(item) {
  if (state.busy) return;
  const preview = item.description.length > 140
    ? item.description.slice(0, 140) + "…" : item.description;
  if (!window.confirm(
    "Permanently delete evidence " + item.id + "?\n\n" + preview +
    "\n\nThis cannot be undone."
  )) return;
  manageEvidence("delete", item.id);
}
ui.editExperienceButton.addEventListener("click", openExperienceEditor);
ui.cancelExperienceEdit.addEventListener("click", () => {
  if (hasChangedExperienceDraft() && !window.confirm("Discard unsaved experience changes?")) return;
  closeExperienceEditor();
});
ui.experienceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy || !state.selectedId) return;
  const id = state.selectedId;
  const fields = getExperienceForm();
  if (!fields.title.trim()) { inform("Experience title must not be blank.", true); return; }
  state.busy = true;
  repaint();
  try {
    await invoke("update_experience", { id, ...fields });
    closeExperienceEditor();
    try {
      state.experiences = await readExperienceCatalogue();
      repaint();
      inform("Saved experience " + id);
    } catch (error) {
      inform("Saved experience " + id + ", but the catalogue did not refresh: " + error, true);
    }
  } catch (error) {
    inform("Experience changes were not saved: " + error, true);
  } finally {
    state.busy = false;
    repaint();
  }
});
ui.description.addEventListener("input", updateAvailability);
ui.description.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    ui.entryForm.requestSubmit();
  }
});
ui.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.busy || !state.selectedId || !ui.description.value.trim()) return;
  const id = state.selectedId;
  const description = ui.description.value;
  state.busy = true;
  repaint();
  try {
    const result = await invoke("add_evidence", { experienceId: id, description });
    ui.description.value = "";
    await committedRefresh("Saved evidence " + result.id, id);
  } catch (error) {
    inform("Evidence was not confirmed saved: " + error, true);
  } finally {
    state.busy = false;
    repaint();
    ui.description.focus();
  }
});
loadExperiences();
