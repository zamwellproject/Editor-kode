
import {
  ProjectStore,
  cloneProject
} from "./storage.js";

import {
  EditorController
} from "./editor.js";

import {
  PreviewEngine
} from "./preview.js";

import {
  exportProject,
  importFiles
} from "./exporter.js";

const $ = selector =>
  document.querySelector(selector);

const store = new ProjectStore();

let projects = [];
let project = null;
let activePath = null;

let tabs = [];
let dirty = new Set();

let saveTimer = null;
let previewTimer = null;

const editor = new EditorController(
  $("#codeEditor"),

  value => {
    if (!project || !activePath) return;

    project.files[activePath].content = value;

    dirty.add(activePath);

    renderTabs();

    $("#saveStatus").textContent =
      "Unsaved changes";

    scheduleSave();
    schedulePreview();
  },

  (line, col) => {
    $("#cursorStatus").textContent =
      `Ln ${line}, Col ${col}`;
  }
);

const preview = new PreviewEngine(
  $("#previewFrame"),

  (level, args) => {
    const line = document.createElement("div");

    line.className =
      "console-line " +
      (level === "error"
        ? "error"
        : level === "warn"
          ? "warn"
          : "");

    line.textContent =
      `${level.toUpperCase()}  ${args.join(" ")}`;

    $("#consoleOutput").append(line);

    $("#consoleOutput").scrollTop =
      $("#consoleOutput").scrollHeight;
  }
);

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// STORAGE

function scheduleSave() {
  clearTimeout(saveTimer);

  saveTimer = setTimeout(async () => {
    if (!project) return;

    try {
      await store.put(project);

      dirty.clear();

      renderTabs();

      $("#saveStatus").textContent =
        "Saved locally";
    } catch (error) {
      console.error("Save failed:", error);

      $("#saveStatus").textContent =
        "Save failed";
    }
  }, 350);
}

function schedulePreview() {
  clearTimeout(previewTimer);

  previewTimer = setTimeout(() => {
    renderPreview();
  }, 450);
}

function renderPreview() {
  if (project) {
    preview.render(project.files);
  }
}

// PROJECT MANAGEMENT

function renderProjects() {
  const select = $("#projectSelect");

  select.innerHTML = "";

  projects.forEach(item => {
    const option = document.createElement("option");

    option.value = item.id;
    option.textContent = item.name;

    select.append(option);
  });
}

function selectProject(id) {
  project = projects.find(
    item => item.id === id
  ) || projects[0];

  if (!project) return;

  tabs = [];
  dirty.clear();
  activePath = null;

  $("#projectSelect").value = project.id;
  $("#projectMeta").textContent = project.name;

  renderTree();
  renderTabs();

  const firstFile =
    Object.keys(project.files).find(
      path => path === "index.html"
    ) ||
    Object.keys(project.files).find(
      path => project.files[path].type === "file"
    );

  if (firstFile) {
    openFile(firstFile);
  } else {
    editor.setValue("");
    renderPreview();
  }
}

async function createProject() {
  const name = await ask(
    "New project",
    "Create a new browser project.",
    "Project name"
  );

  if (!name) return;

  const newProject = {
    id: crypto.randomUUID(),
    name,
    updatedAt: Date.now(),

    files: {
      "index.html": {
        type: "file",
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHTML(name)}</title>
</head>
<body>

</body>
</html>`
      }
    }
  };

  projects.push(newProject);

  await store.put(newProject);

  renderProjects();
  selectProject(newProject.id);
}

async function renameProject() {
  const name = await ask(
    "Rename project",
    "Choose a new project name.",
    "Project name",
    project.name
  );

  if (!name) return;

  project.name = name;

  await store.put(project);

  renderProjects();

  $("#projectSelect").value = project.id;
  $("#projectMeta").textContent = name;
}

async function duplicateProject() {
  const name = await ask(
    "Duplicate project",
    "A separate copy will be created.",
    "Copy name",
    project.name + " Copy"
  );

  if (!name) return;

  const copy = cloneProject(project, name);

  projects.push(copy);

  await store.put(copy);

  renderProjects();
  selectProject(copy.id);
}

async function deleteProject() {
  if (!confirm(
    `Delete project "${project.name}" and all its files?`
  )) return;

  await store.remove(project.id);

  projects = projects.filter(
    item => item.id !== project.id
  );

  if (!projects.length) {
    projects = await store.ensureStarter();
  }

  renderProjects();
  selectProject(projects[0].id);
}

// FILE TREE

function renderTree() {
  const root = $("#fileTree");

  root.innerHTML = "";

  const folders = new Set();

  Object.keys(project.files).forEach(path => {
    const parts = path.split("/");

    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  });

  const entries = [
    ...[...folders].map(path => ({
      path,
      folder: true
    })),

    ...Object.keys(project.files)
      .filter(path => !path.endsWith("/.keep"))
      .map(path => ({
        path,
        folder: false
      }))
  ].sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  entries.forEach(({ path, folder }) => {
    const depth = path.split("/").length - 1;

    const row = document.createElement("div");

    row.className =
      "tree-row" +
      (!folder && path === activePath
        ? " active"
        : "");

    row.style.paddingLeft =
      (8 + depth * 14) + "px";

    row.innerHTML = `
      <span>${folder ? "▱" : "◇"}</span>

      <span class="file-name">
        ${escapeHTML(path.split("/").pop())}
      </span>

      <span class="tree-actions">
        <button title="Rename">↗</button>
        <button title="Duplicate">＋</button>
        <button title="Delete">×</button>
      </span>
    `;

    row.addEventListener("click", event => {
      if (event.target.tagName === "BUTTON") {
        event.stopPropagation();

        const action = event.target.title;

        if (action === "Rename") {
          folder
            ? renameFolder(path)
            : renameFile(path);
        }

        if (action === "Duplicate") {
          duplicateEntry(path, folder);
        }

        if (action === "Delete") {
          folder
            ? deleteFolder(path)
            : deleteFile(path);
        }
      } else if (!folder) {
        openFile(path);
      }
    });

    root.append(row);
  });
}

// TABS

function renderTabs() {
  const bar = $("#tabbar");

  bar.innerHTML = "";

  tabs.forEach(path => {
    const tab = document.createElement("div");

    tab.className =
      "tab" +
      (path === activePath ? " active" : "");

    tab.innerHTML = `
      <span>${escapeHTML(path.split("/").pop())}</span>

      ${dirty.has(path)
        ? '<i class="dirty"></i>'
        : ""}

      <button aria-label="Close tab">×</button>
    `;

    tab.addEventListener("click", event => {
      if (event.target.tagName === "BUTTON") {
        tabs = tabs.filter(item => item !== path);

        if (activePath === path) {
          activePath = null;

          const next = tabs[tabs.length - 1];

          if (next) {
            openFile(next);
          } else {
            editor.setValue("");
            $("#fileStatus").textContent = "No file open";
          }
        }

        renderTabs();
      } else {
        openFile(path);
      }
    });

    bar.append(tab);
  });
}

function openFile(path) {
  const file = project.files[path];

  if (!file || file.type !== "file") return;

  activePath = path;

  if (!tabs.includes(path)) {
    tabs.push(path);
  }

  editor.setValue(file.content || "");
  editor.setFile(path);

  $("#fileStatus").textContent = path;

  renderTabs();
  renderTree();

  editor.refresh();
}

// DIALOG

function ask(title, hint, placeholder, initial = "") {
  return new Promise(resolve => {
    const dialog = $("#simpleDialog");

    $("#dialogTitle").textContent = title;
    $("#dialogHint").textContent = hint;

    $("#dialogInput").value = initial;
    $("#dialogInput").placeholder = placeholder;

    const done = () => {
      resolve(
        dialog.returnValue === "ok"
          ? $("#dialogInput").value.trim()
          : null
      );
    };

    dialog.addEventListener(
      "close",
      done,
      { once: true }
    );

    dialog.showModal();

    $("#dialogInput").focus();
  });
}

// FILE OPERATIONS

async function newFile() {
  const path = await ask(
    "New file",
    "Use a relative path, e.g. pages/about.html",
    "filename.ext"
  );

  if (!path) return;

  if (path.startsWith("/") || path.split("/").includes("..")) {
    alert("Invalid file path.");
    return;
  }

  if (project.files[path]) {
    alert("File already exists.");
    return;
  }

  project.files[path] = {
    type: "file",
    content: ""
  };

  await store.put(project);

  renderTree();
  openFile(path);
}

async function newFolder() {
  const path = await ask(
    "New folder",
    "Enter a folder name or relative path.",
    "folder name"
  );

  if (!path) return;

  if (path.startsWith("/") || path.split("/").includes("..")) {
    alert("Invalid folder path.");
    return;
  }

  const folder = path.replace(/\/+$/, "");

  if (!folder) return;

  project.files[folder + "/.keep"] = {
    type: "file",
    content: ""
  };

  await store.put(project);

  renderTree();
}

async function renameFile(path) {
  const next = await ask(
    "Rename file",
    "Enter the new relative path.",
    "new-name",
    path
  );

  if (!next || next === path) return;

  if (
    next.startsWith("/") ||
    next.split("/").includes("..") ||
    project.files[next]
  ) {
    alert("Invalid or existing destination.");
    return;
  }

  project.files[next] = project.files[path];

  delete project.files[path];

  tabs = tabs.map(item =>
    item === path ? next : item
  );

  if (activePath === path) {
    activePath = next;
  }

  await store.put(project);

  renderTree();
  renderTabs();

  if (activePath === next) {
    openFile(next);
  }
}

async function renameFolder(path) {
  const next = await ask(
    "Rename folder",
    "Enter the new folder path.",
    "folder name",
    path
  );

  if (!next || next === path) return;

  if (
    next.startsWith("/") ||
    next.split("/").includes("..") ||
    Object.keys(project.files).some(
      key => key === next || key.startsWith(next + "/")
    )
  ) {
    alert("Invalid or existing destination.");
    return;
  }

  const affected = Object.keys(project.files)
    .filter(key => key.startsWith(path + "/"));

  for (const old of affected) {
    const target = next + old.slice(path.length);

    project.files[target] = project.files[old];

    delete project.files[old];
  }

  tabs = tabs.map(tab =>
    tab.startsWith(path + "/")
      ? next + tab.slice(path.length)
      : tab
  );

  if (activePath?.startsWith(path + "/")) {
    activePath = next + activePath.slice(path.length);
  }

  await store.put(project);

  renderTree();
  renderTabs();

  if (activePath) openFile(activePath);
}

async function duplicateEntry(path, folder) {
  const base = path + " Copy";

  let target = base;
  let count = 2;

  const exists = name =>
    Object.keys(project.files).some(
      key => key === name || key.startsWith(name + "/")
    );

  while (exists(target)) {
    target = base + " " + count++;
  }

  const affected = folder
    ? Object.keys(project.files).filter(
        key => key.startsWith(path + "/")
      )
    : [path];

  affected.forEach(old => {
    const next = target + old.slice(path.length);

    project.files[next] =
      structuredClone(project.files[old]);
  });

  await store.put(project);

  renderTree();
}

async function deleteFile(path) {
  if (!confirm(`Delete ${path}?`)) return;

  delete project.files[path];

  tabs = tabs.filter(item => item !== path);
  dirty.delete(path);

  if (activePath === path) {
    activePath = null;

    editor.setValue("");

    $("#fileStatus").textContent = "No file open";
  }

  await store.put(project);

  renderTree();
  renderTabs();
  renderPreview();
}

async function deleteFolder(path) {
  if (!confirm(
    `Delete folder "${path}" and all its contents?`
  )) return;

  const affected = Object.keys(project.files)
    .filter(key => key.startsWith(path + "/"));

  affected.forEach(key => delete project.files[key]);

  tabs = tabs.filter(
    tab => !tab.startsWith(path + "/")
  );

  dirty.forEach(tab => {
    if (tab.startsWith(path + "/")) {
      dirty.delete(tab);
    }
  });

  if (activePath?.startsWith(path + "/")) {
    activePath = null;
    editor.setValue("");

    $("#fileStatus").textContent = "No file open";
  }

  await store.put(project);

  renderTree();
  renderTabs();
  renderPreview();
}

// EVENT LISTENERS

$("#newFile").onclick = newFile;
$("#newFolder").onclick = newFolder;

$("#newProject").onclick = createProject;

$("#renameProject").onclick = renameProject;

$("#duplicateProject").onclick = duplicateProject;

$("#deleteProject").onclick = deleteProject;

$("#projectSelect").onchange = event => {
  if (project) {
    store.put(project);
  }

  selectProject(event.target.value);
};

$("#exportBtn").onclick = () => {
  exportProject(project).catch(error => {
    alert(error.message);
  });
};

$("#importBtn").onclick = () => {
  $("#fileInput").click();
};

$("#fileInput").onchange = async event => {
  try {
    await importFiles(event.target.files, project);

    await store.put(project);

    renderTree();
    renderPreview();
  } catch (error) {
    alert("Import failed: " + error.message);
  }

  event.target.value = "";
};

$("#refreshPreview").onclick = renderPreview;

$("#clearConsole").onclick = () => {
  $("#consoleOutput").replaceChildren();
};

document.querySelectorAll(".mode-btn").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".mode-btn").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $("#workbench").className =
      "workbench mode-" + button.dataset.mode;

    editor.refresh();
  };
});

$("#viewportSelect").onchange = event => {
  $("#previewFrame").style.width =
    event.target.value;
};

$("#quickbar").addEventListener("click", event => {
  const button = event.target.closest(
    "button[data-insert]"
  );

  if (button) {
    editor.insert(
      button.dataset.insert
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&quot;/g, '"')
    );
  }
});

$("#snippetSelect").onchange = event => {
  editor.insertSnippet(event.target.value);

  event.target.value = "";
};

$("#settingsBtn").onclick = () => {
  $("#settingsDialog").showModal();
};

$("#editorTheme").onchange = event => {
  editor.setTheme(event.target.value);

  document.body.classList.toggle(
    "light",
    event.target.value === "default"
  );
};

$("#fontSize").onchange = event => {
  editor.setFontSize(event.target.value);
};

$("#sidebarToggle").onclick = () => {
  $("#sidebar").classList.toggle("open");
};

// KEYBOARD SHORTCUTS

document.addEventListener("keydown", event => {
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();

    if (project) {
      clearTimeout(saveTimer);

      store.put(project).then(() => {
        dirty.clear();

        renderTabs();

        $("#saveStatus").textContent =
          "Saved locally";
      }).catch(error => {
        console.error(error);

        $("#saveStatus").textContent =
          "Save failed";
      });
    }
  }
});

// INITIALIZATION

async function init() {
  await store.init();

  projects = await store.ensureStarter();

  renderProjects();

  selectProject(projects[0].id);

  $("#saveStatus").textContent =
    store.fallback
      ? "LocalStorage ready"
      : "IndexedDB ready";
}

window.addEventListener("beforeunload", event => {
  if (dirty.size) {
    event.preventDefault();
    event.returnValue = "";
  }
});

init().catch(error => {
  console.error("Application initialization failed:", error);

  alert("Unable to initialize Studio IDE.");
});

