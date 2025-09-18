export function activate(app) {
  const overlay = document.createElement("div");
  overlay.id = "privacy-blur-overlay";
  document.body.appendChild(overlay);

  const showOverlay = () => overlay.classList.add("visible");
  const hideOverlay = () => overlay.classList.remove("visible");

  window.addEventListener("blur", showOverlay);
  window.addEventListener("focus", hideOverlay);

  // Use the new, direct API
  app.ui.addHeaderIcon({
    icon: "eye", // API handles adding "iconoir iconoir-" prefix
    onClick: () => {
      overlay.classList.toggle("visible");
    },
  });

  overlay.addEventListener("click", hideOverlay);
}
