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

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("No autenticado");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Error inesperado");
  }
  if (res.status === 204) return null;
  return res.json();
}

function matchesSearch(trip, term) {
  if (!term) return true;
  const haystack = [
    trip.name,
    trip.contact_person,
    trip.contact_phone,
    trip.contact_email,
    ...trip.travelers.map((t) => t.full_name),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(term);
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

    tr.innerHTML = `
      <td class="trip-name">${escapeHtml(trip.name)}${trip.notes ? `<div style="font-weight:400;color:var(--text-muted);font-size:12px;margin-top:4px;">${escapeHtml(trip.notes)}</div>` : ""}</td>
      <td>${travelersHtml}</td>
      <td class="trip-dates">${fmtDate(trip.start_date)}</td>
      <td class="trip-dates">${fmtDate(trip.end_date)}</td>
      <td>${escapeHtml(trip.contact_person) || "—"}</td>
      <td>
        <div>${escapeHtml(trip.contact_phone) || "—"}</div>
        <div style="color:var(--text-muted);font-size:12px;">${escapeHtml(trip.contact_email) || ""}</div>
      </td>
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

// ---------- Modal ----------

function addTravelerRow(value = "") {
  const row = document.createElement("div");
  row.className = "traveler-row";
  row.innerHTML = `
    <input type="text" class="traveler-input" placeholder="Nombre y apellidos" value="${escapeHtml(value)}">
    <button type="button" class="traveler-remove">&times;</button>
  `;
  row.querySelector(".traveler-remove").addEventListener("click", () => row.remove());
  travelersBox.appendChild(row);
}

function openModal(trip = null) {
  formError.style.display = "none";
  state.editingId = trip ? trip.id : null;
  modalTitle.textContent = trip ? "Editar viaje" : "Nuevo viaje";

  document.getElementById("tripName").value = trip?.name || "";
  document.getElementById("startDate").value = trip?.start_date || "";
  document.getElementById("endDate").value = trip?.end_date || "";
  document.getElementById("contactPerson").value = trip?.contact_person || "";
  document.getElementById("contactPhone").value = trip?.contact_phone || "";
  document.getElementById("contactEmail").value = trip?.contact_email || "";
  document.getElementById("notes").value = trip?.notes || "";

  travelersBox.innerHTML = "";
  if (trip && trip.travelers.length) {
    trip.travelers.forEach((t) => addTravelerRow(t.full_name));
  } else {
    addTravelerRow();
  }

  modalOverlay.classList.add("open");
}

function closeModal() {
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

  const payload = {
    name,
    start_date: document.getElementById("startDate").value || null,
    end_date: document.getElementById("endDate").value || null,
    contact_person: document.getElementById("contactPerson").value.trim(),
    contact_phone: document.getElementById("contactPhone").value.trim(),
    contact_email: document.getElementById("contactEmail").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    travelers,
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
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
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
