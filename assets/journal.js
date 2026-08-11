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
  var entriesPromise;

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
    var lang = currentLanguage();
    if (!entries.length) {
      list.innerHTML = '<p class="journal-empty">' + (lang === "zh" ? "还没有日志。" : "No journal entries yet.") + '</p>';
      return;
    }

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

  /* ---- Owner editor: publish Markdown to GitHub ---- */
  var writeButton = document.getElementById("journalWriteButton");
  var editorDialog = document.getElementById("journalEditorDialog");
  var editorForm = document.getElementById("journalEditorForm");
  var editorClose = document.getElementById("journalEditorClose");
  var editorCancel = document.getElementById("journalEditorCancel");
  var editorDelete = document.getElementById("journalEditorDelete");
  var editorPublish = document.getElementById("journalEditorPublish");
  var editorDate = document.getElementById("journalEditorDate");
  var editorEntryTitle = document.getElementById("journalEditorEntryTitle");
  var editorExcerpt = document.getElementById("journalEditorExcerpt");
  var editorBody = document.getElementById("journalEditorBody");
  var editorToken = document.getElementById("journalEditorToken");
  var editorPreview = document.getElementById("journalEditorPreview");
  var editorPreviewWrap = editorDialog && editorDialog.querySelector(".journal-editor__preview-wrap");
  var editorStatus = document.getElementById("journalEditorStatus");
  var editorDirty = false;
  var editorExistingEntry = null;
  var lastEditorDate = "";
  var apiBase = "https://api.github.com/repos/csxsmart/csxsmart.github.io";

  function localDateString() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function stripLeadingTitle(markdown) {
    return markdown.replace(/^#\s+[^\n]+\n+/, "").trim();
  }

  function createExcerpt(body) {
    var plain = body
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[`*_>\[\]()~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plain.length > 88 ? plain.slice(0, 88).trim() + "……" : plain;
  }

  function setEditorStatus(message, type) {
    if (!editorStatus) return;
    editorStatus.className = "journal-editor__status" + (type ? " is-" + type : "");
    editorStatus.textContent = message || "";
  }

  function setEditorBusy(busy) {
    if (editorPublish) editorPublish.disabled = busy;
    if (editorDelete) editorDelete.disabled = busy;
    if (editorClose) editorClose.disabled = busy;
    if (editorCancel) editorCancel.disabled = busy;
    if (editorForm) editorForm.setAttribute("aria-busy", String(busy));
  }

  function updatePreview() {
    if (!editorPreview || !editorPreviewWrap || !editorPreviewWrap.open) return;
    var title = editorEntryTitle.value.trim() || (currentLanguage() === "zh" ? "未命名日志" : "Untitled entry");
    editorPreview.innerHTML = renderMarkdown("# " + title + "\n\n" + editorBody.value);
  }

  function decodeBase64Utf8(value) {
    var binary = atob(value.replace(/\s/g, ""));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }

  function githubErrorMessage(response, data) {
    var lang = currentLanguage();
    if (response.status === 401) return lang === "zh" ? "令牌无效或已经过期。" : "The token is invalid or expired.";
    if (response.status === 403) return lang === "zh" ? "令牌没有 Contents 写入权限，或请求受到 GitHub 限制。" : "The token lacks Contents write access, or GitHub blocked the request.";
    if (response.status === 404) return lang === "zh" ? "未找到仓库或分支，请确认令牌已授权 csxsmart.github.io。" : "Repository or branch not found. Check that the token can access csxsmart.github.io.";
    if (response.status === 409 || response.status === 422) return lang === "zh" ? "远端分支刚刚发生变化，请刷新页面后重试。" : "The branch changed while publishing. Refresh and try again.";
    return (data && data.message) || (lang === "zh" ? "GitHub 请求失败，请稍后重试。" : "The GitHub request failed. Please try again.");
  }

  function githubRequest(path, token, options) {
    options = options || {};
    return fetch(apiBase + path, {
      method: options.method || "GET",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "X-GitHub-Api-Version": "2026-03-10"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(githubErrorMessage(response, data));
        return data;
      });
    });
  }

  function loadEditorDate(date) {
    var existing = entries.find(function (entry) { return entry.date === date; });
    editorExistingEntry = existing || null;
    if (editorDelete) editorDelete.hidden = !existing;
    lastEditorDate = date;
    editorDate.value = date;
    editorEntryTitle.value = existing ? existing.title : "";
    editorExcerpt.value = existing ? existing.excerpt : "";
    editorBody.value = "";
    editorDirty = false;
    updatePreview();

    if (!existing) {
      setEditorStatus(currentLanguage() === "zh" ? "将创建一篇新日志。" : "A new entry will be created.");
      return Promise.resolve();
    }

    setEditorStatus(currentLanguage() === "zh" ? "正在载入当天已有日志……" : "Loading the existing entry…");
    return fetch(existing.file + "?editor=" + Date.now(), { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Unable to load existing entry");
        return response.text();
      })
      .then(function (markdown) {
        editorBody.value = stripLeadingTitle(markdown);
        editorDirty = false;
        updatePreview();
        setEditorStatus(currentLanguage() === "zh" ? "当天已有日志，发布后将更新原文。" : "An entry exists for this date and will be updated.");
      })
      .catch(function () {
        setEditorStatus(currentLanguage() === "zh" ? "正文载入失败，请刷新页面后重试。" : "The entry body could not be loaded. Refresh and try again.", "error");
      });
  }

  function closeEditor() {
    if (editorDirty) {
      var warning = currentLanguage() === "zh" ? "尚未发布的内容会丢失，确定关闭吗？" : "Unpublished changes will be lost. Close the editor?";
      if (!window.confirm(warning)) return;
    }
    editorToken.value = "";
    editorDirty = false;
    editorDialog.close();
  }

  function showPublishSuccess(commitSha, date) {
    setEditorStatus("", "success");
    var message = document.createTextNode(currentLanguage() === "zh" ? "发布成功。查看提交 " : "Published successfully. View commit ");
    var link = document.createElement("a");
    link.href = "https://github.com/csxsmart/csxsmart.github.io/commit/" + commitSha;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = commitSha.slice(0, 7) + " ↗";
    editorStatus.appendChild(message);
    editorStatus.appendChild(link);
    editorStatus.appendChild(document.createTextNode(currentLanguage() === "zh" ? "。网页通常会在片刻后更新。" : ". GitHub Pages should update shortly."));
    editorDate.value = date;
  }

  function showDeleteSuccess(commitSha) {
    setEditorStatus("", "success");
    var message = document.createTextNode(currentLanguage() === "zh" ? "删除成功。查看提交 " : "Deleted successfully. View commit ");
    var link = document.createElement("a");
    link.href = "https://github.com/csxsmart/csxsmart.github.io/commit/" + commitSha;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = commitSha.slice(0, 7) + " ↗";
    editorStatus.appendChild(message);
    editorStatus.appendChild(link);
    editorStatus.appendChild(document.createTextNode(currentLanguage() === "zh" ? "。网页通常会在片刻后更新。" : ". GitHub Pages should update shortly."));
  }

  function deleteEntry() {
    if (!editorExistingEntry) return;
    var token = editorToken.value.trim();
    if (!token) {
      setEditorStatus(currentLanguage() === "zh" ? "请先粘贴 GitHub Token。" : "Paste your GitHub token first.", "error");
      editorToken.focus();
      return;
    }

    var date = editorExistingEntry.date;
    var title = editorExistingEntry.title;
    var warning = currentLanguage() === "zh"
      ? "确定永久删除“" + title + "”（" + date + "）吗？删除后需要通过 Git 历史才能恢复。"
      : "Permanently delete “" + title + "” (" + date + ")? Recovery will require Git history.";
    if (!window.confirm(warning)) return;

    setEditorBusy(true);
    setEditorStatus(currentLanguage() === "zh" ? "正在从 GitHub 删除日志……" : "Deleting the entry from GitHub…", "working");

    var headSha;
    var baseTreeSha;
    var remoteEntries;
    var deletedFile;

    githubRequest("/git/ref/heads/main", token)
      .then(function (ref) {
        headSha = ref.object.sha;
        return Promise.all([
          githubRequest("/git/commits/" + headSha, token),
          githubRequest("/contents/journal/entries.json?ref=" + encodeURIComponent(headSha), token)
        ]);
      })
      .then(function (results) {
        baseTreeSha = results[0].tree.sha;
        remoteEntries = JSON.parse(decodeBase64Utf8(results[1].content));
        if (!Array.isArray(remoteEntries)) throw new Error(currentLanguage() === "zh" ? "远端日志索引格式无效。" : "The remote journal index is invalid.");

        var remoteEntry = remoteEntries.find(function (entry) { return entry.date === date; });
        if (!remoteEntry) throw new Error(currentLanguage() === "zh" ? "远端已经没有这篇日志，请刷新页面。" : "This entry no longer exists remotely. Refresh the page.");
        deletedFile = remoteEntry.file;
        remoteEntries = remoteEntries.filter(function (entry) { return entry.date !== date; });

        return githubRequest("/git/trees", token, {
          method: "POST",
          body: {
            base_tree: baseTreeSha,
            tree: [
              { path: deletedFile, mode: "100644", type: "blob", sha: null },
              { path: "journal/entries.json", mode: "100644", type: "blob", content: JSON.stringify(remoteEntries, null, 2) + "\n" }
            ]
          }
        });
      })
      .then(function (tree) {
        return githubRequest("/git/commits", token, {
          method: "POST",
          body: {
            message: "Delete journal entry for " + date,
            tree: tree.sha,
            parents: [headSha]
          }
        });
      })
      .then(function (commit) {
        return githubRequest("/git/refs/heads/main", token, {
          method: "PATCH",
          body: { sha: commit.sha, force: false }
        }).then(function () { return commit; });
      })
      .then(function (commit) {
        entries = remoteEntries;
        renderEntries();
        editorToken.value = "";
        editorEntryTitle.value = "";
        editorExcerpt.value = "";
        editorBody.value = "";
        editorDirty = false;
        editorExistingEntry = null;
        editorDelete.hidden = true;
        updatePreview();
        showDeleteSuccess(commit.sha);
      })
      .catch(function (error) {
        setEditorStatus(error.message, "error");
      })
      .finally(function () {
        setEditorBusy(false);
      });
  }

  function publishEntry(event) {
    event.preventDefault();
    if (!editorForm.reportValidity()) return;

    var token = editorToken.value.trim();
    var date = editorDate.value;
    var title = editorEntryTitle.value.trim();
    var body = editorBody.value.trim();
    var excerpt = editorExcerpt.value.trim() || createExcerpt(body);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setEditorStatus(currentLanguage() === "zh" ? "请选择有效日期。" : "Choose a valid date.", "error");
      return;
    }

    setEditorBusy(true);
    setEditorStatus(currentLanguage() === "zh" ? "正在连接 GitHub 并创建提交……" : "Connecting to GitHub and creating the commit…", "working");

    var headSha;
    var baseTreeSha;
    var remoteEntries;
    var file = "journal/" + date + ".md";
    var markdown = "# " + title + "\n\n" + body + "\n";

    githubRequest("/git/ref/heads/main", token)
      .then(function (ref) {
        headSha = ref.object.sha;
        return Promise.all([
          githubRequest("/git/commits/" + headSha, token),
          githubRequest("/contents/journal/entries.json?ref=" + encodeURIComponent(headSha), token)
        ]);
      })
      .then(function (results) {
        baseTreeSha = results[0].tree.sha;
        remoteEntries = JSON.parse(decodeBase64Utf8(results[1].content));
        if (!Array.isArray(remoteEntries)) throw new Error(currentLanguage() === "zh" ? "远端日志索引格式无效。" : "The remote journal index is invalid.");

        var existingIndex = remoteEntries.findIndex(function (entry) { return entry.date === date; });
        var metadata = { date: date, title: title, excerpt: excerpt, file: file };
        if (existingIndex >= 0) {
          if (remoteEntries[existingIndex].titleEn) metadata.titleEn = remoteEntries[existingIndex].titleEn;
          if (remoteEntries[existingIndex].excerptEn) metadata.excerptEn = remoteEntries[existingIndex].excerptEn;
          remoteEntries[existingIndex] = metadata;
        } else {
          remoteEntries.push(metadata);
        }
        remoteEntries.sort(function (a, b) { return b.date.localeCompare(a.date); });

        return githubRequest("/git/trees", token, {
          method: "POST",
          body: {
            base_tree: baseTreeSha,
            tree: [
              { path: file, mode: "100644", type: "blob", content: markdown },
              { path: "journal/entries.json", mode: "100644", type: "blob", content: JSON.stringify(remoteEntries, null, 2) + "\n" }
            ]
          }
        });
      })
      .then(function (tree) {
        var isUpdate = entries.some(function (entry) { return entry.date === date; });
        return githubRequest("/git/commits", token, {
          method: "POST",
          body: {
            message: (isUpdate ? "Update" : "Add") + " journal entry for " + date,
            tree: tree.sha,
            parents: [headSha]
          }
        });
      })
      .then(function (commit) {
        return githubRequest("/git/refs/heads/main", token, {
          method: "PATCH",
          body: { sha: commit.sha, force: false }
        }).then(function () { return commit; });
      })
      .then(function (commit) {
        entries = remoteEntries;
        renderEntries();
        editorExistingEntry = entries.find(function (entry) { return entry.date === date; }) || null;
        editorDelete.hidden = !editorExistingEntry;
        editorToken.value = "";
        editorDirty = false;
        showPublishSuccess(commit.sha, date);
      })
      .catch(function (error) {
        setEditorStatus(error.message, "error");
      })
      .finally(function () {
        setEditorBusy(false);
      });
  }

  if (writeButton && editorDialog && editorForm) {
    writeButton.addEventListener("click", function () {
      if (!editorDialog.showModal) return;
      editorDialog.showModal();
      editorToken.value = "";
      setEditorStatus(currentLanguage() === "zh" ? "正在准备编辑器……" : "Preparing the editor…");
      Promise.resolve(entriesPromise).catch(function () {}).then(function () {
        return loadEditorDate(localDateString());
      });
    });

    [editorEntryTitle, editorExcerpt, editorBody].forEach(function (field) {
      field.addEventListener("input", function () {
        editorDirty = true;
        updatePreview();
      });
    });

    editorDate.addEventListener("change", function () {
      var nextDate = editorDate.value;
      if (editorDirty) {
        var warning = currentLanguage() === "zh" ? "切换日期会丢失当前未发布的内容，是否继续？" : "Changing the date will discard unpublished content. Continue?";
        if (!window.confirm(warning)) {
          editorDate.value = lastEditorDate;
          return;
        }
      }
      loadEditorDate(nextDate);
    });

    editorPreviewWrap.addEventListener("toggle", updatePreview);
    editorForm.addEventListener("submit", publishEntry);
    editorDelete.addEventListener("click", deleteEntry);
    editorClose.addEventListener("click", closeEditor);
    editorCancel.addEventListener("click", closeEditor);
    editorDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeEditor();
    });
  }

  new MutationObserver(function (mutations) {
    if (mutations.some(function (mutation) { return mutation.attributeName === "data-lang"; })) renderEntries();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });

  entriesPromise = fetch("journal/entries.json")
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
