"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

import { imageModels, type ImageModel } from "@/lib/right-codes";

type HistoryStatus = "idle" | "loading" | "done" | "error";

type HistoryItem = {
  id: string;
  prompt: string;
  size: string;
  model: ImageModel;
  createdAt: string;
  referenceImages: string[];
  resultImages: string[];
  status: HistoryStatus;
  errorMessage: string;
};

type StoredHistoryItem = Omit<HistoryItem, "referenceImages"> & {
  referenceImages?: string[];
};

const localStorageKey = "image-chat-studio/history";

const starterPrompts = [
  "生成一张极简产品海报，主体居中，背景干净。",
  "参考我上传的图片，生成更适合首页横幅的版本。",
  "生成一张写实风格的咖啡馆夜景海报。"
];

function createHistoryItem(prompt: string, size: string, model: ImageModel, referenceImages: string[]): HistoryItem {
  return {
    id: crypto.randomUUID(),
    prompt,
    size,
    model,
    createdAt: new Date().toISOString(),
    referenceImages,
    resultImages: [],
    status: "loading",
    errorMessage: ""
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getModelDescription(model: ImageModel) {
  return imageModels.find((item) => item.id === model)?.description || "";
}

function toStoredHistory(history: HistoryItem[]): StoredHistoryItem[] {
  return history.map(({ referenceImages: _referenceImages, ...item }) => item);
}

function normalizeStoredHistoryItem(item: StoredHistoryItem): HistoryItem | null {
  if (
    typeof item.id !== "string" ||
    typeof item.prompt !== "string" ||
    typeof item.size !== "string" ||
    typeof item.model !== "string" ||
    typeof item.createdAt !== "string" ||
    !Array.isArray(item.resultImages) ||
    typeof item.status !== "string" ||
    typeof item.errorMessage !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    prompt: item.prompt,
    size: item.size,
    model: item.model as ImageModel,
    createdAt: item.createdAt,
    referenceImages: [],
    resultImages: item.resultImages.filter((value): value is string => typeof value === "string"),
    status: item.status as HistoryStatus,
    errorMessage: item.errorMessage
  };
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("读取图片失败。"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("读取图片失败。"));
    reader.readAsDataURL(file);
  });
}

export function ImageChatStudio() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("");
  const [model, setModel] = useState<ImageModel>("gpt-image-2-vip");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) {
      setHistoryReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredHistoryItem[];
      if (!Array.isArray(parsed)) {
        return;
      }
      const normalized = parsed
        .map((item) => normalizeStoredHistoryItem(item))
        .filter((item): item is HistoryItem => item !== null);
      setHistory(normalized);
      window.localStorage.setItem(localStorageKey, JSON.stringify(toStoredHistory(normalized)));
      if (normalized[0]) {
        setActiveId(normalized[0].id);
      }
    } catch {
      window.localStorage.removeItem(localStorageKey);
    } finally {
      setHistoryReady(true);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) {
      return;
    }
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(toStoredHistory(history)));
    } catch {
      setPageError("本地历史已满，后续记录不会继续写入浏览器。");
    }
  }, [history, historyReady]);

  const activeItem = activeId ? history.find((item) => item.id === activeId) ?? null : null;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    setPageError("");

    try {
      const nextImages = await Promise.all(Array.from(files).map((file) => fileToDataUrl(file)));
      setReferenceImages((current) => [...current, ...nextImages]);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "上传参考图失败。");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextPrompt = prompt.trim();
    if (!nextPrompt || submitting) {
      return;
    }

    setSubmitting(true);
    setPageError("");

    const item = createHistoryItem(nextPrompt, size, model, referenceImages);
    setHistory((current) => [item, ...current]);
    setActiveId(item.id);
    setPrompt("");
    setReferenceImages([]);

    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: nextPrompt,
          size,
          model,
          images: item.referenceImages
        })
      });

      const payload = (await response.json()) as { createdAt?: string; images?: string[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "生成失败。");
      }

      setHistory((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                createdAt: payload.createdAt || entry.createdAt,
                resultImages: payload.images || [],
                status: "done"
              }
            : entry
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成失败。";
      setHistory((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: "error",
                errorMessage: message
              }
            : entry
        )
      );
      setPageError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyPrompt(value: string) {
    await navigator.clipboard.writeText(value);
  }

  function handleReusePrompt(item: HistoryItem) {
    setPrompt(item.prompt);
    setSize(item.size);
    setModel(item.model);
    setReferenceImages(item.referenceImages);
  }

  async function handleCopyConversation(item: HistoryItem) {
    const lines = [
      `提示词：${item.prompt}`,
      item.model ? `模型：${item.model}` : "",
      item.size ? `尺寸：${item.size}` : "",
      item.resultImages.length > 0 ? `图片：\n${item.resultImages.join("\n")}` : ""
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
  }

  async function handleCopyImage(imageUrl: string) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || "image/png"]: blob
        })
      ]);
    } catch {
      setPageError("复制图片失败。当前浏览器可能不支持，或图片源拒绝复制。");
    }
  }

  function handleRemoveReferenceImage(index: number) {
    setReferenceImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleDeleteHistoryItem(itemId: string) {
    setHistory((current) => {
      const nextHistory = current.filter((item) => item.id !== itemId);
      if (activeId === itemId) {
        setActiveId(nextHistory[0]?.id || "");
      }
      setPendingDeleteId("");
      return nextHistory;
    });
  }

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar">
        <div className="sidebar-head">
          <p className="eyebrow">历史记录</p>
          <h1>画图工作台</h1>
          <p className="sidebar-copy">本地保存最近的生成记录。</p>
        </div>

        <button
          type="button"
          className="new-chat-button"
          onClick={() => {
            setActiveId("");
            setPrompt("");
            setSize("");
            setModel("gpt-image-2-vip");
            setReferenceImages([]);
            setPageError("");
            setPendingDeleteId("");
          }}
        >
          新建创作
        </button>

        <div className="history-list">
          {history.length === 0 ? (
            <div className="history-empty">还没有记录，先从右侧发起第一条创作。</div>
          ) : null}

          {history.map((item) => (
            <div key={item.id} className={`history-item ${item.id === activeId ? "is-active" : ""}`}>
              <button type="button" className="history-main" onClick={() => setActiveId(item.id)}>
                <div className="history-meta">
                  <span>{formatTime(item.createdAt)}</span>
                  <span>{item.model}</span>
                </div>
                <strong>{item.prompt}</strong>
                <span className={`history-status is-${item.status}`}>
                  {item.status === "loading" ? "生成中" : item.status === "done" ? "已完成" : item.status === "error" ? "失败" : "草稿"}
                </span>
              </button>
              {pendingDeleteId === item.id ? (
                <div className="history-delete-confirm">
                  <span>确认删除？</span>
                  <div className="history-delete-actions">
                    <button type="button" className="history-delete danger" onClick={() => handleDeleteHistoryItem(item.id)}>
                      确认
                    </button>
                    <button type="button" className="history-delete" onClick={() => setPendingDeleteId("")}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="history-delete" onClick={() => setPendingDeleteId(item.id)}>
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="studio-main">
        <header className="main-topbar">
          <div>
            <p className="eyebrow">生图</p>
            <h2>{activeItem ? "当前创作" : "新建创作"}</h2>
          </div>
          <p className="hero-copy">输入提示词，上传参考图，选择尺寸后生成。</p>
        </header>

        <div className="conversation-stage">
          {!activeItem ? (
            <section className="empty-state is-chat-like">
              <h2>新建创作</h2>
              <div className="starter-grid">
                {starterPrompts.map((item) => (
                  <button key={item} type="button" className="starter-card" onClick={() => setPrompt(item)}>
                    {item}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="chat-thread">
              <article className="chat-bubble user-bubble">
                <div className="bubble-head">
                  <span className="entry-tag">你的提示词</span>
                  <time dateTime={activeItem.createdAt}>{formatTime(activeItem.createdAt)}</time>
                </div>
                <p>{activeItem.prompt}</p>
                {activeItem.referenceImages.length > 0 ? (
                <div className="reference-grid">
                  {activeItem.referenceImages.map((image, index) => (
                      <img key={`${activeItem.id}-${index}`} src={image} alt={`参考图 ${index + 1}`} />
                    ))}
                  </div>
                ) : null}
              </article>

              <article className="chat-bubble assistant-bubble">
                <div className="bubble-head">
                  <span className="entry-tag">生成结果</span>
                  <span>{activeItem.model}{activeItem.size ? ` · ${activeItem.size}` : ""}</span>
                </div>

                {activeItem.status === "loading" ? (
                  <div className="result-loading">
                    <span className="loading-mark" />
                    <div>
                      <strong>正在生成</strong>
                      <p>正在处理这次创作，请不要关闭页面，等待结果返回。</p>
                    </div>
                  </div>
                ) : null}

                {activeItem.status === "error" ? (
                  <div className="result-error">
                    <strong>生成失败</strong>
                    <p>{activeItem.errorMessage}</p>
                  </div>
                ) : null}

                {activeItem.resultImages.map((image, index) => {
                  const downloadUrl = `/api/images/download?url=${encodeURIComponent(image)}&filename=${encodeURIComponent(`image-${activeItem.id}-${index + 1}`)}`;

                  return (
                    <figure key={`${activeItem.id}-${image}`} className="result-figure">
                      <img src={image} alt={`生成结果 ${index + 1}`} />
                      <figcaption>
                        <div className="result-actions">
                          <button type="button" onClick={() => handleCopyPrompt(activeItem.prompt)}>
                            复制提示词
                          </button>
                          <button type="button" onClick={() => handleCopyImage(image)}>
                            复制图片
                          </button>
                          <button type="button" onClick={() => handleCopyConversation(activeItem)}>
                            复制此对话
                          </button>
                          <button type="button" onClick={() => handleReusePrompt(activeItem)}>
                            作为新回合继续
                          </button>
                          <a href={downloadUrl}>下载图片</a>
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </article>
            </div>
          )}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer-topline">
            <label className="model-picker">
              <span>模型</span>
              <select value={model} onChange={(event) => setModel(event.target.value as ImageModel)}>
                {imageModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="size-picker">
              <span>尺寸</span>
              <input value={size} onChange={(event) => setSize(event.target.value)} />
            </label>

            <button type="button" className="upload-button" onClick={() => fileInputRef.current?.click()}>
              {uploading ? "处理中..." : "上传参考图"}
            </button>
            <input
              ref={fileInputRef}
              hidden
              multiple
              accept="image/*"
              type="file"
              onChange={handleFileChange}
            />
          </div>

          {referenceImages.length > 0 ? (
            <div className="composer-attachments">
              {referenceImages.map((image, index) => (
                <div key={`${image}-${index}`} className="attachment-chip">
                  <img src={image} alt={`待提交参考图 ${index + 1}`} />
                  <button type="button" onClick={() => handleRemoveReferenceImage(index)}>
                    移除
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <p className="model-description">{getModelDescription(model)}</p>

          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="例如：参考我上传的构图，做一张更像时尚杂志内页的产品海报。"
            rows={4}
          />

          <div className="composer-footer">
            <p>{pageError || "支持上传多张参考图。生成期间请不要关闭页面。"}</p>
            <button type="submit" disabled={submitting || !prompt.trim()}>
              {submitting ? "生成中..." : "开始生成"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
