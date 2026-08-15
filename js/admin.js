/* Admin Dashboard – uses IndexedDB */

const ADMIN_USER = "pekakhawlhring";
const ADMIN_PASS = "Peka@0011";
let currentDetailId = null;

document.addEventListener("DOMContentLoaded", function () {
  if (sessionStorage.getItem("msp_admin_logged_in") === "1") {
    showDashboard();
  }

  document.getElementById("btnLogin").addEventListener("click", attemptLogin);
  document.getElementById("adminPass").addEventListener("keydown", function (e) {
    if (e.key === "Enter") attemptLogin();
  });

  document.getElementById("btnLogout").addEventListener("click", function (e) {
    e.preventDefault();
    sessionStorage.removeItem("msp_admin_logged_in");
    document.getElementById("dashboard").classList.add("hidden");
    document.getElementById("loginScreen").classList.remove("hidden");
  });

  document.getElementById("btnRefresh").addEventListener("click", function () {
    renderStats();
    renderList();
  });

  document.getElementById("searchInput").addEventListener("input", renderList);
  document.getElementById("statusFilter").addEventListener("change", renderList);

  document.getElementById("btnBackToList").addEventListener("click", function () {
    document.getElementById("detailView").classList.add("hidden");
    document.getElementById("listView").classList.remove("hidden");
    document.getElementById("statsView").classList.remove("hidden");
    currentDetailId = null;
  });

  document.getElementById("btnUpdateStatus").addEventListener("click", updateStatus);
});

function attemptLogin() {
  const user = document.getElementById("adminUser").value.trim();
  const pass = document.getElementById("adminPass").value;
  const err = document.getElementById("loginError");

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem("msp_admin_logged_in", "1");
    err.textContent = "";
    showDashboard();
  } else {
    err.textContent = "Invalid username or password.";
  }
}

async function showDashboard() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  try {
    await openDB();
    await renderStats();
    await renderList();
  } catch (err) {
    console.error(err);
    alert("Could not open database. Please refresh the page.");
  }
}

async function renderStats() {
  const apps = await getAllApplications();
  const counts = {
    total: apps.length,
    submitted: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    docsRequired: 0
  };

  apps.forEach(function (a) {
    if (a.status === "Submitted") counts.submitted++;
    else if (a.status === "Under Review") counts.underReview++;
    else if (a.status === "Approved") counts.approved++;
    else if (a.status === "Rejected") counts.rejected++;
    else if (a.status === "Documents Required") counts.docsRequired++;
  });

  const grid = document.getElementById("statsGrid");
  grid.innerHTML = `
    <div class="stat-card"><div class="num">${counts.total}</div><div class="label">Total Applications</div></div>
    <div class="stat-card"><div class="num">${counts.submitted}</div><div class="label">New / Submitted</div></div>
    <div class="stat-card"><div class="num">${counts.underReview}</div><div class="label">Under Review</div></div>
    <div class="stat-card"><div class="num">${counts.docsRequired}</div><div class="label">Documents Required</div></div>
    <div class="stat-card"><div class="num">${counts.approved}</div><div class="label">Approved</div></div>
    <div class="stat-card"><div class="num">${counts.rejected}</div><div class="label">Rejected</div></div>
  `;
}

async function renderList() {
  const apps = await getAllApplications();
  const search = (document.getElementById("searchInput").value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("statusFilter").value;

  let filtered = apps.filter(function (a) {
    if (statusFilter && a.status !== statusFilter) return false;
    if (!search) return true;
    return (
      (a.application_id || "").toLowerCase().includes(search) ||
      (a.full_name || "").toLowerCase().includes(search) ||
      (a.phone_number || "").includes(search) ||
      (a.otr_number || "").toLowerCase().includes(search)
    );
  });

  const tbody = document.getElementById("appsTableBody");
  const noMsg = document.getElementById("noAppsMsg");

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    noMsg.classList.remove("hidden");
    return;
  }
  noMsg.classList.add("hidden");

  tbody.innerHTML = filtered.map(function (a) {
    const statusClass = "status-" + a.status.replace(/ /g, "\\ ");
    return `
      <tr>
        <td><strong>${escapeHtml(a.application_id)}</strong></td>
        <td>${escapeHtml(a.full_name)}</td>
        <td>${escapeHtml(a.phone_number)}</td>
        <td>${escapeHtml(a.present_course)}</td>
        <td>${formatDate(a.created_at)}</td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(a.status)}</span></td>
        <td><button type="button" class="btn btn-outline" style="padding:0.3rem 0.7rem;font-size:0.85rem;" data-id="${escapeHtml(a.application_id)}">View</button></td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("button[data-id]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      openDetail(btn.dataset.id);
    });
  });
}

async function openDetail(appId) {
  const app = await getApplication(appId);
  if (!app) return;

  currentDetailId = appId;

  document.getElementById("statsView").classList.add("hidden");
  document.getElementById("listView").classList.add("hidden");
  document.getElementById("detailView").classList.remove("hidden");

  document.getElementById("detailTitle").textContent = "Application " + app.application_id;

  const info = document.getElementById("detailInfo");
  info.innerHTML = `
    <dt>Application ID</dt><dd>${escapeHtml(app.application_id)}</dd>
    <dt>Full Name</dt><dd>${escapeHtml(app.full_name)}</dd>
    <dt>Phone Number</dt><dd>${escapeHtml(app.phone_number)}</dd>
    <dt>Present Course</dt><dd>${escapeHtml(app.present_course)}</dd>
    <dt>Class Start Date</dt><dd>${escapeHtml(app.class_start_date)}</dd>
    <dt>Roll Number</dt><dd>${escapeHtml(app.roll_number)}</dd>
    <dt>Section</dt><dd>${escapeHtml(app.section || "—")}</dd>
    <dt>OTR Number</dt><dd>${escapeHtml(app.otr_number)}</dd>
    <dt>Status</dt><dd><span class="status-badge status-${app.status.replace(/ /g, "\\ ")}">${escapeHtml(app.status)}</span></dd>
    <dt>Submitted</dt><dd>${formatDate(app.created_at)}</dd>
    <dt>Last Updated</dt><dd>${formatDate(app.updated_at)}</dd>
    <dt>Admin Note</dt><dd>${escapeHtml(app.admin_note || "—")}</dd>
  `;

  // Load actual files from IndexedDB
  const docsEl = document.getElementById("detailDocs");
  const files = await getFilesForApplication(appId);

  if (!files || files.length === 0) {
    docsEl.innerHTML = "<p style='color:var(--muted);'>No documents uploaded.</p>";
  } else {
    docsEl.innerHTML = files.map(function (f) {
      const isImage = (f.type || "").startsWith("image/");
      let preview = "";
      let downloadBtn = "";

      if (f.blob) {
        const url = URL.createObjectURL(f.blob);

        if (isImage) {
          preview = '<img src="' + url + '" alt="' + escapeHtml(f.label) + '" />';
        } else {
          preview = '<div style="height:80px;display:flex;align-items:center;justify-content:center;background:var(--paper-alt);border-radius:4px;color:var(--muted);font-size:0.85rem;">PDF Document</div>';
        }

        downloadBtn = '<a href="' + url + '" download="' + escapeHtml(f.name) + '" class="btn btn-secondary" style="padding:0.3rem 0.6rem;font-size:0.8rem;">Download</a>';
      } else {
        preview = '<div style="height:80px;display:flex;align-items:center;justify-content:center;background:var(--paper-alt);border-radius:4px;color:var(--muted);font-size:0.82rem;">File unavailable</div>';
        downloadBtn = '<span style="font-size:0.78rem;color:var(--muted);">' + escapeHtml(f.name || "") + '</span>';
      }

      return (
        '<div class="doc-preview">' +
          preview +
          '<div class="name">' + escapeHtml(f.label) + '</div>' +
          downloadBtn +
        '</div>'
      );
    }).join("");
  }

  document.getElementById("newStatus").value = app.status;
  document.getElementById("adminNote").value = app.admin_note || "";
  document.getElementById("statusMsg").textContent = "";
}

async function updateStatus() {
  if (!currentDetailId) return;

  const newStatus = document.getElementById("newStatus").value;
  const note = document.getElementById("adminNote").value.trim();

  try {
    await updateApplicationStatus(currentDetailId, newStatus, note);

    document.getElementById("statusMsg").textContent = "Status updated successfully.";
    document.getElementById("statusMsg").style.color = "var(--success)";

    await openDetail(currentDetailId);
    await renderStats();
  } catch (err) {
    console.error(err);
    document.getElementById("statusMsg").textContent = "Failed to update status.";
    document.getElementById("statusMsg").style.color = "var(--error)";
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}
