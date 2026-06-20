"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef, useState } from "react";

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
const promptGalleryNoticeKey = "image-chat-studio/prompt-gallery-notice";

type ToastTone = "default" | "error";

type ToastState = {
  id: number;
  message: string;
  tone: ToastTone;
};

const statusLabelMap: Record<HistoryStatus, string> = {
  idle: "草稿",
  loading: "生成中",
  done: "已完成",
  error: "失败"
};

function createHistoryId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createHistoryItem(prompt: string, size: string, model: ImageModel, referenceImages: string[]): HistoryItem {
  return {
    id: createHistoryId(),
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

type ActionButtonProps = {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
};

function SecondaryButton({ children, className = "", disabled = false, onClick, type = "button" }: ActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm text-[color:var(--text-muted)] transition duration-200 hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-strong)] active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className = "", disabled = false, onClick, type = "button" }: ActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center rounded-full bg-[color:var(--accent)] px-5 text-sm font-medium text-[color:var(--button-text)] transition duration-200 hover:bg-[color:var(--accent-strong)] active:scale-[0.98] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

type HistoryPanelProps = {
  activeId: string;
  history: HistoryItem[];
  pendingDeleteId: string;
  onDelete: (itemId: string) => void;
  onPendingDelete: (itemId: string) => void;
  onSelect: (itemId: string) => void;
};

function HistoryPanel({ activeId, history, pendingDeleteId, onDelete, onPendingDelete, onSelect }: HistoryPanelProps) {
  if (history.length === 0) {
    return <div className="px-2 py-6 text-sm text-[color:var(--text-dim)]">暂无记录</div>;
  }

  return (
    <div className="grid gap-1.5">
      {history.map((item) => {
        const isActive = item.id === activeId;
        const statusColorClass =
          item.status === "loading"
            ? "text-[color:var(--status-loading)]"
            : item.status === "done"
              ? "text-[color:var(--status-done)]"
              : item.status === "error"
                ? "text-[color:var(--status-error)]"
                : "text-[color:var(--text-dim)]";

        return (
          <div key={item.id} className={`rounded-[1.2rem] border-l-2 ${isActive ? "border-[color:var(--accent)]" : "border-transparent"}`}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`grid w-full gap-2 rounded-[1.2rem] px-3 py-3 text-left transition duration-200 ${
                isActive
                  ? "bg-[color:var(--surface-highlight)] text-[color:var(--text-strong)]"
                  : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-soft)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                <span>{formatTime(item.createdAt)}</span>
                <span className={statusColorClass}>{statusLabelMap[item.status]}</span>
              </div>
              <div className="truncate text-sm text-[color:var(--text-strong)]">{item.prompt}</div>
              <div className="truncate text-xs text-[color:var(--text-dim)]">
                {item.model}
                {item.size ? ` · ${item.size}` : ""}
              </div>
            </button>

            {pendingDeleteId === item.id ? (
              <div className="grid gap-2 px-3 pb-4 pt-1">
                <div className="text-xs leading-5 text-[color:var(--text-dim)]">
                  <span className="text-[color:var(--text-strong)]">确认删除这条记录？</span>
                  <span className="ml-2">删除后无法恢复。</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    className="text-[color:var(--text-dim)] transition hover:text-[color:var(--text-strong)]"
                    onClick={() => onPendingDelete("")}
                  >
                    取消
                  </button>
                  <span className="h-3 w-px bg-[color:var(--line-soft)]" aria-hidden="true" />
                  <button
                    type="button"
                    className="font-medium text-[color:var(--status-error)] transition hover:text-[color:var(--status-error)]"
                    onClick={() => onDelete(item.id)}
                  >
                    确认删除
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onPendingDelete(item.id)}
                className="px-3 pb-4 pt-1 text-xs text-[color:var(--status-error)] transition hover:text-[color:var(--status-error)]"
              >
                删除
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImageChatStudio() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("");
  const [model, setModel] = useState<ImageModel>("gpt-image-2-vip");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [pendingClearData, setPendingClearData] = useState(false);
  const [promptGalleryNoticeOpen, setPromptGalleryNoticeOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
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
        setHistoryReady(true);
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

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((current) => {
        if (!current || current.id !== toast.id) {
          return current;
        }

        return null;
      });
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!historyOpen && !helpOpen && !clearDataOpen && !promptGalleryNoticeOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setHistoryOpen(false);
      setHelpOpen(false);
      setClearDataOpen(false);
      setPendingClearData(false);
      setPromptGalleryNoticeOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearDataOpen, helpOpen, historyOpen, promptGalleryNoticeOpen]);

  const activeItem = activeId ? history.find((item) => item.id === activeId) ?? null : null;

  function showToast(message: string, tone: ToastTone = "default") {
    setToast({
      id: Date.now(),
      message,
      tone
    });
  }

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
    setHistoryOpen(false);

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
    try {
      await navigator.clipboard.writeText(value);
      showToast("文字已复制。");
    } catch {
      showToast("复制文字失败，请检查浏览器权限。", "error");
    }
  }

  async function handleCopyConversation(item: HistoryItem) {
    const lines = [
      `提示词：${item.prompt}`,
      item.model ? `模型：${item.model}` : "",
      item.size ? `尺寸：${item.size}` : "",
      item.resultImages.length > 0 ? `图片：\n${item.resultImages.join("\n")}` : ""
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      showToast("对话已复制。");
    } catch {
      showToast("复制对话失败，请检查浏览器权限。", "error");
    }
  }

  function handleDownloadImage() {
    showToast("已开始下载，请确认浏览器下载列表。");
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

  function resetComposer() {
    setActiveId("");
    setPrompt("");
    setSize("");
    setModel("gpt-image-2-vip");
    setReferenceImages([]);
    setPageError("");
    setPendingDeleteId("");
    setHistoryOpen(false);
  }

  function closeHelpDialog() {
    setHelpOpen(false);
    setPendingClearData(false);
  }

  function closeClearDataDialog() {
    setClearDataOpen(false);
    setPendingClearData(false);
  }

  function handleClearImageData() {
    window.localStorage.removeItem(localStorageKey);
    setHistory([]);
    setActiveId("");
    setReferenceImages([]);
    setPendingDeleteId("");
    setPendingClearData(false);
    setClearDataOpen(false);
    setHelpOpen(false);
    setPageError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    showToast("图片数据已清理。");
  }

  function handlePromptGalleryClick(event: MouseEvent<HTMLAnchorElement>) {
    if (window.localStorage.getItem(promptGalleryNoticeKey) === "1") {
      return;
    }

    event.preventDefault();
    setPromptGalleryNoticeOpen(true);
  }

  function handleOpenPromptGallery() {
    window.localStorage.setItem(promptGalleryNoticeKey, "1");
    setPromptGalleryNoticeOpen(false);
    window.open("https://opennana.com/awesome-prompt-gallery", "_blank", "noopener,noreferrer");
  }

  function selectHistoryItem(itemId: string) {
    setActiveId(itemId);
    setHistoryOpen(false);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(176,147,106,0.1),transparent_38%),var(--bg)] text-[color:var(--text-strong)]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[296px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen border-r border-[color:var(--line-soft)] px-4 py-4 lg:flex lg:flex-col">
          <div className="flex items-center gap-3 px-2 py-2">
            <Image src="/cat-f.png" alt="画图工作台" width={34} height={34} className="h-8 w-8 object-contain" priority />
            <div className="min-w-0">
              <div className="font-[var(--font-display)] text-base uppercase tracking-[0.08em] text-[color:var(--text-strong)]">画图工作台</div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between px-2">
            <span className="text-xs text-[color:var(--text-dim)]">历史</span>
            <SecondaryButton className="min-h-8 px-3 text-xs" onClick={resetComposer}>
              新建
            </SecondaryButton>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <HistoryPanel
              activeId={activeId}
              history={history}
              pendingDeleteId={pendingDeleteId}
              onDelete={handleDeleteHistoryItem}
              onPendingDelete={setPendingDeleteId}
              onSelect={selectHistoryItem}
            />
          </div>
        </aside>

        <div className="flex min-h-screen flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-3 py-2 lg:py-4">
            <div className="flex items-center gap-3 lg:hidden">
              <Image src="/cat-f.png" alt="画图工作台" width={36} height={36} className="h-9 w-9 object-contain" priority />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <SecondaryButton
                className="min-h-9 rounded-full bg-[color:var(--surface-soft)] px-2.5 text-[13px] text-[color:var(--text-strong)] hover:bg-[color:var(--surface-highlight)] sm:min-h-10 sm:px-3 sm:text-sm"
                onClick={() => {
                  setPendingClearData(false);
                  setHelpOpen(true);
                }}
              >
                文档
              </SecondaryButton>
              <SecondaryButton
                className="min-h-9 rounded-full px-2.5 text-[13px] text-[color:var(--status-error)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--status-error)] sm:min-h-10 sm:px-3 sm:text-sm"
                onClick={() => {
                  setPendingClearData(false);
                  setClearDataOpen(true);
                }}
              >
                清理数据
              </SecondaryButton>
              <div className="flex items-center gap-1 lg:hidden">
                <SecondaryButton className="min-h-9 px-2.5 text-[13px] sm:min-h-10 sm:px-3 sm:text-sm" onClick={() => setHistoryOpen(true)}>
                  历史
                </SecondaryButton>
                <SecondaryButton className="min-h-9 px-2.5 text-[13px] sm:min-h-10 sm:px-3 sm:text-sm" onClick={resetComposer}>
                  新建
                </SecondaryButton>
              </div>
            </div>
          </header>

          <section className="flex min-h-0 flex-1 items-stretch py-2">
            <div className="flex min-h-[calc(100vh-11rem)] w-full flex-1 flex-col">
              {!activeItem ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="h-full w-full max-w-[860px]" />
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-[920px] flex-1 flex-col gap-6 pb-8 pt-2 sm:pt-6">
                  <div className="px-1">
                    <div className="max-w-[76ch] text-[15px] leading-8 text-[color:var(--text-strong)] sm:text-base">{activeItem.prompt}</div>
                    {activeItem.referenceImages.length > 0 ? (
                      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                        {activeItem.referenceImages.map((image, index) => (
                          <img
                            key={`${activeItem.id}-${index}`}
                            src={image}
                            alt={`参考图 ${index + 1}`}
                            className="h-18 w-18 shrink-0 rounded-[1.2rem] object-cover opacity-90 transition duration-200 hover:opacity-100 sm:h-20 sm:w-20"
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {activeItem.status === "loading" ? (
                    <div className="px-1 text-sm text-[color:var(--status-loading)] animate-[fade-soft_0.6s_ease-out]">正在生成…</div>
                  ) : null}

                  {activeItem.status === "error" ? <div className="px-1 text-sm text-[color:var(--status-error)]">{activeItem.errorMessage}</div> : null}

                  {activeItem.resultImages.length > 0 ? (
                    <div className="grid gap-6">
                      {activeItem.resultImages.map((image, index) => {
                        const downloadUrl = `/api/images/download?url=${encodeURIComponent(image)}&filename=${encodeURIComponent(`image-${activeItem.id}-${index + 1}`)}`;

                        return (
                          <figure key={`${activeItem.id}-${image}`} className="grid gap-3">
                            <div className="overflow-hidden rounded-[1.5rem] bg-[color:var(--surface)] shadow-[0_16px_32px_rgba(20,12,12,0.18)] transition duration-300 hover:translate-y-[-1px]">
                              <img src={image} alt={`生成结果 ${index + 1}`} className="w-full object-cover" />
                            </div>
                            <figcaption className="flex flex-wrap gap-1.5 text-sm text-[color:var(--text-muted)]">
                              <SecondaryButton onClick={() => handleCopyPrompt(activeItem.prompt)}>复制文字</SecondaryButton>
                              <SecondaryButton onClick={() => handleCopyConversation(activeItem)}>复制对话</SecondaryButton>
                              <a
                                href={downloadUrl}
                                onClick={handleDownloadImage}
                                className="inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm text-[color:var(--text-muted)] transition duration-200 hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-strong)]"
                              >
                                下载
                              </a>
                            </figcaption>
                          </figure>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <footer className="sticky bottom-0 mt-auto pt-2">
            <form
              onSubmit={handleSubmit}
              className="mx-auto flex w-full max-w-[920px] flex-col gap-3 rounded-[1.7rem] border border-[color:var(--line-soft)] bg-[color:var(--surface-panel)] p-3 shadow-[0_18px_44px_rgba(24,21,17,0.16)] backdrop-blur sm:p-4"
            >
              {referenceImages.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {referenceImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="grid shrink-0 gap-1.5">
                      <img src={image} alt={`待提交参考图 ${index + 1}`} className="h-16 w-16 rounded-[1.1rem] object-cover" />
                      <button
                        type="button"
                        aria-label={`移除参考图 ${index + 1}`}
                        onClick={() => handleRemoveReferenceImage(index)}
                        className="inline-flex min-h-6 items-center justify-center rounded-full px-2 text-xs font-medium text-[color:var(--status-error)] transition hover:text-[color:var(--status-error)]"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={3}
                placeholder="输入提示词"
                className="min-h-[88px] w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-7 text-[color:var(--text-strong)] outline-none placeholder:text-[color:var(--text-dim)] sm:min-h-[96px] sm:text-base"
              />

              <div className="flex items-center justify-end px-1">
                <a
                  href="https://opennana.com/awesome-prompt-gallery"
                  target="_blank"
                  rel="noreferrer"
                  onClick={handlePromptGalleryClick}
                  className="inline-flex min-h-8 items-center justify-center gap-1 rounded-full px-2 text-sm text-[color:var(--text-dim)] transition duration-200 hover:text-[color:var(--text-strong)]"
                >
                  提示词参考
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.7]">
                    <path d="M7 5.75h7.25V13" />
                    <path d="m12.75 6-6 6" />
                    <path d="M13.25 10.5v3.75a1 1 0 0 1-1 1H5.75a1 1 0 0 1-1-1v-6.5a1 1 0 0 1 1-1H9.5" />
                  </svg>
                </a>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value as ImageModel)}
                    className="min-h-10 rounded-full bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--text-muted)] outline-none transition focus:bg-[color:var(--surface-highlight)]"
                  >
                    {imageModels.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>

                  <input
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    placeholder="尺寸"
                    className="min-h-10 w-[7.5rem] rounded-full bg-[color:var(--surface-soft)] px-4 text-sm text-[color:var(--text-muted)] outline-none transition placeholder:text-[color:var(--text-dim)] focus:bg-[color:var(--surface-highlight)] sm:w-[9rem]"
                  />

                  <SecondaryButton className="rounded-full bg-[color:var(--surface-soft)] text-[color:var(--text-strong)] hover:bg-[color:var(--surface-highlight)]" onClick={() => fileInputRef.current?.click()}>
                    {uploading ? "处理中..." : "上传"}
                  </SecondaryButton>
                  <input ref={fileInputRef} hidden multiple accept="image/*" type="file" onChange={handleFileChange} />
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className={`truncate text-xs ${pageError ? "text-[color:var(--status-error)]" : "text-[color:var(--text-dim)]"}`}>{pageError || ""}</span>
                  <PrimaryButton type="submit" disabled={submitting || !prompt.trim()} className="shrink-0">
                    {submitting ? "生成中..." : "生成"}
                  </PrimaryButton>
                </div>
              </div>
            </form>
          </footer>
        </div>
      </div>

      {historyOpen ? (
        <div className="fixed inset-0 z-50 bg-[color:var(--bg)] lg:hidden" role="presentation" onClick={() => setHistoryOpen(false)}>
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="历史记录"
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-0 flex flex-col bg-[color:var(--bg)] px-4 py-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="font-[var(--font-display)] text-base uppercase tracking-[0.08em] text-[color:var(--text-strong)]">历史记录</div>
              <SecondaryButton onClick={() => setHistoryOpen(false)}>关闭</SecondaryButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <HistoryPanel
                activeId={activeId}
                history={history}
                pendingDeleteId={pendingDeleteId}
                onDelete={handleDeleteHistoryItem}
                onPendingDelete={setPendingDeleteId}
                onSelect={selectHistoryItem}
              />
            </div>
          </aside>
        </div>
      ) : null}

      {helpOpen ? (
        <div
          className="fixed inset-0 z-[55] bg-[rgba(10,8,8,0.78)] backdrop-blur-sm"
          role="presentation"
          onClick={closeHelpDialog}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="使用文档"
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-0 flex flex-col bg-[color:var(--bg)] px-4 py-4 lg:left-1/2 lg:top-1/2 lg:h-auto lg:max-h-[min(80vh,760px)] lg:w-full lg:max-w-[560px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[1.8rem] lg:border lg:border-[color:var(--line-soft)] lg:bg-[color:var(--surface-panel)] lg:px-5 lg:py-5 lg:shadow-[0_24px_64px_rgba(10,8,8,0.34)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-[var(--font-display)] text-base uppercase tracking-[0.08em] text-[color:var(--text-strong)]">使用文档</div>
              <SecondaryButton onClick={closeHelpDialog}>关闭</SecondaryButton>
            </div>

            <div className="mt-5 grid min-h-0 flex-1 gap-5 overflow-y-auto pr-1 lg:pr-2">
              <section className="grid gap-1.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">图片地址</div>
                <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                  隐私考虑。远程图片地址当前结果直接使用上游返回的远程图片地址，站内没有做永久托管。需要保留的结果请及时下载；如果后续出现无法打开或无法下载，以本地已下载文件为准。
                </div>
              </section>

              <section className="grid gap-1.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">本地历史</div>
                <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                  历史只保存在当前浏览器。更换设备、清理浏览器站点数据，或本地存储被手动清空后，历史都不会保留。
                </div>
              </section>

              <section className="grid gap-1.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">参考图保留范围</div>
                <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                  上传的参考图只用于当前一次提交。页面刷新后，历史里不会再带出这些参考图；如果还需要复用，请在提交前自行保留原图。
                </div>
              </section>

              <section className="grid gap-1.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">何时需要清理</div>
                <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                  如果出现历史异常、结果无法继续加载，或者页面提示本地历史已满，优先使用下方清理图片数据；只有页面内清理后仍异常，再考虑清浏览器缓存。
                </div>
              </section>

              <section className="grid gap-3 border-t border-[color:var(--line-soft)] pt-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">数据清理</div>
                <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                  这里会清掉本地历史、当前展示结果和待提交参考图。请先确认需要保留的图片已经下载，清理后本地记录无法恢复。
                </div>

                {pendingClearData ? (
                  <div className="grid gap-3 rounded-[1.2rem] bg-[color:var(--surface-soft)] px-4 py-4">
                    <div className="text-sm leading-6 text-[color:var(--text-muted)]">
                      <span className="font-medium text-[color:var(--status-error)]">确认清理图片数据？</span>
                      <span className="ml-2">已下载的本地文件不会受影响。</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <button
                        type="button"
                        className="text-[color:var(--text-dim)] transition hover:text-[color:var(--text-strong)]"
                        onClick={() => setPendingClearData(false)}
                      >
                        取消
                      </button>
                      <span className="h-3.5 w-px bg-[color:var(--line-soft)]" aria-hidden="true" />
                      <button
                        type="button"
                        className="font-medium text-[color:var(--status-error)] transition hover:text-[color:var(--status-error)]"
                        onClick={handleClearImageData}
                      >
                        确认清理
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex min-h-10 w-fit items-center justify-center rounded-full px-4 text-sm font-medium text-[color:var(--status-error)] transition hover:bg-[color:var(--surface-soft)]"
                    onClick={() => setPendingClearData(true)}
                  >
                    清理图片数据
                  </button>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}

      {clearDataOpen ? (
        <div
          className="fixed inset-0 z-[56] bg-[rgba(10,8,8,0.78)] backdrop-blur-sm"
          role="presentation"
          onClick={closeClearDataDialog}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="清理图片数据"
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-x-4 bottom-4 grid gap-3 rounded-[1.6rem] border border-[color:var(--line-soft)] bg-[color:var(--surface-panel)] px-4 py-4 shadow-[0_24px_64px_rgba(10,8,8,0.34)] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-5 sm:py-5"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">数据清理</div>
            <div className="text-sm leading-6 text-[color:var(--text-muted)]">
              这里会清掉本地历史、当前展示结果和待提交参考图。请先确认需要保留的图片已经下载，清理后本地记录无法恢复。
            </div>
            <div className="text-sm leading-6 text-[color:var(--text-muted)]">
              <span className="font-medium text-[color:var(--status-error)]">确认清理图片数据？</span>
              <span className="ml-2">已下载的本地文件不会受影响。</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                className="text-[color:var(--text-dim)] transition hover:text-[color:var(--text-strong)]"
                onClick={closeClearDataDialog}
              >
                取消
              </button>
              <span className="h-3.5 w-px bg-[color:var(--line-soft)]" aria-hidden="true" />
              <button
                type="button"
                className="font-medium text-[color:var(--status-error)] transition hover:text-[color:var(--status-error)]"
                onClick={handleClearImageData}
              >
                确认清理
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {promptGalleryNoticeOpen ? (
        <div
          className="fixed inset-0 z-[57] bg-[rgba(10,8,8,0.78)] backdrop-blur-sm"
          role="presentation"
          onClick={() => setPromptGalleryNoticeOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="提示词参考提醒"
            onClick={(event) => event.stopPropagation()}
            className="absolute inset-x-4 bottom-4 grid gap-3 rounded-[1.6rem] border border-[color:var(--line-soft)] bg-[color:var(--surface-panel)] px-4 py-4 shadow-[0_24px_64px_rgba(10,8,8,0.34)] sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-5 sm:py-5"
          >
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-dim)]">第三方参考</div>
            <div className="text-sm leading-6 text-[color:var(--text-muted)]">
              即将跳转到第三方生图提示词网站。这里只建议查看提示词参考，不建议操作。
            </div>

            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                className="text-[color:var(--text-dim)] transition hover:text-[color:var(--text-strong)]"
                onClick={() => setPromptGalleryNoticeOpen(false)}
              >
                取消
              </button>
              <span className="h-3.5 w-px bg-[color:var(--line-soft)]" aria-hidden="true" />
              <button
                type="button"
                className="font-medium text-[color:var(--text-strong)] transition hover:text-[color:var(--text-strong)]"
                onClick={handleOpenPromptGallery}
              >
                继续前往
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
          <div
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm shadow-[0_12px_28px_rgba(10,8,8,0.26)] ${
              toast.tone === "error"
                ? "border-[color:var(--status-error)] bg-[color:var(--surface-panel)] text-[color:var(--status-error)]"
                : "border-[color:var(--line-soft)] bg-[color:var(--surface-panel)] text-[color:var(--text-strong)]"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </main>
  );
}
