
function normalizePath(path) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .split("/")
    .filter(part =>
      part && part !== ".."
    )
    .join("/");
}

export class PreviewEngine {
  constructor(frame, onConsole) {
    this.frame = frame;
    this.onConsole = onConsole;

    window.addEventListener("message", event => {
      if (
        event.source !== this.frame.contentWindow ||
        !event.data ||
        event.data.__studio !== true
      ) {
        return;
      }

      this.onConsole(
        event.data.level,
        event.data.args
      );
    });
  }

  render(files) {
    let html = files["index.html"]?.content ||
      `<!doctype html>
<html>
<body>
<h1>No index.html found</h1>
</body>
</html>`;

    const css = [];
    const js = [];

    const resolve = path => {
      const key = normalizePath(path);

      return files[key]?.content ?? null;
    };

    // Resolve local CSS references.
    html = html.replace(
      /<link\b([^>]*?)href=(["'])(.*?)\2([^>]*)>/gi,
      (match, before, quote, url, after) => {
        if (/^(https?:|\/\/|data:|#)/i.test(url)) {
          return match;
        }

        const content = resolve(url);

        if (content === null) {
          return match;
        }

        if (/stylesheet/i.test(before + after)) {
          css.push(content);
          return "";
        }

        return match;
      }
    );

    // Resolve local JavaScript references.
    html = html.replace(
      /<script\b([^>]*?)src=(["'])(.*?)\2([^>]*)>\s*<\/script>/gi,
      (match, before, quote, url, after) => {
        if (/^(https?:|\/\/|data:|#)/i.test(url)) {
          return match;
        }

        const content = resolve(url);

        if (content === null) {
          return match;
        }

        js.push(content);

        return "";
      }
    );

    const bridge = `
<script>
(function() {
  function serialize(value) {
    try {
      if (typeof value === "string") return value;
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function send(level, args) {
    parent.postMessage({
      __studio: true,
      level,
      args: Array.from(args).map(serialize)
    }, "*");
  }

  ["log", "warn", "error", "info", "debug"].forEach(level => {
    const original = console[level];

    console[level] = function() {
      send(level, arguments);
      original.apply(console, arguments);
    };
  });

  addEventListener("error", event => {
    send("error", [
      event.message +
      " (" +
      event.filename +
      ":" +
      event.lineno +
      ")"
    ]);
  });

  addEventListener("unhandledrejection", event => {
    send("error", [
      "Unhandled rejection",
      event.reason
    ]);
  });
})();
</script>`;

    const injectedCSS = css.length
      ? `<style>${css.join("\n")}</style>`
      : "";

    const injectedJS = js.map(source => {
      return `<script>${source.replace(
        /<\/script/gi,
        "<\\/script"
      )}<\/script>`;
    }).join("\n");

    const headInjection =
      injectedCSS + bridge;

    if (/<\/head>/i.test(html)) {
      html = html.replace(
        /<\/head>/i,
        headInjection + "</head>"
      );
    } else {
      html = headInjection + html;
    }

    if (injectedJS) {
      if (/<\/body>/i.test(html)) {
        html = html.replace(
          /<\/body>/i,
          injectedJS + "</body>"
        );
      } else {
        html += injectedJS;
      }
    }

    this.frame.srcdoc = html;
  }

  refresh(files) {
    this.render(files);
  }
}
