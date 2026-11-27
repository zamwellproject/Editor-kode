
const DB_NAME = "studio-browser-ide";
const DB_VERSION = 1;
const STORE = "projects";

function createStarterProject() {
  return {
    id: crypto.randomUUID(),
    name: "Starter Project",
    updatedAt: Date.now(),
    files: {
      "index.html": {
        type: "file",
        content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Starter Project</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main class="card">
    <h1>Hello, world.</h1>
    <p>Your browser IDE is ready.</p>
    <button id="action">Test interaction</button>
    <p id="message"></p>
  </main>
  <script src="./script.js"><\/script>
</body>
</html>`
      },

      "styles.css": {
        type: "file",
        content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f1f4f8;
  color: #172033;
  font-family: system-ui, sans-serif;
}

.card {
  max-width: 520px;
  padding: 48px;
  background: white;
  border-radius: 18px;
}

button {
  padding: 10px 15px;
  background: #172033;
  color: white;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
}`
      },

      "script.js": {
        type: "file",
        content: `document
  .querySelector("#action")
  .addEventListener("click", () => {
    document.querySelector("#message").textContent =
      "JavaScript is running successfully.";

    console.log("Interaction tested");
  });`
      },

      "data.json": {
        type: "file",
        content: `{
  "name": "Starter Project",
  "version": 1
}`
      }
    }
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class ProjectStore {
  constructor() {
    this.db = null;
    this.fallback = false;
  }

  async init() {
    if (!("indexedDB" in window)) {
      this.fallback = true;
      return;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;

          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, {
              keyPath: "id"
            });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn("IndexedDB unavailable:", error);
      this.fallback = true;
    }
  }

  async all() {
    if (this.fallback) {
      return JSON.parse(
        localStorage.getItem(DB_NAME) || "[]"
      );
    }

    return requestToPromise(
      this.db.transaction(STORE, "readonly")
        .objectStore(STORE)
        .getAll()
    );
  }

  async get(id) {
    if (this.fallback) {
      const projects = await this.all();
      return projects.find(p => p.id === id) || null;
    }

    return requestToPromise(
      this.db.transaction(STORE, "readonly")
        .objectStore(STORE)
        .get(id)
    );
  }

  async put(project) {
    project.updatedAt = Date.now();

    if (this.fallback) {
      const projects = await this.all();

      const index = projects.findIndex(
        p => p.id === project.id
      );

      if (index === -1) {
        projects.push(project);
      } else {
        projects[index] = project;
      }

      localStorage.setItem(
        DB_NAME,
        JSON.stringify(projects)
      );

      return project;
    }

    await requestToPromise(
      this.db.transaction(STORE, "readwrite")
        .objectStore(STORE)
        .put(project)
    );

    return project;
  }

  async remove(id) {
    if (this.fallback) {
      const projects = await this.all();

      localStorage.setItem(
        DB_NAME,
        JSON.stringify(
          projects.filter(p => p.id !== id)
        )
      );

      return;
    }

    return requestToPromise(
      this.db.transaction(STORE, "readwrite")
        .objectStore(STORE)
        .delete(id)
    );
  }

  async ensureStarter() {
    let projects = await this.all();

    if (projects.length === 0) {
      const starter = createStarterProject();

      await this.put(starter);
      projects = [starter];
    }

    return projects;
  }
}

export function cloneProject(
  project,
  name = project.name + " Copy"
) {
  return {
    ...structuredClone(project),
    id: crypto.randomUUID(),
    name,
    updatedAt: Date.now()
  };
}
