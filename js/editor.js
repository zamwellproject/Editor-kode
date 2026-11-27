
const snippets = {
  html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page title</title>
</head>
<body>

</body>
</html>`,

  log: `console.log("value", value);`,

  media: `@media (max-width: 768px) {
  
}`,

  fetch: `async function loadData() {
  try {
    const response = await fetch("./data.json");

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = await response.json();

    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

loadData();`
};

export class EditorController {
  constructor(textarea, onChange, onCursor) {
    this.cm = CodeMirror.fromTextArea(textarea, {
      lineNumbers: true,

      mode: "htmlmixed",

      theme: "material-darker",

      lineWrapping: false,

      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,

      autoCloseBrackets: true,
      matchBrackets: true,

      foldGutter: true,

      gutters: [
        "CodeMirror-linenumbers",
        "CodeMirror-foldgutter"
      ],

      extraKeys: {
        "Ctrl-Space": "autocomplete",

        "Ctrl-F": "find",
        "Cmd-F": "find",

        "Ctrl-H": "replace",
        "Cmd-H": "replace",

        "Ctrl-S": () => {},

        "Tab": cm => {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else {
            cm.replaceSelection("  ", "end");
          }
        }
      }
    });

    this.cm.on("change", () => {
      onChange(this.cm.getValue());
    });

    this.cm.on("cursorActivity", () => {
      const cursor = this.cm.getCursor();

      onCursor(
        cursor.line + 1,
        cursor.ch + 1
      );
    });
  }

  setValue(value) {
    if (this.cm.getValue() !== value) {
      this.cm.setValue(value);
    }

    this.cm.clearHistory();
  }

  setFile(path) {
    const extension = path
      .split(".")
      .pop()
      .toLowerCase();

    const modes = {
      html: "htmlmixed",
      htm: "htmlmixed",
      css: "css",
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      json: {
        name: "javascript",
        json: true
      },
      md: "markdown",
      markdown: "markdown"
    };

    this.cm.setOption(
      "mode",
      modes[extension] || "text/plain"
    );
  }

  insert(value) {
    this.cm.replaceSelection(value, "end");
    this.cm.focus();
  }

  insertSnippet(name) {
    if (snippets[name]) {
      this.insert(snippets[name]);
    }
  }

  setTheme(theme) {
    this.cm.setOption("theme", theme);
  }

  setFontSize(size) {
    document.documentElement.style.setProperty(
      "--font",
      size + "px"
    );

    this.refresh();
  }

  refresh() {
    this.cm.refresh();
  }

  focus() {
    this.cm.focus();
  }

  getValue() {
    return this.cm.getValue();
  }
}

export function languageFor(path) {
  return path.split(".").pop().toLowerCase();
}
