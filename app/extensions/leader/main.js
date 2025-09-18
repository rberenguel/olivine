import { config } from "./config.js";

export function activate(app) {
  log.info("leader-key", "Activating Extension");

  let leaderModeActive = false;
  let timeoutId = null;

  const enterLeaderMode = () => {
    leaderModeActive = true;
    document.body.classList.add(config.indicatorClass);
    document.addEventListener("keydown", handleCommandKey);
    timeoutId = setTimeout(exitLeaderMode, config.timeout);
  };

  const exitLeaderMode = () => {
    leaderModeActive = false;
    document.body.classList.remove(config.indicatorClass);
    document.removeEventListener("keydown", handleCommandKey);
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  const handleLeaderKey = (e) => {
    if (e.key === config.leaderKey && e[config.leaderModifier]) {
      e.preventDefault();
      e.stopPropagation();
      enterLeaderMode();
    }
  };

  const handleCommandKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      exitLeaderMode();
      return;
    }

    const commandId = config.commands[e.key];
    if (commandId) {
      e.preventDefault();
      e.stopPropagation();
      app.executeCommand(commandId);
      exitLeaderMode();
    }
  };

  document.addEventListener("keydown", handleLeaderKey);
}
