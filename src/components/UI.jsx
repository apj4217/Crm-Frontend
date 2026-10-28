import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, MoreHorizontal, X, Sparkles } from "lucide-react";
import { cn, initials } from "../lib/utils";
import modalAtmosphere from "../assets/kerala-modal-atmosphere.svg";

export function Button({ children, variant = "primary", size = "md", className = "", onClick, type = "button", disabled = false }) {
  const variants = {
    primary: "bg-violet-600 text-white shadow-sm shadow-violet-200 hover:bg-violet-700",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    subtle: "bg-violet-50 text-violet-700 hover:bg-violet-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700"
  };
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", icon: "h-9 w-9 p-0" };
  return <button type={type} disabled={disabled} onClick={onClick} className={cn("ui-button inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50", variants[variant], sizes[size], className)}>{children}</button>;
}

export function Avatar({ name, color = "violet", size = "md" }) {
  const colors = {
    violet: "bg-violet-100 text-violet-700", rose: "bg-rose-100 text-rose-700", blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700", green: "bg-emerald-100 text-emerald-700", pink: "bg-pink-100 text-pink-700",
    orange: "bg-orange-100 text-orange-700", cyan: "bg-cyan-100 text-cyan-700"
  };
  const dimensions = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-11 w-11 text-sm" };
  return <div className={cn("flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white", colors[color] || colors.violet, dimensions[size])}>{initials(name)}</div>;
}

export function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600", violet: "bg-violet-50 text-violet-700", green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", rose: "bg-rose-50 text-rose-700",
    cyan: "bg-cyan-50 text-cyan-700"
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", tones[tone] || tones.slate)}>{children}</span>;
}

export function Panel({ children, className = "", ...props }) {
  return <section className={cn("ui-panel rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(28,20,54,0.025)]", className)} {...props}>{children}</section>;
}

export function PanelHeading({ title, subtitle, action }) {
  return <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6"><div><h3 className="text-[14px] font-bold tracking-[-.01em] text-slate-900">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>{action}</div>;
}

export function SearchInput({ value, onChange, placeholder = "Search anything...", inputRef }) {
  return <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input ref={inputRef} type="search" aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="ui-field h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"/></div>;
}

export function PageHeading({ eyebrow, title, description, action }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="min-w-0"><div className="ui-page-eyebrow mb-2 flex items-center gap-2 text-[10px] font-bold uppercase"><Sparkles size={12}/>{eyebrow || "Workspace"}</div><h1 className="ui-page-title font-display text-2xl font-extrabold tracking-tight sm:text-[30px]">{title}</h1>{description && <p className="ui-page-description mt-2 max-w-2xl text-sm leading-6">{description}</p>}</div>{action}</div>;
}

export function EmptyState({ title = "Nothing here yet", detail = "Try changing your filters or create a new record." }) {
  return <div className="ui-empty-state flex flex-col items-center justify-center px-6 py-14 text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600"><Search size={20}/></div><p className="text-sm font-bold text-slate-800">{title}</p><p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{detail}</p></div>;
}

export function Modal({ open, onClose, title, description, children, wide = false }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      const topDialog = [...document.querySelectorAll('[aria-modal="true"]')].at(-1);
      if (topDialog && topDialog !== dialogRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && (document.activeElement === focusable[0] || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && (document.activeElement === focusable[focusable.length - 1] || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const frame = window.requestAnimationFrame(() => (dialogRef.current?.querySelector("[data-modal-autofocus]") || dialogRef.current)?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="crm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="crm-modal-atmosphere" aria-hidden="true"><img className="crm-modal-art crm-modal-art-left" src={modalAtmosphere} alt=""/><img className="crm-modal-art crm-modal-art-right" src={modalAtmosphere} alt=""/></div>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={cn("crm-modal-window modal-enter", wide && "crm-modal-window-wide")}>
        <div className="crm-modal-card-art" aria-hidden="true"><img src={modalAtmosphere} alt=""/></div>
        <div className="crm-modal-header">
          <div className="min-w-0">
            <h2 className="crm-modal-title">{title}</h2>
            {description && <p className="crm-modal-description">{description}</p>}
          </div>
          <button type="button" aria-label={"Close " + title} onClick={onClose} className="crm-modal-close"><X size={18}/></button>
        </div>
        <div className="crm-modal-content">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export function useInPageDialog() {
  const [request, setRequest] = useState(null);
  const [draft, setDraft] = useState("");
  const resolveRef = useRef(null);

  const openDialog = (nextRequest) => new Promise((resolve) => {
    resolveRef.current = resolve;
    setDraft(nextRequest.initialValue || "");
    setRequest(nextRequest);
  });
  const settle = (result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setRequest(null);
    resolve?.(result);
  };
  const confirm = (options = {}) => openDialog({ kind: "confirm", ...options });
  const prompt = (options = {}) => openDialog({ kind: "prompt", ...options });

  const dialog = request ? (
    <Modal
      open
      onClose={() => settle(request.kind === "prompt" ? null : false)}
      title={request.title || (request.kind === "prompt" ? "Add details" : "Confirm action")}
      description={request.description}
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (request.kind === "prompt") {
            const answer = draft.trim();
            if (request.required !== false && !answer) return;
            settle(answer);
          } else settle(true);
        }}
      >
        {request.kind === "prompt" && (
          <FormField label={request.inputLabel || "Details"} required={request.required !== false}>
            <input
              data-modal-autofocus
              required={request.required !== false}
              maxLength={request.maxLength || 240}
              className={inputClass}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={request.placeholder || "Enter details…"}
            />
          </FormField>
        )}
        {request.kind === "confirm" && request.note && (
          <div className={request.danger ? "rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800" : "rounded-xl border border-[#dce5d5] bg-[#f1f5ed] p-3 text-xs leading-5 text-[#4c634b]"}>
            {request.note}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e4e5d8] pt-4">
          <Button variant="secondary" onClick={() => settle(request.kind === "prompt" ? null : false)}>{request.cancelText || "Cancel"}</Button>
          <Button type="submit" variant={request.danger ? "danger" : "primary"}>{request.confirmText || (request.kind === "prompt" ? "Save" : "Confirm")}</Button>
        </div>
      </form>
    </Modal>
  ) : null;

  return { confirm, prompt, dialog };
}
export function FormField({ label, children, required }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>{children}</label>;
}

export const inputClass = "ui-field h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100";
export const selectClass = inputClass;

export function TableToolbar({ search, setSearch, placeholder, children }) {
  return <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="w-full sm:max-w-xs"><SearchInput value={search} onChange={setSearch} placeholder={placeholder}/></div><div className="flex flex-wrap items-center gap-2">{children}</div></div>;
}

export function IconButton({ children, type = "button", ...props }) {
  return <button type={type} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" {...props}>{children || <MoreHorizontal size={17}/>}</button>;
}


