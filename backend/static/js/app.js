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
const docInput = document.getElementById("docInput");
const recordAudioBtn = document.getElementById("recordAudioBtn");
const audioFileLabel = document.getElementById("audioFileLabel");
const cardScanInput = document.getElementById("cardScanInput");
const cardScanHint = document.getElementById("cardScanHint");
const cardScanResults = document.getElementById("cardScanResults");
const scanCardCameraBtn = document.getElementById("scanCardCameraBtn");
const photoCameraBtn = document.getElementById("photoCameraBtn");
const cameraOverlay = document.getElementById("cameraOverlay");
const cameraVideo = document.getElementById("cameraVideo");
const cameraHint = document.getElementById("cameraHint");
const cameraShutterBtn = document.getElementById("cameraShutterBtn");
const cameraCancelBtn = document.getElementById("cameraCancelBtn");

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
    if (att.kind === "audio") {
      return `<div class="attachments-preview-item"><audio controls src="${att.url}" class="attachment-audio-sm"></audio>${caption}</div>`;
    }
    return `<a href="${att.url}" target="_blank" rel="noopener" class="link-chip">&#128206; ${escapeHtml(att.title || att.original_name)}</a>`;
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
  if (att.kind === "audio") {
    return `
      <div class="attachment-item attachment-item-audio">
        <audio controls src="${att.url}"></audio>
        ${titleInput}
        ${removeBtn}
      </div>`;
  }
  return `
    <div class="attachment-item attachment-item-file">
      <a href="${att.url}" target="_blank" rel="noopener" class="attachment-file-link">&#128206; ${escapeHtml(att.original_name)}</a>
      ${titleInput}
      ${removeBtn}
    </div>`;
}

function renderAttachments(attachments) {
  attachmentsBox.innerHTML = attachments.length
    ? attachments.map(attachmentItemHtml).join("")
    : `<p class="section-hint" style="margin:0;">Todavía no hay fotos ni notas de voz.</p>`;
}

// Reduce el tamaño de las fotos antes de subirlas (misma calidad en pantalla,
// muchas veces menos peso en disco), tanto si vienen de la cámara como de la
// galería, en móvil o en ordenador. No se toca nada que no sea una imagen.
async function compressImageFile(file, maxDimension = 1600, quality = 0.8) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    return file;
  }
}

async function uploadAttachment(file) {
  attachmentUploadHint.style.display = "block";
  attachmentUploadHint.textContent = "Subiendo...";
  try {
    const toUpload = await compressImageFile(file);
    const formData = new FormData();
    formData.append("file", toUpload);
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

// ---------- Cámara reutilizable (foto de viaje y escaneo de tarjeta) ----------

let cameraStream = null;
let cameraOnCapture = null;

async function openCamera(onCapture) {
  cameraOnCapture = onCapture;
  cameraHint.style.display = "none";
  cameraOverlay.classList.add("open");
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
  } catch (err) {
    cameraHint.style.display = "block";
    cameraHint.textContent = "No se pudo acceder a la cámara: " + err.message;
  }
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraOverlay.classList.remove("open");
  cameraOnCapture = null;
}

function captureCameraPhoto() {
  if (!cameraStream) return;
  const canvas = document.createElement("canvas");
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  canvas.getContext("2d").drawImage(cameraVideo, 0, 0);
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
      const callback = cameraOnCapture;
      closeCamera();
      if (callback) callback(file);
    },
    "image/jpeg",
    0.9
  );
}

cameraShutterBtn.addEventListener("click", captureCameraPhoto);
cameraCancelBtn.addEventListener("click", closeCamera);
scanCardCameraBtn.addEventListener("click", () => openCamera(runCardScan));
photoCameraBtn.addEventListener("click", () => openCamera(uploadAttachment));

// ---------- Escanear tarjeta de contacto (OCR local, sin servidor) ----------

function parseCardText(text) {
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  // El OCR a veces mete espacios de más dentro del correo ("pablo. hernandez@spc.com");
  // si no encaja tal cual, se reintenta quitando los espacios sueltos alrededor de puntos y "@".
  const email = (text.match(EMAIL_RE) || text.replace(/\s*([.@])\s*/g, "$1").match(EMAIL_RE) || [null])[0];

  // El punto de "www." a veces se pierde en el OCR ("wwwspc.com"), así que se
  // acepta con o sin él.
  const websiteMatch = text.match(/\bwww\.?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?\S*/i);
  const websiteRaw = websiteMatch ? websiteMatch[0] : null;
  const website = websiteRaw ? websiteRaw.replace(/^www(?!\.)/i, "www.") : null;

  const phoneMatches = [...text.matchAll(/(\+?\d[\d\s().-]{6,}\d)/g)].map((m) => m[0].trim());
  const phones = [...new Set(phoneMatches)];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !(email && l.replace(/\s+/g, "").includes(email)))
    .filter((l) => !(websiteRaw && l.includes(websiteRaw)))
    .filter((l) => !phones.some((p) => l.includes(p)))
    .filter((l) => l.replace(/[^a-zA-Z0-9]/g, "").length >= 3);

  return { email, website, phones, lines, ...classifyLines(lines) };
}

const ROLE_KEYWORDS = [
  "director", "directora", "gerente", "manager", "presidente", "president", "ceo", "cfo", "cto",
  "coo", "jefe", "jefa", "head of", "chief", "coordinador", "coordinadora", "coordinator",
  "responsable", "business development", "sales", "comercial", "marketing", "ingeniero",
  "ingeniera", "engineer", "consultor", "consultora", "consultant", "founder", "fundador",
  "fundadora", "socio", "socia", "partner", "vicepresidente", "supervisor", "supervisora",
  "analista", "analyst", "specialist", "especialista",
];
const COMPANY_HINTS = [
  " s.l", " s.a", " sl", " sa", "inc.", "inc ", "llc", "ltd", "gmbh", "corp", "group", "grupo",
  "aerospace", "solutions", "technologies", "systems", "industries",
];

// Un nombre de persona suele ser dos o más palabras que empiezan por mayúscula
// y siguen en minúscula (Nombre Apellido[s]) — así se distingue de nombres de
// empresa en MAYÚSCULAS o de líneas sueltas de una sola palabra.
const NAME_PATTERN = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'-]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ'-]+){1,3}$/;
// Muchas tarjetas ponen el nombre TODO EN MAYÚSCULAS (ej. "PABLO HERNANDEZ").
const NAME_PATTERN_CAPS = /^[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3}$/;
// Restos de web/correo/teléfono mal leídos, o símbolos sueltos, que nunca
// deberían acabar en "Nombre" ni "Puesto".
const looksLikeJunk = (l) =>
  /www|@|\.(com|es|net|org|io)\b|\d{2,}/i.test(l) || /[^a-zA-ZÁÉÍÓÚÑáéíóúñ\s'.-]/.test(l);

// Quita símbolos sueltos pegados al principio o al final (restos de líneas
// decorativas u otros elementos mal leídos por el OCR), sin tocar los
// espacios ni la puntuación que sí forman parte del texto real.
function cleanCandidateText(line) {
  return line.replace(/^[^a-zA-ZÁÉÍÓÚÑáéíóúñ0-9]+|[^a-zA-ZÁÉÍÓÚÑáéíóúñ0-9]+$/g, "").trim();
}

function classifyLines(lines) {
  const roleIdx = lines.findIndex((l) => ROLE_KEYWORDS.some((k) => l.toLowerCase().includes(k)));
  const role = roleIdx !== -1 ? cleanCandidateText(lines[roleIdx]) : null;

  const companyIdx = lines.findIndex(
    (l, i) => i !== roleIdx && COMPANY_HINTS.some((k) => l.toLowerCase().includes(k))
  );
  const company = companyIdx !== -1 ? cleanCandidateText(lines[companyIdx]) : null;

  const usedIdx = new Set([roleIdx, companyIdx].filter((i) => i !== -1));
  const availableIdx = lines.map((_, i) => i).filter((i) => !usedIdx.has(i));
  const isNameLike = (l) => (NAME_PATTERN.test(l) || NAME_PATTERN_CAPS.test(l)) && !looksLikeJunk(l);

  // El nombre casi siempre está pegado al puesto en el diseño de la tarjeta
  // (justo antes o justo después), así que se prioriza esa posición sobre
  // cualquier otra línea en mayúsculas que "parezca" un nombre (como el logo
  // o el nombre de la empresa, que suelen ir más arriba y separados).
  let nameIdx = -1;
  if (roleIdx !== -1) {
    nameIdx = [roleIdx - 1, roleIdx + 1].find(
      (i) => availableIdx.includes(i) && isNameLike(lines[i])
    );
    nameIdx = nameIdx === undefined ? -1 : nameIdx;
  }
  if (nameIdx === -1) {
    const found = availableIdx.find((i) => isNameLike(lines[i]));
    nameIdx = found === undefined ? -1 : found;
  }
  // Si ninguna línea encaja de forma fiable con el patrón de un nombre, se
  // deja vacío en vez de adivinar a ciegas (mejor pedir que lo rellenes tú a
  // que se cuele el nombre de la empresa o cualquier otra cosa mal leída).

  const name = nameIdx !== -1 ? cleanCandidateText(lines[nameIdx]) : null;
  const other = availableIdx
    .filter((i) => i !== nameIdx)
    .map((i) => cleanCandidateText(lines[i]))
    .filter(Boolean);

  return { name, role, company, other };
}

function applyCardField(field, value) {
  if (field === "email") {
    document.getElementById("contactEmail").value = value;
  } else if (field === "name") {
    document.getElementById("contactPerson").value = value;
  } else if (field === "role") {
    document.getElementById("contactRole").value = value;
  } else if (field === "notes") {
    const notes = document.getElementById("notes");
    notes.value = notes.value ? `${notes.value}\n${value}` : value;
  } else if (field === "phone") {
    const emptyRow = Array.from(document.querySelectorAll(".phone-input")).find((i) => !i.value.trim());
    if (emptyRow) emptyRow.value = value;
    else addPhoneRow(value);
  } else if (field === "link") {
    const url = value.startsWith("http") ? value : `https://${value}`;
    addLinkRow("Web de la empresa", url);
  }
}

function cardScanRow(label, value, appliedTo, actions) {
  const tag = appliedTo ? `<span class="card-scan-tag">✓ usado como ${appliedTo}</span>` : "";
  const buttons = actions
    .map((a) => `<button type="button" class="btn btn-secondary btn-sm" data-card-action="${a.field}" data-value="${escapeHtml(value)}">${a.label}</button>`)
    .join("");
  return `
    <div class="card-scan-row">
      <span>${label} ${escapeHtml(value)}</span>
      ${tag}
      ${buttons}
    </div>`;
}

function renderCardScanResults(parsed) {
  const parts = [];

  // Autorrelleno: solo si el campo está vacío, para no pisar algo que ya se había escrito a mano.
  const emailField = document.getElementById("contactEmail");
  const nameField = document.getElementById("contactPerson");
  const roleField = document.getElementById("contactRole");

  if (parsed.email) {
    if (!emailField.value.trim()) applyCardField("email", parsed.email);
    parts.push(cardScanRow("&#9993;", parsed.email, emailField.value === parsed.email ? "email" : null, [
      { field: "email", label: "Usar como email" },
    ]));
  }

  parsed.phones.forEach((phone) => {
    applyCardField("phone", phone);
    parts.push(cardScanRow("&#9742;", phone, "teléfono", [{ field: "phone", label: "Añadir como teléfono" }]));
  });

  if (parsed.website) {
    parts.push(cardScanRow("&#127760;", parsed.website, null, [{ field: "link", label: "Añadir como enlace" }]));
  }

  if (parsed.name) {
    if (!nameField.value.trim()) applyCardField("name", parsed.name);
    parts.push(
      cardScanRow("", parsed.name, nameField.value === parsed.name ? "nombre" : null, [
        { field: "name", label: "→ Nombre" },
        { field: "role", label: "→ Puesto" },
      ])
    );
  }

  if (parsed.role) {
    if (!roleField.value.trim()) applyCardField("role", parsed.role);
    parts.push(
      cardScanRow("", parsed.role, roleField.value === parsed.role ? "puesto" : null, [
        { field: "name", label: "→ Nombre" },
        { field: "role", label: "→ Puesto" },
      ])
    );
  }

  if (parsed.company) {
    parts.push(
      cardScanRow("&#127970;", parsed.company, null, [
        { field: "name", label: "→ Nombre" },
        { field: "notes", label: "→ Notas" },
      ])
    );
  }

  parsed.other.forEach((line) => {
    parts.push(
      cardScanRow("", line, null, [
        { field: "name", label: "→ Nombre" },
        { field: "role", label: "→ Puesto" },
        { field: "notes", label: "→ Notas" },
      ])
    );
  });

  if (!parts.length) {
    cardScanResults.innerHTML = `<p class="section-hint" style="margin:4px 0 0;">No se ha detectado texto legible en la foto. Puedes intentarlo de nuevo con mejor luz/enfoque.</p>`;
  } else {
    cardScanResults.innerHTML = `
      <div class="card-scan-results">
        <p class="section-hint" style="margin:0 0 4px;">Se han rellenado los campos vacíos automáticamente. Si algo no cuadra, usa los botones para corregirlo.</p>
        ${parts.join("")}
      </div>`;
  }
  cardScanResults.style.display = "block";
}

async function runCardScan(file) {
  cardScanResults.style.display = "none";
  cardScanHint.style.display = "block";
  cardScanHint.textContent = "Leyendo la tarjeta... puede tardar unos segundos.";

  try {
    const { data } = await Tesseract.recognize(file, "spa+eng");
    const parsed = parseCardText(data.text || "");
    cardScanHint.style.display = "none";
    renderCardScanResults(parsed);
  } catch (err) {
    cardScanHint.textContent = "No se pudo leer la imagen: " + err.message;
  }
}

cardScanInput.addEventListener("change", () => {
  const file = cardScanInput.files[0];
  cardScanInput.value = "";
  if (file) runCardScan(file);
});

cardScanResults.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-card-action]");
  if (!btn) return;
  applyCardField(btn.dataset.cardAction, btn.dataset.value);
  btn.closest(".card-scan-row").style.opacity = "0.4";
  btn.disabled = true;
});

// ---------- Modal: abrir/cerrar/guardar ----------

function openModal(trip = null) {
  formError.style.display = "none";
  cardScanResults.style.display = "none";
  cardScanHint.style.display = "none";
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
  closeCamera();
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

docInput.addEventListener("change", async () => {
  for (const file of Array.from(docInput.files)) {
    await uploadAttachment(file);
  }
  docInput.value = "";
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
