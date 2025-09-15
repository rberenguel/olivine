export function activate(app) {
  log.info("privacy", "Activating Extension");
  // 1. Create the overlay element once
  const overlay = document.createElement("div");
  overlay.id = "privacy-blur-overlay";

  // 2. Append it to the body, it will be hidden by the CSS initially
  document.body.appendChild(overlay);

  // 3. Add event listeners to the window
  window.addEventListener("blur", () => {
    // When the window loses focus, show the overlay
    overlay.classList.add("visible");
  });

  window.addEventListener("focus", () => {
    // When the window gains focus, hide the overlay
    overlay.classList.remove("visible");
  });
  // TODO: offer this as an API
  const header = document.getElementById("sidebar-header");
  const span = document.createElement("span");
  span.className = "iconoir iconoir-eye";
  header.appendChild(span);
  span.addEventListener("click", () => {
    overlay.classList.toggle("visible");
  });
  overlay.addEventListener("click", () => {
    overlay.classList.remove("visible");
  });
}
