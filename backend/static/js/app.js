const state = {
  trips: [],
  editingId: null,
  searchTerm: "",
};

const tripsBody = document.getElementById("tripsBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const formError = document.getElementById("formError");
const travelersBox = document.getElementById("travelersBox");
const phonesBox = document.getElementById("phonesBox");
const linksBox = document.getElementById("linksBox");
const attachmentsSection = document.getElementById("attachmentsSection");
const attachmentsBox = document.getElementById("attachmentsBox");
const attachmentsNewHint = document.getElementById("attachmentsNewHint");
const attachmentUploadHint = document.getElementById("attachmentUploadHint");
const imageInput = document.getElementById("imageInput");
const audioInput = document.getElementById("audioInput");
const recordAudioBtn = document.getElementById("recordAudioBtn");
const audioFileLabel = document.getElementById("audioFileLabel");

function fmtDate(isoStr) {
  if (!isoStr) return "—";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function errorMessageFromDetail(detail) {
  if (!detail) return "Error inesperado";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d.msg || JSON.stringify(d)).replace(/^Value error,\s*/, ""))
      .join(" · ");
  }
  return "Error inesperado";
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(path, {
    headers: isFormData ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("No autenticado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(errorMessageFromDetail(body.detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

function matchesSearch(trip, term) {
  if (!term) return true;
  const haystack = [
    trip.name,
    trip.purpose,
    trip.contact_person,
    trip.contact_role,
    trip.contact_email,
    ...(trip.phones || []),
    ...trip.travelers.map((t) => t.full_name),
    ...(trip.links || []).map((l) => l.title),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
}

function attachmentsPreviewHtml(attachments, links) {
  if (!attachments.length && !links.length) return `<span style="color:var(--text-muted)">—</span>`;
  const items = attachments.map((att) => {
    const caption = att.title
      ? `<div class="attachment-caption">${escapeHtml(att.title)}</div>`
      : "";
    if (att.kind === "image") {
      return `<div class="attachments-preview-item"><a href="${att.url}" target="_blank" rel="noopener"><img src="${att.url}" class="attachment-thumb-sm" alt="${escapeHtml(att.title || att.original_name)}"></a>${caption}</div>`;
    }
    return `<div class="attachments-preview-item"><audio controls src="${att.url}" class="attachment-audio-sm"></audio>${caption}</div>`;
  });
  const linkItems = links.map(
    (l) =>
      `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="link-chip">&#128196; ${escapeHtml(l.title || l.url)}</a>`
  );
  return `<div class="attachments-preview">${items.join("")}${linkItems.join("")}</div>`;
}

function renderTrips() {
  const term = state.searchTerm.trim().toLowerCase();
  const visible = state.trips.filter((t) => matchesSearch(t, term));

  tripsBody.innerHTML = "";
  emptyState.style.display = visible.length ? "none" : "block";

  for (const trip of visible) {
    const tr = document.createElement("tr");
    const travelersHtml = trip.travelers.length
      ? trip.travelers.map((t) => `<span class="pill">${escapeHtml(t.full_name)}</span>`).join("")
      : `<span style="color:var(--text-muted)">—</span>`;
    const phonesHtml = (trip.phones || []).length
      ? trip.phones.map((p) => `<div>${escapeHtml(p)}</div>`).join("")
      : "—";
    const purposeHtml = trip.purpose ? `<div class="pill" style="margin-top:4px;">${escapeHtml(trip.purpose)}</div>` : "";
    const notesHtml = trip.notes ? `<div style="font-weight:400;color:var(--text-muted);font-size:12px;margin-top:4px;">${escapeHtml(trip.notes)}</div>` : "";

    tr.innerHTML = `
      <td class="trip-name">${escapeHtml(trip.name)}${purposeHtml}${notesHtml}</td>
      <td>${travelersHtml}</td>
      <td class="trip-dates">${fmtDate(trip.start_date)}</td>
      <td class="trip-dates">${fmtDate(trip.end_date)}</td>
      <td>${escapeHtml(trip.contact_person) || "—"}${trip.contact_role ? `<div style="color:var(--text-muted);font-size:12px;">${escapeHtml(trip.contact_role)}</div>` : ""}</td>
      <td>
        ${phonesHtml}
        <div style="color:var(--text-muted);font-size:12px;">${escapeHtml(trip.contact_email) || ""}</div>
      </td>
      <td>${attachmentsPreviewHtml(trip.attachments || [], trip.links || [])}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${trip.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-action="delete" data-id="${trip.id}">Eliminar</button>
      </td>
    `;
    tripsBody.appendChild(tr);
  }
}

async function loadTrips({ silent = false } = {}) {
  try {
    const trips = await api("/api/trips");
    state.trips = trips;
    renderTrips();
  } catch (err) {
    if (!silent) alert("No se pudieron cargar los viajes: " + err.message);
  }
}

// ---------- Modal: listas dinámicas (personas / teléfonos) ----------

function addListRow(container, inputClass, placeholder, value = "") {
  const row = document.createElement("div");
  row.className = "traveler-row";
  row.innerHTML = `
    <input type="text" class="${inputClass}" placeholder="${placeholder}" value="${escapeHtml(value)}">
    <button type="button" class="traveler-remove">&times;</button>
  `;
  row.querySelector(".traveler-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

const addTravelerRow = (value = "") => addListRow(travelersBox, "traveler-input", "Nombre y apellidos", value);
const addPhoneRow = (value = "") => addListRow(phonesBox, "phone-input", "+34 600 000 000", value);

function addLinkRow(title = "", url = "") {
  const row = document.createElement("div");
  row.className = "traveler-row link-row";
  row.innerHTML = `
    <input type="text" class="link-title-input" placeholder="Título (ej. Itinerario)" value="${escapeHtml(title)}">
    <input type="url" class="link-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="traveler-remove">&times;</button>
  `;
  row.querySelector(".traveler-remove").addEventListener("click", () => row.remove());
  linksBox.appendChild(row);
}

// ---------- Modal: adjuntos ----------

function attachmentItemHtml(att) {
  const removeBtn = `<button type="button" class="attachment-remove" data-attachment-id="${att.id}">&times;</button>`;
  const titleInput = `<input type="text" class="attachment-title-input" data-attachment-id="${att.id}" placeholder="Añadir título..." value="${escapeHtml(att.title)}">`;
  if (att.kind === "image") {
    return `
      <div class="attachment-item">
        <a href="${att.url}" target="_blank" rel="noopener"><img src="${att.url}" class="attachment-thumb" alt="${escapeHtml(att.title || att.original_name)}"></a>
        ${titleInput}
        ${removeBtn}
      </div>`;
  }
  return `
    <div class="attachment-item attachment-item-audio">
      <audio controls src="${att.url}"></audio>
      ${titleInput}
      ${removeBtn}
    </div>`;
}

function renderAttachments(attachments) {
  attachmentsBox.innerHTML = attachments.length
    ? attachments.map(attachmentItemHtml).join("")
    : `<p class="section-hint" style="margin:0;">Todavía no hay fotos ni notas de voz.</p>`;
}

async function uploadAttachment(file) {
  attachmentUploadHint.style.display = "block";
  attachmentUploadHint.textContent = "Subiendo...";
  try {
    const formData = new FormData();
    formData.append("file", file);
    const attachment = await api(`/api/trips/${state.editingId}/attachments`, {
      method: "POST",
      body: formData,
    });
    const trip = state.trips.find((t) => t.id === state.editingId);
    if (trip) {
      trip.attachments = [...(trip.attachments || []), attachment];
      renderAttachments(trip.attachments);
    }
    attachmentUploadHint.style.display = "none";
  } catch (err) {
    attachmentUploadHint.textContent = "No se pudo subir: " + err.message;
  }
}

async function updateAttachmentTitle(attachmentId, title) {
  try {
    const formData = new FormData();
    formData.append("title", title);
    const updated = await api(`/api/trips/${state.editingId}/attachments/${attachmentId}`, {
      method: "PATCH",
      body: formData,
    });
    const trip = state.trips.find((t) => t.id === state.editingId);
    if (trip) {
      const att = (trip.attachments || []).find((a) => a.id === Number(attachmentId));
      if (att) att.title = updated.title;
    }
  } catch (err) {
    attachmentUploadHint.style.display = "block";
    attachmentUploadHint.textContent = "No se pudo guardar el título: " + err.message;
  }
}

async function deleteAttachment(attachmentId) {
  try {
    await api(`/api/trips/${state.editingId}/attachments/${attachmentId}`, { method: "DELETE" });
    const trip = state.trips.find((t) => t.id === state.editingId);
    if (trip) {
      trip.attachments = (trip.attachments || []).filter((a) => a.id !== Number(attachmentId));
      renderAttachments(trip.attachments);
    }
  } catch (err) {
    alert("No se pudo eliminar el adjunto: " + err.message);
  }
}

// ---------- Grabación de notas de voz ----------

const canRecordAudio = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recordingStartedAt = null;
let discardRecording = false;

if (!canRecordAudio) {
  recordAudioBtn.style.display = "none";
  audioFileLabel.style.display = "inline-flex";
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function resetRecordButton() {
  recordAudioBtn.textContent = "\u{1F399}️ Nota de voz";
  recordAudioBtn.classList.remove("recording");
  clearInterval(recordingTimer);
  recordingTimer = null;
}

async function startRecording() {
  attachmentUploadHint.style.display = "none";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = mediaRecorder.mimeType || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(recordedChunks, { type });
      const file = new File([blob], `nota-voz-${Date.now()}.${ext}`, { type });
      resetRecordButton();
      if (discardRecording) {
        discardRecording = false;
        return;
      }
      if (blob.size > 0) await uploadAttachment(file);
    };

    mediaRecorder.start();
    recordingStartedAt = Date.now();
    recordAudioBtn.classList.add("recording");
    recordAudioBtn.textContent = `⏹ Detener (00:00)`;
    recordingTimer = setInterval(() => {
      recordAudioBtn.textContent = `⏹ Detener (${formatElapsed(Date.now() - recordingStartedAt)})`;
    }, 500);
  } catch (err) {
    attachmentUploadHint.style.display = "block";
    attachmentUploadHint.textContent = "No se pudo acceder al micrófono: " + err.message;
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
}

recordAudioBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    stopRecording();
  } else {
    startRecording();
  }
});

// ---------- Modal: abrir/cerrar/guardar ----------

function openModal(trip = null) {
  formError.style.display = "none";
  state.editingId = trip ? trip.id : null;
  modalTitle.textContent = trip ? "Editar viaje" : "Nuevo viaje";

  document.getElementById("tripName").value = trip?.name || "";
  document.getElementById("tripPurpose").value = trip?.purpose || "";
  document.getElementById("startDate").value = trip?.start_date || "";
  document.getElementById("endDate").value = trip?.end_date || "";
  document.getElementById("contactPerson").value = trip?.contact_person || "";
  document.getElementById("contactRole").value = trip?.contact_role || "";
  document.getElementById("contactEmail").value = trip?.contact_email || "";
  document.getElementById("notes").value = trip?.notes || "";

  travelersBox.innerHTML = "";
  if (trip && trip.travelers.length) {
    trip.travelers.forEach((t) => addTravelerRow(t.full_name));
  } else {
    addTravelerRow();
  }

  phonesBox.innerHTML = "";
  if (trip && trip.phones && trip.phones.length) {
    trip.phones.forEach((p) => addPhoneRow(p));
  } else {
    addPhoneRow();
  }

  linksBox.innerHTML = "";
  if (trip && trip.links && trip.links.length) {
    trip.links.forEach((l) => addLinkRow(l.title, l.url));
  }

  attachmentUploadHint.style.display = "none";
  if (trip) {
    attachmentsSection.style.display = "block";
    attachmentsNewHint.style.display = "none";
    renderAttachments(trip.attachments || []);
  } else {
    attachmentsSection.style.display = "none";
    attachmentsNewHint.style.display = "block";
  }

  modalOverlay.classList.add("open");
}

function closeModal() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    discardRecording = true;
    stopRecording();
  }
  modalOverlay.classList.remove("open");
}

async function saveTrip() {
  const name = document.getElementById("tripName").value.trim();
  if (!name) {
    formError.textContent = "El nombre del viaje es obligatorio";
    formError.style.display = "block";
    return;
  }

  const travelers = Array.from(document.querySelectorAll(".traveler-input"))
    .map((i) => i.value.trim())
    .filter(Boolean)
    .map((full_name) => ({ full_name }));

  const phones = Array.from(document.querySelectorAll(".phone-input"))
    .map((i) => i.value.trim())
    .filter(Boolean);

  const links = Array.from(document.querySelectorAll(".link-row"))
    .map((row) => ({
      title: row.querySelector(".link-title-input").value.trim(),
      url: row.querySelector(".link-url-input").value.trim(),
    }))
    .filter((l) => l.url);

  const payload = {
    name,
    purpose: document.getElementById("tripPurpose").value.trim(),
    start_date: document.getElementById("startDate").value || null,
    end_date: document.getElementById("endDate").value || null,
    contact_person: document.getElementById("contactPerson").value.trim(),
    contact_role: document.getElementById("contactRole").value.trim(),
    contact_email: document.getElementById("contactEmail").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    travelers,
    phones,
    links,
  };

  try {
    if (state.editingId) {
      await api(`/api/trips/${state.editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/trips", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    loadTrips();
  } catch (err) {
    formError.textContent = err.message;
    formError.style.display = "block";
  }
}

async function deleteTrip(id) {
  if (!confirm("¿Seguro que quieres eliminar este viaje?")) return;
  try {
    await api(`/api/trips/${id}`, { method: "DELETE" });
    loadTrips();
  } catch (err) {
    alert("No se pudo eliminar: " + err.message);
  }
}

// ---------- Eventos ----------

document.getElementById("newTripBtn").addEventListener("click", () => openModal());
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
document.getElementById("saveBtn").addEventListener("click", saveTrip);
document.getElementById("addTravelerBtn").addEventListener("click", () => addTravelerRow());
document.getElementById("addPhoneBtn").addEventListener("click", () => addPhoneRow());
document.getElementById("addLinkBtn").addEventListener("click", () => addLinkRow());
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

imageInput.addEventListener("change", async () => {
  for (const file of Array.from(imageInput.files)) {
    await uploadAttachment(file);
  }
  imageInput.value = "";
});

audioInput.addEventListener("change", async () => {
  for (const file of Array.from(audioInput.files)) {
    await uploadAttachment(file);
  }
  audioInput.value = "";
});

attachmentsBox.addEventListener("click", (e) => {
  const btn = e.target.closest(".attachment-remove");
  if (!btn) return;
  deleteAttachment(btn.dataset.attachmentId);
});

attachmentsBox.addEventListener("change", (e) => {
  const input = e.target.closest(".attachment-title-input");
  if (!input) return;
  updateAttachmentTitle(input.dataset.attachmentId, input.value.trim());
});

searchInput.addEventListener("input", (e) => {
  state.searchTerm = e.target.value;
  renderTrips();
});

tripsBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const trip = state.trips.find((t) => t.id === id);
  if (btn.dataset.action === "edit") openModal(trip);
  if (btn.dataset.action === "delete") deleteTrip(id);
});

// Carga inicial + sincronización periódica para que los cambios de otros
// usuarios se reflejen sin necesidad de recargar la página manualmente.
loadTrips();
setInterval(() => loadTrips({ silent: true }), 8000);
