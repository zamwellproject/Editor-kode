
export async function exportProject(project) {
  if (!window.JSZip) {
    throw new Error(
      "JSZip is unavailable. Check your internet connection."
    );
  }

  const zip = new JSZip();

  for (const [path, node] of Object.entries(project.files)) {
    if (node.type === "file") {
      zip.file(path, node.content || "");
    }
  }

  zip.file(
    "README.txt",
    `Project: ${project.name}

Exported from Studio Browser IDE.

Open index.html in a browser or deploy
this folder to GitHub Pages.`
  );

  const blob = await zip.generateAsync({
    type: "blob"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    (project.name || "project")
      .replace(/[^\w-]+/g, "-") +
    ".zip";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function importFiles(fileList, project) {
  const files = Array.from(fileList);

  for (const file of files) {
    const rawPath = file.webkitRelativePath || file.name;

    const parts = rawPath
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean);

    if (file.webkitRelativePath) {
      parts.shift();
    }

    const path = parts.join("/");

    if (!path) continue;

    // Basic path traversal protection.
    if (
      path.startsWith("/") ||
      parts.includes("..")
    ) {
      console.warn("Skipped unsafe path:", path);
      continue;
    }

    project.files[path] = {
      type: "file",
      content: await file.text()
    };
  }

  return project;
}
