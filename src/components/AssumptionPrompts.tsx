"use client";

import { useEffect, useRef, useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";

function Modal({
  children,
  onBackdrop,
}: {
  children: React.ReactNode;
  onBackdrop?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && onBackdrop) onBackdrop();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-surface-tertiary w-full max-w-md mx-4 p-6">
        {children}
      </div>
    </div>
  );
}

function NameModal() {
  const { confirmUserName, dismissNameModal } = useModelStore();
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (!name.trim()) return;
    confirmUserName(name);
  };

  return (
    <Modal>
      <h2 className="font-display text-xl text-text-primary mb-2">
        Who&apos;s making this change?
      </h2>
      <p className="text-sm text-text-secondary mb-5">
        Please enter your name so we can attribute this and future edits in the
        change history.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") dismissNameModal();
        }}
        placeholder="Your name"
        className="w-full px-4 py-2.5 rounded-xl border border-surface-tertiary bg-surface-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
      />
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={dismissNameModal}
          className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          Skip
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}

function SaveModal() {
  const {
    acceptSaveSuggestion,
    acceptUpdateExisting,
    dismissSaveModal,
    currentUser,
    lastSavedConfigId,
    lastSavedConfigName,
  } = useModelStore();
  const [name, setName] = useState("");
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasExisting = !!lastSavedConfigId && !!lastSavedConfigName;

  useEffect(() => {
    const stamp = new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const suggested = currentUser && currentUser !== "You"
      ? `${currentUser} — ${stamp}`
      : `Scenario — ${stamp}`;
    setName(suggested);
    if (!hasExisting || showSaveAsNew) {
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [currentUser, hasExisting, showSaveAsNew]);

  // After any save action we honour the "Don't ask again" preference. Without
  // this, the checkbox silently fails on the affirmative paths — only the
  // dismiss path was respecting it before.
  const persistDontAskAgain = () => {
    if (dontAskAgain) useModelStore.getState().setSavePromptDisabled(true);
  };

  const submitNew = () => {
    if (!name.trim()) return;
    acceptSaveSuggestion(name);
    persistDontAskAgain();
  };

  const submitUpdate = () => {
    acceptUpdateExisting();
    persistDontAskAgain();
  };

  return (
    <Modal onBackdrop={() => dismissSaveModal(dontAskAgain)}>
      <h2 className="font-display text-xl text-text-primary mb-2">
        Save your scenario?
      </h2>
      <p className="text-sm text-text-secondary mb-5">
        You&apos;ve made changes to the assumptions. Save them so you can load
        this scenario again on your next visit.
      </p>

      {hasExisting && !showSaveAsNew ? (
        <div className="rounded-xl bg-surface-secondary/40 border border-surface-tertiary px-4 py-3 mb-5">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary mb-1">Last saved</div>
          <div className="text-sm font-medium text-text-primary truncate">{lastSavedConfigName}</div>
        </div>
      ) : (
        <>
          <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1.5">
            Scenario name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") dismissSaveModal(dontAskAgain);
            }}
            className="w-full px-4 py-2.5 rounded-xl border border-surface-tertiary bg-surface-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
          />
        </>
      )}

      <label className="flex items-center gap-2 mt-4 text-xs text-text-tertiary cursor-pointer select-none">
        <input
          type="checkbox"
          checked={dontAskAgain}
          onChange={(e) => setDontAskAgain(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-surface-tertiary text-brand-600 focus:ring-brand-500/30"
        />
        Don&apos;t ask me again
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={() => dismissSaveModal(dontAskAgain)}
          className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          Not now
        </button>
        {hasExisting && !showSaveAsNew ? (
          <>
            <button
              onClick={() => setShowSaveAsNew(true)}
              className="px-4 py-2 rounded-xl text-sm text-text-secondary border border-surface-tertiary hover:bg-surface-secondary transition-colors"
            >
              Save as new…
            </button>
            <button
              onClick={submitUpdate}
              className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all shadow-sm"
            >
              Update &ldquo;{lastSavedConfigName}&rdquo;
            </button>
          </>
        ) : (
          <button
            onClick={submitNew}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            Save scenario
          </button>
        )}
      </div>
    </Modal>
  );
}

// Generic confirm/alert dialog. Activated by `requestConfirm`/`requestAlert`
// on the model store; replaces native `confirm()`/`alert()` use across the app.
function UiPromptModal() {
  const { uiPrompt, resolveUiPrompt } = useModelStore();
  if (!uiPrompt) return null;

  const isConfirm = uiPrompt.kind === 'confirm';
  const danger = isConfirm && (uiPrompt as Extract<typeof uiPrompt, { kind: 'confirm' }>).danger;
  const tone = !isConfirm
    ? (uiPrompt as Extract<typeof uiPrompt, { kind: 'alert' }>).tone ?? 'neutral'
    : undefined;

  const titleColor = danger
    ? 'text-negative'
    : tone === 'success'
      ? 'text-positive'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'error'
          ? 'text-negative'
          : 'text-text-primary';

  const confirmCls = danger
    ? 'bg-negative text-white hover:bg-red-700'
    : 'bg-brand-600 text-white hover:bg-brand-700';

  return (
    <Modal onBackdrop={() => resolveUiPrompt(false)}>
      <h2 className={`font-display text-xl mb-2 ${titleColor}`}>{uiPrompt.title}</h2>
      <p className="text-sm text-text-secondary whitespace-pre-line mb-5">{uiPrompt.message}</p>
      <div className="flex justify-end gap-2">
        {isConfirm && (
          <button
            onClick={() => resolveUiPrompt(false)}
            className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            {(uiPrompt as Extract<typeof uiPrompt, { kind: 'confirm' }>).cancelLabel ?? 'Cancel'}
          </button>
        )}
        <button
          onClick={() => resolveUiPrompt(true)}
          autoFocus
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${confirmCls}`}
        >
          {isConfirm
            ? (uiPrompt as Extract<typeof uiPrompt, { kind: 'confirm' }>).confirmLabel ?? 'Confirm'
            : (uiPrompt as Extract<typeof uiPrompt, { kind: 'alert' }>).okLabel ?? 'OK'}
        </button>
      </div>
    </Modal>
  );
}

export function AssumptionPrompts() {
  const { nameModalOpen, saveModalOpen, uiPrompt } = useModelStore();
  if (nameModalOpen) return <NameModal />;
  if (saveModalOpen) return <SaveModal />;
  if (uiPrompt) return <UiPromptModal />;
  return null;
}
