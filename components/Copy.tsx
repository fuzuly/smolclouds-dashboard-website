"use client";

import { useEffect, useState } from "react";

/** Copy-to-clipboard with its own feedback. Falls back to selection on denial. */
export function CopyButton({
  value,
  label = "copy",
  className = "",
  onFallback,
}: {
  value: string;
  label?: string;
  className?: string;
  onFallback?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={copied ? "copied" : `copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard blocked (insecure context, denied permission).
          onFallback?.();
        }
      }}
      className={`shrink-0 border px-2.5 py-1 text-[11px] transition-colors ${
        copied
          ? "border-text bg-text text-bg"
          : "border-line text-muted hover:border-line-bright hover:text-text"
      } ${className}`}
    >
      {copied ? "copied" : label}
    </button>
  );
}

/**
 * A shell command the reader is meant to run: prompt glyph, the command, and a
 * copy button that appears on hover but is always reachable by keyboard.
 */
export function Command({
  children,
  copy,
  prompt = "$",
}: {
  children: string;
  copy?: string;
  prompt?: string;
}) {
  return (
    <div className="group flex items-center gap-3 border border-line bg-surface-2 px-4 py-2.5">
      <span aria-hidden className="select-none text-faint">
        {prompt}
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre text-[13px] text-dim">
        {children}
      </code>
      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton value={copy ?? children} label="copy" />
      </span>
    </div>
  );
}
