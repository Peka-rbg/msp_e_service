/* Multi-step Tribal Scholarship Application Form
   Uses IndexedDB for reliable storage of images & PDFs
*/

const REQUIRED_DOCS = [
  { key: "aadhaarFront", label: "Aadhaar Card — Front" },
  { key: "aadhaarBack", label: "Aadhaar Card — Back" },
  { key: "hslc", label: "HSLC Mark Sheet" },
  { key: "hsslc", label: "HSSLC Mark Sheet" },
  { key: "income", label: "Income Certificate" },
  { key: "tribal", label: "Tribal Certificate" }
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".pdf"];

let currentStep = 1;
let formData = {
  fullName: "",
  phone: "",
  course: "",
  startDate: "",
  rollNumber: "",
  section: "",
  otrNumber: ""
};

// key -> { label, name, size, type, blob }
let uploadedFiles = {};

document.addEventListener("DOMContentLoaded", function () {
  buildUploadCards();
  bindEvents();
});

function buildUploadCards() {
  const grid = document.getElementById("uploadGrid");
  grid.innerHTML = "";

  REQUIRED_DOCS.forEach(function (doc) {
    const card = document.createElement("div");
    card.className = "upload-card";
    card.id = "card-" + doc.key;
    card.innerHTML = `
      <h3>${doc.label} <span class="req">*</span></h3>
      <div class="file-input-wrapper">
        <button type="button" class="file-btn">Choose File</button>
        <input type="file" id="file-${doc.key}" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" />
      </div>
      <div class="file-name" id="fname-${doc.key}"></div>
      <div class="hint">JPG, PNG or PDF · Max 5 MB</div>
      <span class="error-msg" id="err-${doc.key}"></span>
    `;
    grid.appendChild(card);

    const input = card.querySelector("input[type=file]");
    input.addEventListener("change", function (e) {
      handleFileSelect(doc.key, doc.label, e.target.files[0]);
    });
  });
}

function handleFileSelect(key, label, file) {
  const errEl = document.getElementById("err-" + key);
  const fnameEl = document.getElementById("fname-" + key);
  const card = document.getElementById("card-" + key);
  errEl.textContent = "";

  if (!file) {
    delete uploadedFiles[key];
    fnameEl.textContent = "";
    card.classList.remove("has-file");
    return;
  }

  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext)) {
    errEl.textContent = "Unsupported file type. Use JPG, PNG or PDF.";
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    errEl.textContent = "File is too large. Maximum size is 5 MB.";
    return;
  }

  // Store the actual File/Blob – no base64 conversion needed
  uploadedFiles[key] = {
    label: label,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    blob: file
  };

  fnameEl.textContent = file.name;
  card.classList.add("has-file");
}

function bindEvents() {
  document.getElementById("btnToStep2").addEventListener("click", function () {
    if (validateStep1()) {
      collectStep1();
      goToStep(2);
    }
  });

  document.getElementById("btnBack1").addEventListener("click", function () {
    goToStep(1);
  });

  document.getElementById("btnToStep3").addEventListener("click", function () {
    if (validateStep2()) {
      populateReview();
      goToStep(3);
    }
  });

  document.getElementById("btnBack2").addEventListener("click", function () {
    goToStep(2);
  });

  document.getElementById("scholarshipForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (validateStep3()) {
      submitApplication();
    }
  });
}

function goToStep(step) {
  currentStep = step;
  document.querySelectorAll(".form-step").forEach(function (el) {
    el.classList.add("hidden");
  });
  document.getElementById("step" + step).classList.remove("hidden");

  document.querySelectorAll(".progress-step").forEach(function (el) {
    const s = parseInt(el.dataset.step, 10);
    el.classList.remove("active", "done");
    if (s === step) el.classList.add("active");
    else if (s < step) el.classList.add("done");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Validation ---------- */
function validateStep1() {
  let valid = true;
  const fields = [
    { id: "fullName", msg: "Full Name is required." },
    { id: "phone", msg: "Phone Number is required." },
    { id: "course", msg: "Present Course is required." },
    { id: "startDate", msg: "Class Start Date is required." },
    { id: "rollNumber", msg: "Roll Number is required." },
    { id: "otrNumber", msg: "OTR Number is required." }
  ];

  fields.forEach(function (f) {
    const el = document.getElementById(f.id);
    const err = document.getElementById("err-" + f.id);
    const val = (el.value || "").trim();
    el.classList.remove("error");
    err.textContent = "";

    if (!val) {
      el.classList.add("error");
      err.textContent = f.msg;
      valid = false;
      return;
    }

    if (f.id === "phone") {
      const digits = val.replace(/\D/g, "");
      if (digits.length < 10) {
        el.classList.add("error");
        err.textContent = "Enter a valid 10-digit phone number.";
        valid = false;
      }
    }

    if (f.id === "startDate") {
      const d = new Date(val);
      if (isNaN(d.getTime())) {
        el.classList.add("error");
        err.textContent = "Enter a valid date.";
        valid = false;
      }
    }
  });

  return valid;
}

function validateStep2() {
  let valid = true;
  REQUIRED_DOCS.forEach(function (doc) {
    const err = document.getElementById("err-" + doc.key);
    err.textContent = "";
    if (!uploadedFiles[doc.key]) {
      err.textContent = "This document is required.";
      valid = false;
    }
  });
  return valid;
}

function validateStep3() {
  const check = document.getElementById("confirmCheck");
  const err = document.getElementById("err-confirm");
  err.textContent = "";
  if (!check.checked) {
    err.textContent = "You must confirm that the information is accurate.";
    return false;
  }
  return true;
}

function collectStep1() {
  formData.fullName = document.getElementById("fullName").value.trim();
  formData.phone = document.getElementById("phone").value.trim().replace(/\D/g, "");
  formData.course = document.getElementById("course").value.trim();
  formData.startDate = document.getElementById("startDate").value;
  formData.rollNumber = document.getElementById("rollNumber").value.trim();
  formData.section = document.getElementById("section").value.trim();
  formData.otrNumber = document.getElementById("otrNumber").value.trim();
}

function populateReview() {
  const info = document.getElementById("reviewInfo");
  info.innerHTML = `
    <dt>Full Name</dt><dd>${escapeHtml(formData.fullName)}</dd>
    <dt>Phone Number</dt><dd>${escapeHtml(formData.phone)}</dd>
    <dt>Present Course</dt><dd>${escapeHtml(formData.course)}</dd>
    <dt>Class Start Date</dt><dd>${escapeHtml(formData.startDate)}</dd>
    <dt>Roll Number</dt><dd>${escapeHtml(formData.rollNumber)}</dd>
    <dt>Section</dt><dd>${escapeHtml(formData.section || "—")}</dd>
    <dt>OTR Number</dt><dd>${escapeHtml(formData.otrNumber)}</dd>
  `;

  const docs = document.getElementById("reviewDocs");
  docs.innerHTML = REQUIRED_DOCS.map(function (doc) {
    const f = uploadedFiles[doc.key];
    return `<li><span class="check">✓</span> ${escapeHtml(doc.label)} — <em>${escapeHtml(f.name)}</em></li>`;
  }).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Submit using IndexedDB ---------- */
async function submitApplication() {
  const btn = document.getElementById("btnSubmit");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  try {
    await openDB();

    const application = await submitScholarshipApplication(formData, uploadedFiles);

    setTimeout(function () {
      window.location.href = "success.html?id=" + encodeURIComponent(application.application_id);
    }, 350);

  } catch (err) {
    console.error("Submit error:", err);
    btn.disabled = false;
    btn.textContent = "Submit Application";
    alert("Something went wrong while submitting.\n\n" + (err.message || "Please try again."));
  }
}