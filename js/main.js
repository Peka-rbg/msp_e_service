/* Shared utilities for MSP e-SERVICES */

// Mobile hamburger menu
document.addEventListener("DOMContentLoaded", function () {
  const hamburger = document.getElementById("hamburger");
  const mobileNav = document.getElementById("mobileNav");

  if (hamburger && mobileNav) {
    hamburger.addEventListener("click", function () {
      mobileNav.classList.toggle("open");
    });
  }
});

/* ---------- Storage helpers ---------- */
const STORAGE_KEY = "msp_applications";
const COUNTER_KEY = "msp_app_counter";

function getApplications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveApplications(apps) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (e) {
    // Re-throw so callers can fall back to metadata-only storage
    if (e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22)) {
      throw e;
    }
    // For other errors still throw
    throw e;
  }
}

function generateApplicationId() {
  let counter = parseInt(localStorage.getItem(COUNTER_KEY) || "0", 10);
  counter += 1;
  localStorage.setItem(COUNTER_KEY, String(counter));
  return "MSP-SCH-" + String(counter).padStart(6, "0");
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