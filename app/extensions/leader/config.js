export const config = {
  leaderKey: "p",
  leaderModifier: "ctrlKey", // "ctrlKey", "metaKey", "altKey", "shiftKey"
  timeout: 1000,
  indicatorClass: "leader-mode-active",
  commands: {
    "|": "core:split-vertically",
    "-": "core:split-horizontally",
  },
};
