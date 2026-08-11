/* ============================================================
   Journal index and Markdown reader.
   Entries live in journal/entries.json and journal/*.md.
   ============================================================ */
(function () {
  "use strict";

  var list = document.getElementById("journalList");
  var dialog = document.getElementById("journalDialog");
  var dialogTitle = document.getElementById("journalDialogTitle");
  var dialogDate = document.getElementById("journalDialogDate");
  var dialogContent = document.getElementById("journalDialogContent");
  var closeButton = document.getElementById("journalDialogClose");
  var entries = [];

  if (!list || !dialog || !dialogTitle || !dialogDate || !dialogContent) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function renderMarkdown(markdown) {
    var lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    var html = [];
    var paragraph = [];
    var inList = false;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
      paragraph = [];
    }

    function closeList() {
      if (!inList) return;
      html.push("</ul>");
      inList = false;
    }

    lines.forEach(function (line) {
      var heading = line.match(/^(#{1,3})\s+(.+)$/);
      var item = line.match(/^[-*]\s+(.+)$/);
      var quote = line.match(/^>\s?(.*)$/);

      if (!line.trim()) {
        flushParagraph();
        closeList();
      } else if (heading) {
        flushParagraph();
        closeList();
        var level = Math.min(heading[1].length + 1, 4);
        html.push("<h" + level + ">" + inlineMarkdown(heading[2]) + "</h" + level + ">");
      } else if (item) {
        flushParagraph();
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push("<li>" + inlineMarkdown(item[1]) + "</li>");
      } else if (quote) {
        flushParagraph();
        closeList();
        html.push("<blockquote>" + inlineMarkdown(quote[1]) + "</blockquote>");
      } else {
        closeList();
        paragraph.push(line.trim());
      }
    });

    flushParagraph();
    closeList();
    return html.join("");
  }

  function currentLanguage() {
    return document.documentElement.getAttribute("data-lang") === "zh" ? "zh" : "en";
  }

  function displayDate(date, lang) {
    var parts = date.split("-");
    if (lang === "zh") return parts[0] + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
    return parts.join(" · ");
  }

  function renderEntries() {
    if (!entries.length) return;
    var lang = currentLanguage();

    list.innerHTML = entries.map(function (entry) {
      var title = lang === "zh" ? entry.title : (entry.titleEn || entry.title);
      var excerpt = lang === "zh" ? entry.excerpt : (entry.excerptEn || entry.excerpt);
      var label = lang === "zh" ? "生活记录" : "Life";
      var read = lang === "zh" ? "阅读全文" : "Read entry";
      return [
        '<article class="journal-entry">',
        '<time class="journal-entry__date" datetime="' + escapeHtml(entry.date) + '">' + escapeHtml(entry.date.replace(/-/g, " · ")) + '</time>',
        '<div class="journal-entry__body">',
        '<div class="journal-entry__meta"><span class="journal-entry__tag">' + label + '</span></div>',
        '<h3>' + escapeHtml(title) + '</h3>',
        '<p>' + escapeHtml(excerpt) + '</p>',
        '<a class="journal-entry__link" href="' + encodeURI(entry.file) + '" data-journal-file="' + escapeHtml(entry.file) + '" data-journal-title="' + escapeHtml(title) + '" data-journal-date="' + escapeHtml(displayDate(entry.date, lang)) + '">' + read + '<span aria-hidden="true"> →</span></a>',
        '</div>',
        '</article>'
      ].join("");
    }).join("");
  }

  function showEntry(link) {
    dialogTitle.textContent = link.getAttribute("data-journal-title") || "Journal";
    dialogDate.textContent = link.getAttribute("data-journal-date") || "";
    dialogContent.innerHTML = '<p class="journal-dialog__loading">Loading…</p>';
    dialog.showModal();

    fetch(link.getAttribute("data-journal-file"))
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load entry");
        return response.text();
      })
      .then(function (markdown) {
        dialogContent.innerHTML = renderMarkdown(markdown);
      })
      .catch(function () {
        var lang = currentLanguage();
        dialogContent.innerHTML = '<p class="journal-dialog__error">' +
          (lang === "zh" ? "日志暂时无法加载，请稍后重试。" : "This entry could not be loaded. Please try again later.") +
          '</p>';
      });
  }

  list.addEventListener("click", function (event) {
    var link = event.target.closest("[data-journal-file]");
    if (!link || !dialog.showModal) return;
    event.preventDefault();
    showEntry(link);
  });

  if (closeButton) closeButton.addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });

  new MutationObserver(function (mutations) {
    if (mutations.some(function (mutation) { return mutation.attributeName === "data-lang"; })) renderEntries();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });

  fetch("journal/entries.json")
    .then(function (response) {
      if (!response.ok) throw new Error("Unable to load journal index");
      return response.json();
    })
    .then(function (data) {
      entries = Array.isArray(data) ? data : [];
      entries.sort(function (a, b) { return b.date.localeCompare(a.date); });
      renderEntries();
    })
    .catch(function () {
      /* Keep the server-rendered first entry as a resilient fallback. */
    });
})();
