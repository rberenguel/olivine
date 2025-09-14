// remote-bridge.js

// A helper to make API calls to our Go backend.
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`/api/${endpoint}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  // For write operations, success response might not have a body
  if (
    response.headers.get("Content-Length") === "0" ||
    response.status === 204
  ) {
    return { success: true };
  }
  const data = await response.json();
  // The readFile endpoint returns { content: "..." }, so we extract it.
  if (data && typeof data.content !== "undefined") {
    return data.content;
  }
  return data;
}

export function getInitialFiles() {
  return apiFetch("files");
}

export function readFile(path) {
  return apiFetch(`files/read?path=${encodeURIComponent(path)}`);
}

export function writeFile(path, content) {
  return apiFetch("files/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
}

export function createNewFile(path) {
  return apiFetch("files/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function renameFile(oldPath, newPath) {
  return apiFetch("files/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPath, newPath }),
  });
}
