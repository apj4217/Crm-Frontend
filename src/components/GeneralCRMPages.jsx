import { escapeCsvCell } from "../lib/csv";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MapPin, LocateFixed, ExternalLink, Store, Camera, UserRound, Phone, Mail, Search, Plus,
  Filter, MoreHorizontal, ChevronDown, CalendarClock, MonitorPlay, FlaskConical, Clock3, CheckCircle2,
  AlertTriangle, CalendarDays, MessageCircle, PhoneCall, MapPinned, FileText, Download,
  ArrowUpRight, ShieldCheck, Users, UserCog, RefreshCw, Check, X, Activity, Building2, Target, Zap,
  TimerReset, CircleDollarSign, ClipboardCheck, Sparkles, SwitchCamera, ImagePlus, Pencil, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Avatar, Badge, Button, EmptyState, FormField, Modal, PageHeading, Panel, PanelHeading, SearchInput, TableToolbar, useInPageDialog, inputClass, selectClass } from "./UI";
import { createId } from "../lib/utils";
const formatINR = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

const featureOptions = ["Automation", "Reporting & analytics", "Integrations", "Mobile access", "Team collaboration", "Customer support", "Workflow customization", "Data migration", "Security & permissions", "Other"];
const stageTone = { New: "slate", Contacted: "blue", Qualified: "violet", "Demo Requested": "amber", "Demo Scheduled": "blue", "Demo Completed": "violet", "Trial Requested": "amber", "Trial Active": "green", Negotiation: "cyan", Won: "green", Lost: "rose" };
const stageLabel = (value) => ({ "Demo Requested": "Meeting Requested", "Demo Scheduled": "Meeting Scheduled", "Demo Completed": "Meeting Completed", "Trial Requested": "Evaluation Requested", "Trial Active": "Evaluation Active" }[value] || value || "New");
const trialTone = { Requested: "amber", Approved: "blue", Active: "green", Expired: "rose", Extended: "violet", Converted: "green", Cancelled: "slate" };
const priorityTone = { High: "rose", Medium: "blue", Low: "slate", Hot: "rose", Warm: "amber", Cold: "slate" };
const leadPriority = (value) => ({ Hot: "High", Warm: "Medium", Cold: "Low" }[value] || (["High", "Medium", "Low"].includes(value) ? value : "Medium"));
const demoTone = { Requested: "amber", Scheduled: "blue", Completed: "green", Rescheduled: "violet", Cancelled: "slate" };
const fieldClass = inputClass;
const MAX_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_INPUT_BYTES = 12 * 1024 * 1024;

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function optimizePhotoFile(file) {
  let image;
  let objectUrl = "";
  if (typeof createImageBitmap === "function") {
    image = await createImageBitmap(file);
  } else {
    objectUrl = URL.createObjectURL(file);
    image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read this image."));
      element.src = objectUrl;
    }).finally(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
  }

  try {
    const sourceWidth = image.width || image.naturalWidth;
    const sourceHeight = image.height || image.naturalHeight;
    if (!sourceWidth || !sourceHeight) throw new Error("This image could not be decoded.");
    const maxSide = 1440;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image optimization is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToBlob(canvas, "image/webp", 0.80);
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.82);
    if (!blob) throw new Error("Could not compress this image. Please try another photo.");

    // If a small, already-optimized image is smaller than the new encode, keep the original.
    if (scale === 1 && blob.size >= file.size && file.size <= MAX_PHOTO_UPLOAD_BYTES) return file;
    const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    const extension = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "business-photo"}.${extension}`, {
      type, lastModified: Date.now()
    });
  } finally {
    image.close?.();
  }
}

function assignableNames(team, currentUser, role) {
  const permitted = (team || []).filter((u) => u.status === "Active" && (role === "SUPER_ADMIN" ? ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(u.role) : role === "ADMIN" ? ["STAFF", "ADMIN"].includes(u.role) : u.name === currentUser)).map((u) => u.name);
  return [...new Set([...(currentUser ? [currentUser] : []), ...permitted])];
}

function nameOf(medicals, id) { return medicals.find((m) => String(m.id) === String(id))?.medicalName || "Unknown account"; }
function ownerOf(medicals, id) { return medicals.find((m) => String(m.id) === String(id))?.ownerName || "Contact not set"; }
function accountSelectOptions(medicals) {
  return (medicals || []).filter((account) => !account.archived).map((account) => ({
    value: account.id,
    label: [account.medicalName, account.ownerName, account.locality || account.city, account.phone].filter(Boolean).join(" · ")
  }));
}
function initialsName(name = "") { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase(); }
function toDateTimeLocal(value) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function dateLabel(value) { if (!value) return "Not scheduled"; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(String(value).includes("T") ? { hour: "2-digit", minute: "2-digit" } : {}) }); }
function daysUntil(value) { if (!value) return null; const end = new Date(`${String(value).slice(0, 10)}T23:59:59`); return Math.ceil((end - new Date()) / 86400000); }
function csvDownload(filename, headers, rows) { const blob = new Blob(["\uFEFF" + [headers, ...rows].map((r) => r.map(escapeCsvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function saveBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function excelColumn(index) {
  let value = index + 1, label = "";
  while (value) { const remainder = (value - 1) % 26; label = String.fromCharCode(65 + remainder) + label; value = Math.floor((value - 1) / 26); }
  return label;
}
function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function storedZip(files) {
  const encoder = new TextEncoder(), localChunks = [], centralChunks = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = encoder.encode(file.content), checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length), localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); localView.setUint16(4, 20, true); localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true); localView.setUint16(10, 0, true); localView.setUint16(12, 0x21, true);
    localView.setUint32(14, checksum, true); localView.setUint32(18, data.length, true); localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true); localView.setUint16(28, 0, true); local.set(name, 30); local.set(data, 30 + name.length);
    localChunks.push(local);
    const central = new Uint8Array(46 + name.length), centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true); centralView.setUint16(4, 20, true); centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true); centralView.setUint16(10, 0, true); centralView.setUint16(12, 0, true); centralView.setUint16(14, 0x21, true);
    centralView.setUint32(16, checksum, true); centralView.setUint32(20, data.length, true); centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true); centralView.setUint16(30, 0, true); centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true); centralView.setUint16(36, 0, true); centralView.setUint32(38, 0, true); centralView.setUint32(42, offset, true);
    central.set(name, 46); centralChunks.push(central); offset += local.length;
  }
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(4, 0, true); view.setUint16(6, 0, true);
  view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, centralSize, true); view.setUint32(16, offset, true); view.setUint16(20, 0, true);
  return new Blob([...localChunks, ...centralChunks, end], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function workbookDownload(filename, sheets) {
  const encoder = new TextEncoder();
  const sheetFiles = sheets.map((sheet, sheetIndex) => {
    const rows = sheet.rows.map((row, rowIndex) => "<row r=\"" + (rowIndex + 1) + "\">" + row.map((value, columnIndex) => {
      const ref = excelColumn(columnIndex) + (rowIndex + 1);
      if (typeof value === "number" && Number.isFinite(value)) return "<c r=\"" + ref + "\" t=\"n\"><v>" + value + "</v></c>";
      return "<c r=\"" + ref + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" + xmlEscape(value) + "</t></is></c>";
    }).join("") + "</row>").join("");
    return { name: "xl/worksheets/sheet" + (sheetIndex + 1) + ".xml", content: "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>" + rows + "</sheetData></worksheet>" };
  });
  const contentTypes = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" + sheets.map((_, i) => "<Override PartName=\"/xl/worksheets/sheet" + (i + 1) + ".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>").join("") + "</Types>";
  const workbook = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>" + sheets.map((sheet, i) => "<sheet name=\"" + xmlEscape(sheet.name) + "\" sheetId=\"" + (i + 1) + "\" r:id=\"rId" + (i + 1) + "\"/>").join("") + "</sheets></workbook>";
  const workbookRels = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" + sheets.map((_, i) => "<Relationship Id=\"rId" + (i + 1) + "\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet" + (i + 1) + ".xml\"/>").join("") + "</Relationships>";
  const rootRels = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>";
  saveBlob(filename, storedZip([{ name: "[Content_Types].xml", content: contentTypes }, { name: "_rels/.rels", content: rootRels }, { name: "xl/workbook.xml", content: workbook }, { name: "xl/_rels/workbook.xml.rels", content: workbookRels }, ...sheetFiles]));
}
function printReport(title, sheets) {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  const escapeHtml = (value) => xmlEscape(value);
  const sections = sheets.map((sheet) => "<section><h2>" + escapeHtml(sheet.name) + "</h2><table><tbody>" + sheet.rows.map((row, rowIndex) => "<tr>" + row.map((cell) => rowIndex === 0 ? "<th>" + escapeHtml(cell) + "</th>" : "<td>" + escapeHtml(typeof cell === "number" ? cell.toLocaleString("en-IN") : cell) + "</td>").join("") + "</tr>").join("") + "</tbody></table></section>").join("");
  popup.document.open(); popup.document.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>" + escapeHtml(title) + "</title><style>body{font:14px Arial,sans-serif;color:#24392b;padding:32px;max-width:1100px;margin:auto}h1{font:600 28px Georgia,serif;margin-bottom:6px}p{color:#647465;margin-top:0}h2{font:600 18px Georgia,serif;margin:24px 0 9px}table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{text-align:left;border:1px solid #dce3d7;padding:8px 10px}th{background:#eef2e9;color:#35533a}tr:nth-child(even) td{background:#fafbf7}@media print{body{padding:0}section{break-inside:avoid}h1{margin-top:0}}</style></head><body><h1>" + escapeHtml(title) + "</h1><p>Generated " + escapeHtml(new Date().toLocaleString("en-IN")) + " · CRM sales intelligence</p>" + sections + "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))<\/script></body></html>"); popup.document.close();
  return true;
}

function SearchableSelect({ value, onChange, options, placeholder = "Type to search or choose…", className = fieldClass, disabled = false, required = false, allowCustom = false }) {
  const id = "crm-options-" + useId().replace(/:/g, "");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const selected = options.find((option) => String(option.value) === String(value ?? ""));
  const [query, setQuery] = useState(selected?.label || "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return options.filter((option) => !term || option.label.toLocaleLowerCase().includes(term)).slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.label || "");
  }, [open, selected?.label, value]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        if (allowCustom) {
          const text = query.trim();
          onChange(text);
          setQuery(text);
        } else {
          const match = options.find((option) => option.label.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
          if (match) onChange(match.value);
          else { inputRef.current?.setCustomValidity(""); onChange(""); setQuery(""); }
        }
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [allowCustom, onChange, open, options, query]);

  const choose = (option) => {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(0);
  };
  const handleBlur = () => {
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      if (allowCustom) {
        const text = query.trim();
        onChange(text);
        setQuery(text);
      } else {
        const match = options.find((option) => option.label.toLocaleLowerCase() === query.trim().toLocaleLowerCase());
        if (match) choose(match);
        else { inputRef.current?.setCustomValidity(""); onChange(""); setQuery(""); }
      }
    }, 0);
  };
  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
    } else if (event.key === "Enter" && open && allowCustom && query.trim()) {
      event.preventDefault();
      onChange(query.trim());
      setOpen(false);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selected?.label || "");
    }
  };

  return <div ref={rootRef} className="crm-searchable-select">
    <Search size={15} aria-hidden="true" className="crm-searchable-select-icon"/>
    <input
      ref={inputRef}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={id}
      aria-activedescendant={open && filtered[activeIndex] ? id + "-option-" + activeIndex : undefined}
      value={query}
      disabled={disabled}
      required={required}
      className={className + " crm-searchable-select-input"}
      placeholder={placeholder}
      autoComplete="off"
      onFocus={(event) => { setOpen(true); setActiveIndex(-1); if (query && query === selected?.label) event.currentTarget.select(); }}
      onClick={(event) => { if (query && query === selected?.label) event.currentTarget.select(); setOpen(true); }}
      onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); setActiveIndex(-1); setOpen(true); if (!allowCustom) { onChange(""); const exact = options.some((option) => option.label.toLocaleLowerCase() === nextQuery.trim().toLocaleLowerCase()); event.currentTarget.setCustomValidity(required && nextQuery && !exact ? "Choose an option from the list." : ""); } }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
    <ChevronDown size={16} aria-hidden="true" className={"crm-searchable-select-chevron" + (open ? " is-open" : "")}/>
    {open && <div id={id} role="listbox" aria-label="Available options" className="crm-searchable-select-menu">
      {filtered.length ? filtered.map((option, index) => (
        <button
          id={id + "-option-" + index}
          key={String(option.value)}
          type="button"
          role="option"
          aria-selected={String(option.value) === String(value ?? "")}
          className={"crm-searchable-select-option" + (index === activeIndex ? " is-active" : "")}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        >
          <span>{option.label}</span>
          {String(option.value) === String(value ?? "") && <Check size={15}/>}
        </button>
      )) : <div className="crm-searchable-select-empty">{allowCustom ? "Press Enter to use this value" : "No matching options"}</div>}
    </div>}
  </div>;
}

function FieldGrid({ children }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function PhotoPicker({ label, value, onChange, kind = "medical", onProcessingChange }) {
  const [preview, setPreview] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [facingMode, setFacingMode] = useState(kind === "owner" ? "user" : "environment");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (typeof File !== "undefined" && value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(value || "");
    return undefined;
  }, [value]);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;
    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const startStream = async () => {
      setCameraLoading(true);
      setCameraError("");
      if (!window.isSecureContext) {
        setCameraError("This page is not using a secure connection. On PC, open http://localhost:5173. For phone testing, stop the normal dev servers and run npm.cmd run dev:mobile from the project root, then open its HTTPS URL. Allow camera access in your browser.");
        setCameraLoading(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser does not expose the live camera API. Use an up-to-date Chrome/Safari browser, allow camera access, or choose an image instead.");
        setCameraLoading(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraLoading(false);
      } catch (error) {
        if (!cancelled) {
          setCameraError(error?.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in your browser or choose an image."
            : "Could not open the camera. Close other camera apps or choose an image instead.");
          setCameraLoading(false);
        }
      }
    };
    stopStream();
    startStream();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [cameraOpen, facingMode]);

  const chooseFile = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image.");
      input.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_INPUT_BYTES) {
      toast.error("Choose an image smaller than 12 MB.");
      input.value = "";
      return;
    }

    setCompressing(true);
    onProcessingChange?.(true);
    try {
      const optimized = await optimizePhotoFile(file);
      if (optimized.size > MAX_PHOTO_UPLOAD_BYTES) {
        toast.error("This image is still too large after optimization. Choose a smaller photo.");
        return;
      }
      onChange(optimized);
      const savedPercent = file.size > 0 ? Math.max(0, Math.round((1 - optimized.size / file.size) * 100)) : 0;
      toast.success(savedPercent > 0 ? `Photo optimized · ${savedPercent}% smaller` : "Photo ready to upload");
    } catch (error) {
      toast.error(error?.message || "Could not optimize this photo. Please try another image.");
    } finally {
      setCompressing(false);
      onProcessingChange?.(false);
      input.value = "";
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error("Camera is not ready yet. Please wait a moment and try again.");
      return;
    }
    const maxSide = 1440;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Could not capture the image. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const finishCapture = (blob) => {
      if (!blob) {
        toast.error("Could not prepare the photo. Please try again.");
        return;
      }
      if (blob.size > MAX_PHOTO_UPLOAD_BYTES) {
        toast.error("Photo is too large after optimization. Move closer and try again.");
        return;
      }
      const prefix = kind === "owner" ? "contact-photo" : "business-photo";
      const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
      const ext = type === "image/webp" ? "webp" : "jpg";
      const photoFile = new File([blob], `${prefix}-${Date.now()}.${ext}`, { type, lastModified: Date.now() });
      onChange(photoFile);
      setCameraOpen(false);
      toast.success(`${label} captured and optimized`);
    };
    canvas.toBlob((blob) => {
      if (blob?.type === "image/webp") finishCapture(blob);
      else canvas.toBlob(finishCapture, "image/jpeg", 0.82);
    }, "image/webp", 0.80);
  };

  return <>
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <span className="mb-3 block text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100 sm:h-[88px] sm:w-[88px]">
          {preview ? <img loading="lazy" decoding="async" src={preview} alt={label} className="h-full w-full object-cover"/> : kind === "owner" ? <UserRound size={27}/> : <Store size={27}/>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-800">{value ? "Photo ready" : "No photo added"}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Photos are resized and compressed before upload.</p>
          {compressing && <p className="mt-1 text-[11px] font-semibold text-violet-600">Optimizing photo…</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={compressing} onClick={() => { setFacingMode(kind === "owner" ? "user" : "environment"); setCameraError(""); setCameraOpen(true); }}><Camera size={13}/> Open camera</Button>
            <Button type="button" size="sm" variant="secondary" disabled={compressing} onClick={() => fileInputRef.current?.click()}><ImagePlus size={13}/> {compressing ? "Optimizing…" : "Choose image"}</Button>
            {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange("")}>Remove</Button>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseFile}/>
        </div>
      </div>
    </div>
    {cameraOpen && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={`Capture ${label}`}>
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div className="min-w-0"><h3 className="text-sm font-bold text-slate-900">Capture {label.toLowerCase()}</h3><p className="mt-0.5 text-[11px] text-slate-500">Keep the subject inside the frame.</p></div>
            <button type="button" aria-label="Close camera" onClick={() => setCameraOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
          </div>
          <div className="relative aspect-[4/3] max-h-[58vh] w-full overflow-hidden bg-slate-950">
            <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-contain ${cameraLoading || cameraError ? "opacity-0" : "opacity-100"}`}/>
            {(cameraLoading || cameraError) && <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white"><Camera size={28} className="mb-3 opacity-70"/>{cameraLoading ? <p className="text-sm">Opening camera…</p> : <p className="max-w-sm text-sm leading-6">{cameraError}</p>}{cameraError && <Button className="mt-4" onClick={() => { setCameraOpen(false); fileInputRef.current?.click(); }}>Choose image instead</Button>}</div>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-4 sm:px-5">
            <Button type="button" variant="secondary" onClick={() => setFacingMode((mode) => mode === "environment" ? "user" : "environment")} disabled={cameraLoading || Boolean(cameraError)}><SwitchCamera size={15}/> Switch camera</Button>
            <div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => setCameraOpen(false)}>Cancel</Button><Button type="button" onClick={capturePhoto} disabled={cameraLoading || Boolean(cameraError)}><Check size={15}/> Use photo</Button></div>
          </div>
        </div>
      </div>, document.body
    )}
  </>;
}

export function AccountsPage({ medicals, setMedicals, role, currentUser, team = [], searchRequest, onAccountDeleted }) {
  const { confirm: confirmInPage, prompt: promptInPage, dialog: accountDialog } = useInPageDialog();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("All");
  useEffect(() => { if (searchRequest?.term) { setSearch(searchRequest.term); setStage("All"); } }, [searchRequest?.key]);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({});
  const [geoBusy, setGeoBusy] = useState(false);
  const [photoProcessingCount, setPhotoProcessingCount] = useState(0);
  const [duplicate, setDuplicate] = useState(null);
  const filtered = useMemo(() => medicals.filter((m) => `${m.medicalName} ${m.ownerName} ${m.phone} ${m.locality} ${m.city} ${m.email}`.toLowerCase().includes(search.toLowerCase()) && (stage === "All" || m.salesStage === stage)), [medicals, search, stage]);
  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const openCreate = () => { setForm({ medicalType: "Business", leadSource: "Referral", salesStage: "New", priority: "Medium", assignedTo: currentUser, branchCount: 1, billingCounters: 1, requiredFeatures: [], locationMethod: "Not captured" }); setDuplicate(null); setFormOpen(true); };
  const captureLocation = () => {
    if (!window.isSecureContext) { toast.error("GPS needs a secure page. On PC use http://localhost:5173; on a phone run npm.cmd run dev:mobile from the project root and open the generated HTTPS URL."); return; }
    if (!navigator.geolocation) { toast.error("This browser does not support GPS location."); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const patch = { latitude, longitude, locationAccuracy: Math.round(accuracy), locationCapturedAt: new Date().toISOString(), locationMethod: "GPS", googleMapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}` };
      setForm((p) => ({ ...p, ...patch }));
      toast.success("Current device location captured", { description: `Accuracy about ${Math.round(accuracy)} m. Verify the pin belongs to this account.` });
            // Coordinates stay in this CRM until the user saves them; no third-party geocoder is called automatically.
      setGeoBusy(false);
    }, (error) => { setGeoBusy(false); toast.error(error.code === 1 ? "Location permission was denied. Enter the address or choose a map pin manually." : "Could not get location. Try again or enter the address manually."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const saveMedical = async (e) => {
    e.preventDefault();
    if (photoProcessingCount > 0) { toast.info("Wait for photo optimization to finish before saving."); return; }
    const hasLatitude = form.latitude !== "" && form.latitude != null;
    const hasLongitude = form.longitude !== "" && form.longitude != null;
    if (hasLatitude !== hasLongitude) { toast.error("Latitude and longitude must both be entered, or both left blank."); return; }
    const phone = String(form.phone || "").replace(/\D/g, "");
    const possible = medicals.find((m) => m.id !== form.id && ((phone && String(m.phone || "").replace(/\D/g, "") === phone) || (m.medicalName.trim().toLowerCase() === String(form.medicalName).trim().toLowerCase() && m.pincode === form.pincode)));
    if (form.salesStage === "Lost" && !String(form.lostReason || "").trim()) { toast.error("Add a reason before marking this opportunity Lost."); return; }
    if (possible && duplicate !== possible.id) { setDuplicate(possible.id); toast.warning("Possible duplicate account found", { description: `${possible.medicalName} — ${possible.phone}. Review before saving.` }); return; }
    if (possible && duplicate === possible.id && role === "STAFF") { toast.error("This looks like an existing account. Ask an Admin to review a duplicate entry."); return; }
    if (possible && duplicate === possible.id && !await confirmInPage({ title: "Possible duplicate account", description: `${possible.medicalName} may already be in your workspace. Do you want to create another account anyway?`, confirmText: "Create anyway", note: "Review the existing account details before continuing." })) return;
    const record = { ...form, latitude: form.latitude === "" || form.latitude == null ? null : Number(form.latitude), longitude: form.longitude === "" || form.longitude == null ? null : Number(form.longitude), locationAccuracy: form.locationAccuracy === "" || form.locationAccuracy == null ? null : Number(form.locationAccuracy), allowDuplicate: Boolean(possible && duplicate === possible.id), phone: form.phone || "", whatsapp: form.whatsapp || form.phone || "", ownerName: form.ownerName || "Not provided", requiredFeatures: form.requiredFeatures || [], branchCount: Number(form.branchCount) || 1, billingCounters: Number(form.billingCounters) || 1, updatedAt: new Date().toISOString(), createdBy: form.createdBy || currentUser, assignedTo: form.assignedTo || currentUser, salesStage: form.salesStage || "New", priority: leadPriority(form.priority) };
    const result = form.id
      ? await setMedicals((p) => p.map((m) => m.id === form.id ? { ...m, ...record } : m))
      : await setMedicals((p) => [{ id: createId(), ...record, createdAt: new Date().toISOString() }, ...p]);
    if (result?.success === false) return;
    setFormOpen(false); setDuplicate(null); toast.success(form.id ? "Account updated" : "Account created", { description: `${form.medicalName} has been saved.` });
  };
  const updateStage = async (id, salesStage) => { const result = await setMedicals((p) => p.map((m) => m.id === id ? { ...m, salesStage, updatedAt: new Date().toISOString() } : m)); if (result?.success !== false) toast.success("Sales stage update saved"); };
  const exportList = () => csvDownload("crm-accounts.csv", ["Account", "Contact", "Phone", "Email", "Locality", "City", "Sales stage", "Lead source", "Assigned to", "Latitude", "Longitude"], filtered.map((m) => [m.medicalName, m.ownerName, m.phone, m.email, m.locality, m.city, m.salesStage, m.leadSource, m.assignedTo, m.latitude, m.longitude]));
  return <>
    <PageHeading eyebrow="Customer database" title="Accounts"  action={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={exportList}><Download size={15}/> Export</Button><Button onClick={openCreate}><Plus size={16}/> Add account</Button></div>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Total accounts", value: medicals.length, icon: Store, tint: "violet" }, { label: "High-priority leads", value: medicals.filter((m) => leadPriority(m.priority) === "High").length, icon: Activity, tint: "rose" }, { label: "With GPS saved", value: medicals.filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude)).length, icon: MapPin, tint: "blue" }, { label: "Leads from field activity", value: medicals.filter((m) => m.leadSource === "Field Visit").length, icon: MapPinned, tint: "green" }].map((x) => <Panel key={x.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tint === "rose" ? "bg-rose-50 text-rose-600" : x.tint === "blue" ? "bg-blue-50 text-blue-600" : x.tint === "green" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}><x.icon size={18}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{x.value}</p></div></Panel>)}</div>
    <Panel className="overflow-hidden"><TableToolbar search={search} setSearch={setSearch} placeholder="Search account, contact, phone, area..."><select value={stage} onChange={(e) => setStage(e.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option>{["New", "Contacted", "Qualified", "Demo Requested", "Demo Scheduled", "Demo Completed", "Trial Requested", "Trial Active", "Negotiation", "Won", "Lost"].map((x) => <option key={x} value={x}>{stageLabel(x)}</option>)}</select></TableToolbar>
      <div className="divide-y divide-slate-100 md:hidden">
        {filtered.map((m) => <article key={m.id} className="p-4">
          <button type="button" onClick={() => setDetail(m)} className="flex w-full items-center gap-3 text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">{m.medicalPhotoUrl ? <img loading="lazy" decoding="async" src={m.medicalPhotoUrl} alt={m.medicalName} className="h-full w-full object-cover"/> : <Store size={21}/>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{m.medicalName}</p><div className="mt-1 flex min-w-0 items-center gap-2"><div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">{m.ownerPhotoUrl ? <img loading="lazy" decoding="async" src={m.ownerPhotoUrl} alt={m.ownerName || "Contact"} className="h-full w-full object-cover"/> : <UserRound size={13}/>}</div><span className="truncate text-xs text-slate-500">{m.ownerName || "Contact not added"}</span></div></div>
            <ArrowUpRight size={16} className="shrink-0 text-slate-400"/>
          </button>
          <div className="mt-3 space-y-1.5 pl-[68px] text-xs text-slate-600"><p className="flex items-center gap-2"><Phone size={13} className="text-slate-400"/>{m.phone || "No phone number"}</p><p className="flex items-center gap-2"><MapPin size={13} className="text-slate-400"/>{[m.locality, m.city, m.pincode].filter(Boolean).join(", ") || "Location not added"}</p></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={stageTone[m.salesStage] || "slate"}>{stageLabel(m.salesStage)}</Badge><Badge tone={priorityTone[leadPriority(m.priority)] || "slate"}>{leadPriority(m.priority)}</Badge><span className="ml-auto max-w-[45%] truncate text-[10px] text-slate-400">{m.assignedTo || "Unassigned"}</span></div>
          <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            {m.phone && <a href={`tel:${m.phone}`} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"><Phone size={13}/> Call</a>}
            {Number.isFinite(m.latitude) && Number.isFinite(m.longitude) && <a href={m.googleMapsUrl || `https://www.google.com/maps?q=${m.latitude},${m.longitude}`} target="_blank" rel="noreferrer" className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700"><MapPin size={13}/> Map</a>}
            <button type="button" onClick={() => { setForm({ ...m }); setDuplicate(null); setFormOpen(true); }} className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-50 text-xs font-semibold text-violet-700"><MoreHorizontal size={14}/> Edit</button>
          </div>
        </article>)}
        {!filtered.length && <EmptyState title="No accounts found" detail="Try another search or add a business."/>}
      </div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1000px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Account / Contact</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Sales stage</th><th className="px-3 py-3">Assigned to</th><th className="px-3 py-3">GPS</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{filtered.map((m, idx) => <tr key={m.id} className="border-b border-slate-50 transition hover:bg-violet-50/30"><td className="px-5 py-3.5"><button onClick={() => setDetail(m)} className="flex items-center gap-3 text-left"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600">{m.medicalPhotoUrl ? <img loading="lazy" decoding="async" src={m.medicalPhotoUrl} alt={m.medicalName} className="h-full w-full object-cover"/> : <Store size={17}/>}</div><div><p className="text-xs font-bold text-slate-800">{m.medicalName}</p><p className="mt-1 text-[10px] text-slate-400">Primary contact: {m.ownerName}</p></div></button></td><td className="px-3 py-3.5"><p className="flex items-center gap-1.5 text-xs text-slate-700"><Phone size={12} className="text-slate-400"/>{m.phone || "—"}</p><p className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"><Mail size={11}/>{m.email || "No email"}</p></td><td className="px-3 py-3.5"><p className="text-xs text-slate-700">{m.locality || m.city || "Address pending"}</p><p className="mt-1 text-[10px] text-slate-400">{[m.city, m.pincode].filter(Boolean).join(" · ")}</p></td><td className="px-3 py-3.5"><Badge tone={stageTone[m.salesStage] || "slate"}>{stageLabel(m.salesStage)}</Badge><p className="mt-1.5"><Badge tone={priorityTone[leadPriority(m.priority)] || "slate"}>{leadPriority(m.priority)}</Badge></p></td><td className="px-3 py-3.5"><div className="flex items-center gap-2"><Avatar name={m.assignedTo || "Unassigned"} size="sm" color={idx % 2 ? "blue" : "violet"}/><span className="text-xs text-slate-600">{m.assignedTo || "Unassigned"}</span></div></td><td className="px-3 py-3.5">{Number.isFinite(m.latitude) && Number.isFinite(m.longitude) ? <a href={m.googleMapsUrl || `https://www.google.com/maps?q=${m.latitude},${m.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"><MapPin size={13}/> Open map <ExternalLink size={11}/></a> : <span className="text-[11px] text-slate-400">Not captured</span>}</td><td className="px-4 py-3.5"><div className="flex items-center gap-1"><button onClick={() => setDetail(m)} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">View</button><button onClick={() => { setForm({ ...m }); setDuplicate(null); setFormOpen(true); }} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-violet-700"><MoreHorizontal size={17}/></button></div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title="No accounts found" detail="Try another search or add a business prospect."/>}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">Showing <b className="text-slate-700">{filtered.length}</b> accounts</div></Panel>
    <Modal open={formOpen} onClose={() => { setFormOpen(false); setDuplicate(null); }} title={form.id ? "Edit account profile" : "Add account"} description="Add account, contact, and opportunity details. Location is optional for remote customers." wide>
      <form onSubmit={saveMedical} className="space-y-5"><div className="rounded-xl bg-violet-50/70 p-3 text-xs leading-5 text-violet-800">Add business and contact photos separately. Save the location after confirming the map pin.</div>
        <div><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Store size={14}/> Business details</h3><FieldGrid><FormField label="Business / account name" required><input required className={fieldClass} value={form.medicalName || ""} onChange={(e) => set("medicalName", e.target.value)} placeholder="e.g. Acme Solutions"/></FormField><FormField label="Business type"><SearchableSelect allowCustom value={form.medicalType || "Business"} onChange={(value) => set("medicalType", value)} placeholder="Search or enter a business type…" options={["Business", "Technology / SaaS", "IT services", "Retail", "Wholesale / Distribution", "Manufacturing", "Healthcare", "Education", "Finance", "Real estate", "Hospitality", "Logistics", "Professional services", "Agency", "Other"].map((item) => ({ value: item, label: item }))}/></FormField><FormField label="Business phone" required><input required className={fieldClass} value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91..."/></FormField><FormField label="WhatsApp number"><input className={fieldClass} value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as phone if not different"/></FormField><div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white/70 p-3"><label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-700"><input type="checkbox" checked={Boolean(form.whatsappOptIn)} onChange={(e) => set("whatsappOptIn", e.target.checked)} className="mt-1 accent-violet-600"/><span><b>WhatsApp messaging consent confirmed</b><span className="block text-[11px] text-slate-500">Only tick this when the contact has explicitly agreed to receive WhatsApp messages. Required before campaign sending.</span></span></label></div><FormField label="Business email"><input type="email" className={fieldClass} value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="shop@example.com"/></FormField><FormField label="Current solution / tools"><SearchableSelect allowCustom value={form.currentSoftware || ""} onChange={(value) => set("currentSoftware", value)} placeholder="Search or enter current tools…" options={["Excel / Google Sheets", "Existing CRM", "ERP system", "POS / billing software", "Paper registers", "Custom software", "Email and messaging", "No current system", "Other"].map((item) => ({ value: item, label: item }))}/></FormField><FormField label="Business locations"><input type="number" min="1" className={fieldClass} value={form.branchCount ?? 1} onChange={(e) => set("branchCount", e.target.value)}/></FormField><FormField label="Team / operating units"><input type="number" min="1" className={fieldClass} value={form.billingCounters ?? 1} onChange={(e) => set("billingCounters", e.target.value)}/></FormField></FieldGrid><div className="mt-4 grid gap-4 sm:grid-cols-2"><PhotoPicker kind="medical" label="Business photo" value={form.medicalPhotoUrl || ""} onChange={(v) => set("medicalPhotoUrl", v)} onProcessingChange={(busy) => setPhotoProcessingCount((count) => Math.max(0, count + (busy ? 1 : -1)))}/><PhotoPicker kind="owner" label="Primary contact photo" value={form.ownerPhotoUrl || ""} onChange={(v) => set("ownerPhotoUrl", v)} onProcessingChange={(busy) => setPhotoProcessingCount((count) => Math.max(0, count + (busy ? 1 : -1)))}/></div></div>
        <div><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><UserRound size={14}/> Primary contact</h3><FieldGrid><FormField label="Contact full name"><input className={fieldClass} value={form.ownerName || ""} onChange={(e) => set("ownerName", e.target.value)} placeholder="Contact name"/></FormField><FormField label="Contact phone"><input className={fieldClass} value={form.ownerPhone || ""} onChange={(e) => set("ownerPhone", e.target.value)} placeholder="Direct contact number"/></FormField><FormField label="Contact email"><input type="email" className={fieldClass} value={form.ownerEmail || ""} onChange={(e) => set("ownerEmail", e.target.value)} placeholder="contact@example.com"/></FormField><FormField label="Decision maker"><SearchableSelect allowCustom value={form.decisionMaker || ""} onChange={(value) => set("decisionMaker", value)} placeholder="Search or enter a role or name…" options={["Owner / Founder", "CEO / Managing Director", "Operations Manager", "Sales Manager", "IT Manager", "Finance Manager", "Procurement Manager", "Branch Manager", "Other"].map((item) => ({ value: item, label: item }))}/></FormField></FieldGrid></div>
        <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><MapPin size={14}/> Location</h3><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={captureLocation} disabled={geoBusy}><LocateFixed size={14}/>{geoBusy ? "Locating..." : "Use current location"}</Button><Button type="button" size="sm" variant="secondary" onClick={() => { const q = [form.addressLine, form.locality, form.city, form.state, form.pincode].filter(Boolean).join(", "); if (!q) { toast.error("Enter an address first."); return; } window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, "_blank", "noopener,noreferrer"); }}><MapPinned size={14}/> Search address on map</Button>{(form.latitude != null || form.longitude != null) && <Button type="button" size="sm" variant="secondary" onClick={() => setForm(p => ({ ...p, latitude: null, longitude: null, locationAccuracy: null, locationCapturedAt: null, locationMethod: "Not captured", googleMapsUrl: "" }))}><X size={14}/> Clear location</Button>}</div></div><FieldGrid><FormField label="Address / street"><input className={fieldClass} value={form.addressLine || ""} onChange={(e) => set("addressLine", e.target.value)} placeholder="Street, landmark"/></FormField><FormField label="Area / locality"><input className={fieldClass} value={form.locality || ""} onChange={(e) => set("locality", e.target.value)} placeholder="Area"/></FormField><FormField label="City"><input className={fieldClass} value={form.city || ""} onChange={(e) => set("city", e.target.value)} placeholder="City"/></FormField><FormField label="State"><input className={fieldClass} value={form.state || ""} onChange={(e) => set("state", e.target.value)} placeholder="State"/></FormField><FormField label="PIN code"><input className={fieldClass} value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} placeholder="6-digit PIN"/></FormField><FormField label="Latitude (manual pin optional)"><input type="number" step="any" className={fieldClass} value={form.latitude ?? ""} onChange={(e) => setForm(p => ({ ...p, latitude: e.target.value === "" ? null : e.target.value, locationMethod: e.target.value === "" ? (p.locationMethod || "Not captured") : "MANUAL_PIN", locationCapturedAt: e.target.value === "" ? p.locationCapturedAt : null, locationAccuracy: e.target.value === "" ? p.locationAccuracy : null, googleMapsUrl: e.target.value !== "" && p.longitude !== undefined && p.longitude !== null ? `https://www.google.com/maps?q=${e.target.value},${p.longitude}` : p.googleMapsUrl }))} placeholder="e.g. 18.5204"/></FormField><FormField label="Longitude (manual pin optional)"><input type="number" step="any" className={fieldClass} value={form.longitude ?? ""} onChange={(e) => setForm(p => ({ ...p, longitude: e.target.value === "" ? null : e.target.value, locationMethod: e.target.value === "" ? (p.locationMethod || "Not captured") : "MANUAL_PIN", locationCapturedAt: e.target.value === "" ? p.locationCapturedAt : null, locationAccuracy: e.target.value === "" ? p.locationAccuracy : null, googleMapsUrl: e.target.value !== "" && p.latitude !== undefined && p.latitude !== null ? `https://www.google.com/maps?q=${p.latitude},${e.target.value}` : p.googleMapsUrl }))} placeholder="e.g. 73.8567"/></FormField></FieldGrid>{form.latitude !== "" && form.latitude != null && form.longitude !== "" && form.longitude != null && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div className="flex items-start gap-2 text-emerald-800"><MapPin size={16} className="mt-0.5"/><div><p className="text-xs font-bold">Coordinates captured</p><p className="mt-1 text-[10px]">{Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)} · accuracy ±{form.locationAccuracy || "?"} m</p><p className="mt-1 text-[10px] text-emerald-700">{form.locationCapturedAt ? dateLabel(form.locationCapturedAt) : "Captured just now"}</p></div></div><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${Number(form.latitude)},${Number(form.longitude)}`} className="text-xs font-bold text-emerald-800 underline">Verify map pin</a></div>}<p className="mt-2 text-[10px] leading-4 text-slate-400">GPS uses this device location. Confirm the map pin is at the store; for online leads, enter or correct the location manually.</p></div>
        <div><h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500"><Activity size={14}/> Opportunity qualification</h3><FieldGrid><FormField label="Lead source"><SearchableSelect value={form.leadSource || "Field Visit"} onChange={(value) => set("leadSource", value)} options={["Field Visit", "Phone", "WhatsApp", "Email", "Website", "Referral", "Campaign", "Social media", "Walk-in", "Partner", "Other"].map((x) => ({ value: x, label: stageLabel(x) }))} /></FormField><FormField label="Sales stage"><SearchableSelect value={form.salesStage || "New"} onChange={(value) => set("salesStage", value)} options={[...new Set(["New", "Contacted", "Qualified", "Negotiation", "Won", "Lost", ...(form.salesStage && !["New", "Contacted", "Qualified", "Negotiation", "Won", "Lost"].includes(form.salesStage) ? [form.salesStage] : [])])].map((x) => ({ value: x, label: stageLabel(x) }))} /></FormField><FormField label="Priority"><SearchableSelect value={leadPriority(form.priority)} onChange={(value) => set("priority", value)} options={["High", "Medium", "Low"].map((x) => ({ value: x, label: x }))} /></FormField><FormField label="Assigned staff"><SearchableSelect value={form.assignedTo || currentUser} onChange={(value) => set("assignedTo", value)} options={assignableNames(team, currentUser, role).map((x) => ({ value: x, label: x }))} /></FormField></FieldGrid><div className="mt-3"><span className="mb-2 block text-xs font-semibold text-slate-700">Customer needs / interests</span><div className="flex flex-wrap gap-2">{featureOptions.map((feature) => <label key={feature} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${(form.requiredFeatures || []).includes(feature) ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}><input type="checkbox" checked={(form.requiredFeatures || []).includes(feature)} onChange={(e) => set("requiredFeatures", e.target.checked ? [...(form.requiredFeatures || []), feature] : (form.requiredFeatures || []).filter((x) => x !== feature))} className="accent-violet-600"/>{feature}</label>)}</div></div><div className="mt-3"><FormField label="Lost reason (required when marking Lost)"><SearchableSelect allowCustom value={form.lostReason || ""} onChange={(value) => set("lostReason", value)} placeholder="Search or enter a reason…" options={["Budget constraints", "Chose a competitor", "No response", "Timing not right", "Missing feature", "Decision postponed", "Not a good fit", "Duplicate opportunity", "Other"].map((item) => ({ value: item, label: item }))}/></FormField></div></div>
        {duplicate && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><b>Possible duplicate:</b> {nameOf(medicals, duplicate)}. Review the existing profile before continuing.</div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => { setFormOpen(false); setDuplicate(null); }}>Cancel</Button><Button type="submit" disabled={photoProcessingCount > 0}>{photoProcessingCount > 0 ? "Optimizing photo…" : form.id ? "Save changes" : "Create account profile"}</Button></div>
      </form>
    </Modal>
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.medicalName || "Account profile"}  wide>{detail && <div className="space-y-5"><div className="flex flex-wrap items-center gap-4 rounded-2xl bg-violet-50/60 p-4"><div className="h-20 w-20 overflow-hidden rounded-2xl bg-white">{detail.medicalPhotoUrl ? <img loading="lazy" decoding="async" src={detail.medicalPhotoUrl} alt="Account" className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-violet-600"><Store size={25}/></div>}</div><div className="h-20 w-20 overflow-hidden rounded-2xl bg-white">{detail.ownerPhotoUrl ? <img loading="lazy" decoding="async" src={detail.ownerPhotoUrl} alt="Contact" className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-violet-600"><UserRound size={25}/></div>}</div><div className="min-w-[180px] flex-1"><p className="text-sm font-bold text-slate-900">{detail.ownerName}</p><p className="mt-1 text-xs text-slate-500">Primary contact · {detail.medicalType}</p><div className="mt-2 flex flex-wrap gap-2"><Badge tone={stageTone[detail.salesStage] || "slate"}>{stageLabel(detail.salesStage)}</Badge><Badge tone={priorityTone[leadPriority(detail.priority)] || "slate"}>{leadPriority(detail.priority)}</Badge></div></div></div><FieldGrid>{[["Business phone", detail.phone], ["Business email", detail.email], ["Contact phone", detail.ownerPhone], ["Contact email", detail.ownerEmail], ["Current solution / tools", detail.currentSoftware], ["Lead source", detail.leadSource], ["Assigned staff", detail.assignedTo], ["Address", [detail.addressLine, detail.locality, detail.city, detail.state, detail.pincode].filter(Boolean).join(", ")]].map(([k, v]) => <div key={k} className="rounded-xl border border-slate-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</p><p className="mt-1.5 break-words text-xs font-semibold text-slate-800">{v || "Not provided"}</p></div>)}</FieldGrid><div className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-bold">Customer needs</p><div className="mt-2 flex flex-wrap gap-2">{(detail.requiredFeatures || []).length ? detail.requiredFeatures.map((x) => <Badge key={x} tone="violet">{x}</Badge>) : <span className="text-xs text-slate-400">Not recorded</span>}</div></div>{Number.isFinite(detail.latitude) && Number.isFinite(detail.longitude) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><div><p className="text-xs font-bold text-emerald-800">Saved location</p><p className="mt-1 text-[11px] text-emerald-700">{detail.latitude}, {detail.longitude} · {detail.locationMethod || "Unknown source"}</p><p className="mt-1 text-[10px] text-emerald-700">Captured {dateLabel(detail.locationCapturedAt)}</p></div><a href={detail.googleMapsUrl || `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`} target="_blank" rel="noreferrer"><Button variant="secondary"><MapPin size={14}/> Open in Maps</Button></a></div>}<div className="flex flex-wrap justify-end gap-2">{role === "SUPER_ADMIN" && <Button variant="danger" onClick={async () => { const target = detail; if (!target || !await confirmInPage({ title: "Permanently delete account?", description: `Delete ${target.medicalName} and all CRM records linked to it?`, confirmText: "Permanently delete", danger: true, note: "This permanently removes meetings, evaluations, follow-ups, activities, sales, notifications, audit details and photos. This cannot be undone." })) return; const result = await setMedicals((items) => items.filter((item) => String(item.id) !== String(target.id))); if (result?.success !== false) { setDetail(null); await onAccountDeleted?.(); toast.success("Account and linked data permanently deleted"); } }}>Delete account permanently</Button>}<Button variant="secondary" onClick={() => { setForm({ ...detail }); setDetail(null); setFormOpen(true); }}>Edit account</Button><Button onClick={() => setDetail(null)}>Close</Button></div></div>}</Modal>
  {accountDialog}</>;
}

export function MeetingsPage({ demos, setDemos, medicals, role, currentUser, team = [], onWorkflowChange }) {
  const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("All"); const [open, setOpen] = useState(false); const [form, setForm] = useState({ status: "Requested", demoType: "Online", assignedTo: currentUser, featuresShown: [] });
  const visible = demos.filter((d) => `${nameOf(medicals, d.medicalId)} ${ownerOf(medicals, d.medicalId)} ${d.assignedTo}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === "All" || d.status === statusFilter));
  const add = async (e) => {
    e.preventDefault();
    if (!form.medicalId) { toast.error("Select a account first."); return; }
    if (["Scheduled", "Rescheduled"].includes(form.status) && !form.scheduledAt) { toast.error("Choose a date and time before scheduling the demo."); return; }
    const result = form.id
      ? await setDemos((p) => p.map((d) => d.id === form.id ? { ...d, ...form, scheduledAt: form.scheduledAt || null, nextActionAt: form.nextActionAt || null, featuresShown: form.featuresShown || [], updatedAt: new Date().toISOString() } : d))
      : await setDemos((p) => [{ id: createId(), ...form, scheduledAt: form.scheduledAt || null, nextActionAt: form.nextActionAt || null, requestedAt: new Date().toISOString(), featuresShown: form.featuresShown || [] }, ...p]);
    if (result?.success === false) return;
    await onWorkflowChange?.();
    setOpen(false); setForm({ status: "Requested", demoType: "Online", assignedTo: currentUser, featuresShown: [] });
    toast.success(form.id ? "Demo record updated" : "Demo record created");
  };
  const changeStatus = async (id, status) => {
    const demo = demos.find((d) => d.id === id);
    if (!demo) return;
    if (["Scheduled", "Rescheduled"].includes(status)) {
      setForm({ ...demo, status, scheduledAt: toDateTimeLocal(demo.scheduledAt), nextActionAt: toDateTimeLocal(demo.nextActionAt) });
      setOpen(true);
      toast.info("Confirm the meeting date and time, then save.");
      return;
    }
    const result = await setDemos((p) => p.map((d) => d.id === id ? { ...d, status, ...(status === "Completed" ? { completedAt: new Date().toISOString() } : {}) } : d));
    if (result?.success === false) return;
    await onWorkflowChange?.();
    toast.success(`Demo marked ${status.toLowerCase()}`);
  };
  return <><PageHeading eyebrow="Customer meetings" title="Meeting management"  action={<Button onClick={() => setOpen(true)}><Plus size={16}/> Schedule meeting</Button>}/><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Requests",value:demos.filter(d=>d.status==="Requested").length,icon:MonitorPlay,tint:"violet"},{label:"Scheduled",value:demos.filter(d=>d.status==="Scheduled").length,icon:CalendarClock,tint:"blue"},{label:"Completed",value:demos.filter(d=>d.status==="Completed").length,icon:CheckCircle2,tint:"green"},{label:"Need follow-up",value:demos.filter(d=>d.status==="Completed"&&!d.nextActionAt).length,icon:Activity,tint:"amber"}].map(x=><Panel key={x.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tint==="green"?"bg-emerald-50 text-emerald-600":x.tint==="blue"?"bg-blue-50 text-blue-600":x.tint==="amber"?"bg-amber-50 text-amber-600":"bg-violet-50 text-violet-600"}`}><x.icon size={18}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{x.value}</p></div></Panel>)}</div><Panel className="overflow-hidden"><TableToolbar search={search} setSearch={setSearch} placeholder="Search account or contact..."><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option>{["Requested","Scheduled","Completed","Rescheduled","Cancelled"].map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></TableToolbar><div className="divide-y divide-slate-100 md:hidden">{visible.map(d=><article key={d.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{nameOf(medicals,d.medicalId)}</p><p className="mt-1 text-xs text-slate-500">{ownerOf(medicals,d.medicalId)}</p></div><Badge tone={d.demoType==="Online"?"violet":"blue"}>{d.demoType}</Badge></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scheduled</p><p className="mt-1 text-slate-700">{dateLabel(d.scheduledAt)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Assigned to</p><p className="mt-1 text-slate-700">{d.assignedTo || "Unassigned"}</p></div></div><div className="flex items-center gap-2"><select aria-label={`Status for ${nameOf(medicals,d.medicalId)} meeting`} value={d.status} onChange={e=>changeStatus(d.id,e.target.value)} className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs">{({Requested:["Requested","Scheduled","Cancelled"],Scheduled:["Scheduled","Completed","Rescheduled","Cancelled"],Rescheduled:["Rescheduled","Scheduled","Completed","Cancelled"],Completed:["Completed"],Cancelled:["Cancelled"]}[d.status]||[d.status]).map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select><Button size="sm" variant="secondary" onClick={()=>{setForm({...d,scheduledAt:toDateTimeLocal(d.scheduledAt),nextActionAt:toDateTimeLocal(d.nextActionAt)});setOpen(true)}}>Edit</Button></div>{d.feedback&&<p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{d.feedback}</p>}</article>)}{!visible.length&&<EmptyState title="No meetings found" detail="Schedule a meeting to begin tracking the walkthrough."/>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[950px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Account / contact</th><th className="px-3 py-3">Meeting format</th><th className="px-3 py-3">Scheduled at</th><th className="px-3 py-3">Assigned staff</th><th className="px-3 py-3">Status</th><th className="px-5 py-3">Outcome / next action</th></tr></thead><tbody>{visible.map(d=><tr key={d.id} className="border-b border-slate-50 hover:bg-violet-50/30"><td className="px-5 py-4"><p className="text-xs font-bold text-slate-800">{nameOf(medicals,d.medicalId)}</p><p className="mt-1 text-[10px] text-slate-400">{ownerOf(medicals,d.medicalId)}</p></td><td className="px-3 py-4"><Badge tone={d.demoType==="Online"?"violet":"blue"}>{d.demoType}</Badge></td><td className="px-3 py-4 text-xs text-slate-600">{dateLabel(d.scheduledAt)}</td><td className="px-3 py-4 text-xs text-slate-600">{d.assignedTo}</td><td className="px-3 py-4"><div className="flex items-center gap-2"><select value={d.status} onChange={e=>changeStatus(d.id,e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{({Requested:["Requested","Scheduled","Cancelled"],Scheduled:["Scheduled","Completed","Rescheduled","Cancelled"],Rescheduled:["Rescheduled","Scheduled","Completed","Cancelled"],Completed:["Completed"],Cancelled:["Cancelled"]}[d.status]||[d.status]).map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select><button onClick={()=>{setForm({...d,scheduledAt:toDateTimeLocal(d.scheduledAt),nextActionAt:toDateTimeLocal(d.nextActionAt)});setOpen(true)}} className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-violet-700" title="Edit meeting notes"><MoreHorizontal size={15}/></button></div></td><td className="px-5 py-4"><p className="max-w-[240px] truncate text-xs text-slate-700">{d.feedback || "No meeting notes recorded"}</p><p className="mt-1 text-[10px] text-slate-400">Next: {dateLabel(d.nextActionAt)}</p></td></tr>)}</tbody></table>{!visible.length&&<EmptyState title="No meetings found" detail="Schedule a meeting to begin tracking the walkthrough."/>}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">{visible.length} meeting records</div></Panel>
    <Modal open={open} onClose={()=>setOpen(false)} title="Schedule a meeting"  wide><form onSubmit={add} className="space-y-4"><FieldGrid><FormField label="Account" required><SearchableSelect required value={form.medicalId || ""} onChange={(value) => setForm((previous) => ({ ...previous, medicalId: value }))} options={accountSelectOptions(medicals)} placeholder="Search account, contact, area, phone…"/></FormField><FormField label="Meeting format"><select className={selectClass} value={form.demoType} onChange={e=>setForm(p=>({...p,demoType:e.target.value}))}><option>Online</option><option>In-person</option></select></FormField><FormField label="Requested date/time"><input type="datetime-local" className={fieldClass} value={form.scheduledAt||""} onChange={e=>setForm(p=>({...p,scheduledAt:e.target.value}))}/></FormField><FormField label="Assigned staff"><SearchableSelect value={form.assignedTo || currentUser} onChange={(value) => setForm((previous) => ({ ...previous, assignedTo: value }))} options={assignableNames(team, currentUser, role).map((name) => ({ value: name, label: name }))} placeholder="Search team members…"/></FormField><FormField label="Initial status"><select className={selectClass} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>{(form.id ? [...new Set(["Requested","Scheduled","Rescheduled","Completed","Cancelled",form.status])] : ["Requested","Scheduled"]).map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></FormField><FormField label="Next action date/time"><input type="datetime-local" className={fieldClass} value={form.nextActionAt||""} onChange={e=>setForm(p=>({...p,nextActionAt:e.target.value}))}/></FormField></FieldGrid><div><span className="mb-2 block text-xs font-semibold text-slate-700">Meeting agenda / topics</span><div className="flex flex-wrap gap-2">{featureOptions.map(x=><label key={x} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${(form.featuresShown||[]).includes(x)?"border-violet-200 bg-violet-50 text-violet-700":"border-slate-200 text-slate-600"}`}><input type="checkbox" className="accent-violet-600" checked={(form.featuresShown||[]).includes(x)} onChange={e=>setForm(p=>({...p,featuresShown:e.target.checked?[...(p.featuresShown||[]),x]:(p.featuresShown||[]).filter(v=>v!==x)}))}/>{x}</label>)}</div></div><FormField label="Meeting notes / feedback"><textarea className={`${fieldClass} h-16 py-2`} value={form.feedback||""} onChange={e=>setForm(p=>({...p,feedback:e.target.value}))} placeholder="Key takeaways, feedback and next steps"/></FormField><FieldGrid><FormField label="Objections / questions"><input className={fieldClass} value={form.objections||""} onChange={e=>setForm(p=>({...p,objections:e.target.value}))} placeholder="Pricing, migration, training..."/></FormField><FormField label="Next action date/time"><input type="datetime-local" className={fieldClass} value={form.nextActionAt||""} onChange={e=>setForm(p=>({...p,nextActionAt:e.target.value}))}/></FormField></FieldGrid><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit">Save meeting</Button></div></form></Modal>
  </>;
}

export function EvaluationsPage({ trials, setTrials, medicals, demos, role, currentUser, onConvertTrial, onWorkflowChange, team = [] }) {
  const [search,setSearch]=useState(""); const [statusFilter,setStatusFilter]=useState("All"); const [open,setOpen]=useState(false); const [extend,setExtend]=useState(null); const [convert,setConvert]=useState(null); const [form,setForm]=useState({status:"Requested",durationDays:14,plan:"Professional",assignedTo:currentUser}); const [extendDays,setExtendDays]=useState(7); const [conversion,setConversion]=useState({price:"",plan:"Professional",reference:""});
  const visible=trials.filter(t=>`${nameOf(medicals,t.medicalId)} ${t.plan} ${t.accountRef||""}`.toLowerCase().includes(search.toLowerCase())&&(statusFilter==="All"||t.status===statusFilter));
  const add=async(e)=>{e.preventDefault();const requestedStatus=role==="STAFF"?"Requested":form.status;const start=form.startedAt||"";if(requestedStatus==="Active"&&!start){toast.error("Add a start date before activating the trial.");return;}const duration=Number(form.durationDays)||14;const end=start?calculateDate(start,duration):"";const result=await setTrials(p=>[{id:createId(),...form,status:requestedStatus,durationDays:duration,startedAt:requestedStatus==="Active"?start:"",expiresAt:requestedStatus==="Active"?end:"",createdBy:currentUser,approvedBy:requestedStatus==="Active"?currentUser:"",accountRef:form.accountRef||"",extensionHistory:[],createdAt:new Date().toISOString()},...p]);if(result?.success===false)return;await onWorkflowChange?.();setOpen(false);setForm({status:"Requested",durationDays:14,plan:"Professional",assignedTo:currentUser});toast.success("Trial record created",{description:requestedStatus==="Active"?`Expires on ${end}`:"Trial request saved. An admin can approve and start it."});};
  const activate=async(trial)=>{const startedAt=new Date().toISOString().slice(0,10);const result=await setTrials(p=>p.map(t=>t.id===trial.id?{...t,status:"Active",startedAt,expiresAt:calculateDate(startedAt,t.durationDays||14),approvedBy:currentUser}:t));if(result?.success===false)return;await onWorkflowChange?.();toast.success("Trial activated",{description:"The server calculated the expiry and scheduled reminder windows."});};
  const doExtend=async(e)=>{e.preventDefault();const old=visible.find(t=>t.id===extend)||trials.find(t=>t.id===extend);if(!old)return;const today=new Date().toISOString().slice(0,10);const base=old.expiresAt&&old.expiresAt>today?old.expiresAt:today;const next=calculateDate(base,Number(extendDays)||7);const result=await setTrials(p=>p.map(t=>t.id===extend?{...t,status:"Extended",expiresAt:next,durationDays:(Number(t.durationDays)||0)+(Number(extendDays)||7),extensionHistory:[...(t.extensionHistory||[]),{oldExpiry:old.expiresAt,newExpiry:next,days:Number(extendDays)||7,reason:"Extension recorded from CRM",approvedBy:currentUser,at:new Date().toISOString()}]}:t));if(result?.success===false)return;await onWorkflowChange?.();setExtend(null);toast.success("Trial extension recorded",{description:"The backend calculated the new expiry and saved the extension audit entry."});};
  const doConvert=async(e)=>{e.preventDefault();try{await onConvertTrial(convert,{...conversion,price:Number(conversion.price)||0});setConvert(null);setConversion({price:"",plan:"Professional",reference:""});}catch{/* The API layer already shows the actionable error; keep the modal open for correction or retry. */}};
  const active=trials.filter(t=>["Active","Extended"].includes(t.status)); const expiring=active.filter(t=>daysUntil(t.expiresAt)!==null&&daysUntil(t.expiresAt)>=0&&daysUntil(t.expiresAt)<=3);
  return <><PageHeading eyebrow="Deal lifecycle" title="Evaluation management"  action={<Button onClick={()=>setOpen(true)}><Plus size={16}/> Create evaluation</Button>}/><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{label:"Active evaluations",value:active.length,icon:FlaskConical,tint:"green"},{label:"Requested",value:trials.filter(t=>t.status==="Requested").length,icon:Clock3,tint:"amber"},{label:"Expiring in 3 days",value:expiring.length,icon:AlertTriangle,tint:"rose"},{label:"Deals closed",value:trials.filter(t=>t.status==="Converted").length,icon:CircleDollarSign,tint:"violet"}].map(x=><Panel key={x.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tint==="green"?"bg-emerald-50 text-emerald-600":x.tint==="amber"?"bg-amber-50 text-amber-600":x.tint==="rose"?"bg-rose-50 text-rose-600":"bg-violet-50 text-violet-600"}`}><x.icon size={18}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{x.value}</p></div></Panel>)}</div>
    <Panel className="mb-5 overflow-hidden"><PanelHeading title="End-date watch" /><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{active.filter(t=>daysUntil(t.expiresAt)!==null&&daysUntil(t.expiresAt)<=7).map(t=><div key={t.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-slate-800">{nameOf(medicals,t.medicalId)}</p><p className="mt-1 text-[10px] text-slate-500">{t.plan} · {dateLabel(t.expiresAt)}</p></div><Badge tone={daysUntil(t.expiresAt)<0?"rose":"amber"}>{daysUntil(t.expiresAt)<0?"Expired":daysUntil(t.expiresAt)===0?"Today":`${daysUntil(t.expiresAt)} days`}</Badge></div><button onClick={()=>{setExtend(t.id);setExtendDays(7)}} className="mt-3 text-[11px] font-bold text-violet-700 hover:underline">Review / extend evaluation →</button></div>)}{!active.some(t=>daysUntil(t.expiresAt)!==null&&daysUntil(t.expiresAt)<=7)&&<div className="sm:col-span-2 xl:col-span-3"><EmptyState title="No active evaluations ending within 7 days" detail="Expiry warnings will appear here based on each trial's end date."/></div>}</div></Panel>
    <Panel className="overflow-hidden"><TableToolbar search={search} setSearch={setSearch} placeholder="Search account, plan or account..."><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option>{["Requested","Approved","Active","Expired","Extended","Converted","Cancelled"].map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></TableToolbar><div className="divide-y divide-slate-100 md:hidden">{visible.map(t=>{const days=daysUntil(t.expiresAt);return <article key={t.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900">{nameOf(medicals,t.medicalId)}</p><p className="mt-1 text-xs text-slate-500">{t.plan}{t.accountRef?` · ${t.accountRef}`:""}</p></div><Badge tone={trialTone[t.status]||"slate"}>{t.status}</Badge></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Evaluation duration</p><p className="mt-1 text-slate-700">{t.durationDays || 14} days</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Expires</p><p className={`mt-1 ${["Active","Extended"].includes(t.status)&&days!==null&&days<=1?"font-semibold text-rose-600":"text-slate-700"}`}>{dateLabel(t.expiresAt)}</p>{["Active","Extended"].includes(t.status)&&days!==null&&<p className="mt-1 text-[10px] text-slate-500">{days<0?`${Math.abs(days)} days overdue`:days===0?"Expires today":`${days} days left`}</p>}</div></div><p className="text-[11px] text-slate-500">Assigned to {t.assignedTo || "Unassigned"}</p><div className="flex flex-wrap gap-2">{t.status==="Requested"&&role!=="STAFF"&&<Button size="sm" onClick={()=>activate(t)}>Approve & start</Button>}{["Active","Expired","Extended"].includes(t.status)&&role!=="STAFF"&&<><Button size="sm" variant="secondary" onClick={()=>{setExtend(t.id);setExtendDays(7)}}>Extend</Button><Button size="sm" variant="secondary" onClick={()=>{setConvert(t.id);setConversion({price:"",plan:t.plan||"Professional",reference:""})}}>Close deal</Button></>}</div></article>})}{!visible.length&&<EmptyState title="No evaluations found" detail="Create an evaluation request to begin tracking the test period."/>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">account / plan</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Start date</th><th className="px-3 py-3">Expiry / reminder</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Assigned to</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{visible.map(t=>{const days=daysUntil(t.expiresAt);return <tr key={t.id} className="border-b border-slate-50 hover:bg-violet-50/30"><td className="px-5 py-4"><p className="text-xs font-bold text-slate-800">{nameOf(medicals,t.medicalId)}</p><p className="mt-1 text-[10px] text-slate-400">{t.plan}{t.accountRef?` · ${t.accountRef}`:""}</p>{t.notes&&<p className="mt-1 max-w-[260px] truncate text-[10px] text-slate-400" title={t.notes}>{t.notes}</p>}{(t.extensionHistory||[]).length>0&&<p className="mt-1 text-[10px] font-semibold text-violet-600">{t.extensionHistory.length} extension record(s)</p>}</td><td className="px-3 py-4 text-xs text-slate-600">{t.durationDays} days</td><td className="px-3 py-4 text-xs text-slate-600">{dateLabel(t.startedAt)}</td><td className="px-3 py-4"><p className="text-xs text-slate-700">{dateLabel(t.expiresAt)}</p>{["Active","Extended"].includes(t.status)&&days!==null&&<p className={`mt-1 text-[10px] font-semibold ${days<=1?"text-rose-600":days<=3?"text-amber-600":"text-slate-400"}`}>{days<0?`${Math.abs(days)} days overdue`:days===0?"Expires today":`${days} days left`}</p>}</td><td className="px-3 py-4"><Badge tone={trialTone[t.status]||"slate"}>{t.status}</Badge></td><td className="px-3 py-4 text-xs text-slate-600">{t.assignedTo}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1">{t.status==="Requested"&&role!=="STAFF"&&<button onClick={()=>activate(t)} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50">Approve & start</button>}{["Active","Expired","Extended"].includes(t.status)&&role!=="STAFF"&&<button onClick={()=>{setExtend(t.id);setExtendDays(7)}} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50">Extend</button>}{["Active","Expired","Extended"].includes(t.status)&&role!=="STAFF"&&<button onClick={()=>{setConvert(t.id);setConversion({price:"",plan:t.plan||"Professional",reference:""})}} className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50">Close deal</button>}</div></td></tr>})}</tbody></table>{!visible.length&&<EmptyState title="No evaluations found" detail="Create an evaluation request to begin tracking the test period."/>}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">{visible.length} evaluation records · Expiry and follow-up reminders are delivered in the in-app notification centre</div></Panel>
    <Modal open={open} onClose={()=>setOpen(false)} title="Create evaluation record" description="An evaluation can be approved separately by an administrator." wide><form onSubmit={add} className="space-y-4"><FieldGrid><FormField label="Account" required><SearchableSelect required value={form.medicalId || ""} onChange={(value) => setForm((previous) => ({ ...previous, medicalId: value }))} options={accountSelectOptions(medicals)} placeholder="Search account, contact, area, phone…"/></FormField><FormField label="Linked demo (optional)"><SearchableSelect value={form.demoId || ""} onChange={(value) => setForm((previous) => ({ ...previous, demoId: value || "" }))} options={demos.filter((demo) => !form.medicalId || String(demo.medicalId) === String(form.medicalId)).map((demo) => ({ value: demo.id, label: "#" + demo.id + " · " + demo.status }))} placeholder="Search meeting records…"/></FormField><FormField label="Plan"><select className={selectClass} value={form.plan} onChange={e=>setForm(p=>({...p,plan:e.target.value}))}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></FormField><FormField label="Evaluation duration"><select className={selectClass} value={form.durationDays} onChange={e=>setForm(p=>({...p,durationDays:e.target.value}))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={45}>45 days</option></select></FormField><div className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">Trial start and expiry are set by the server when an Admin activates the trial. This prevents backdated trial windows.</div><FormField label="Initial status"><select className={selectClass} value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option>Requested</option></select></FormField><FormField label="Assigned staff"><SearchableSelect value={form.assignedTo || currentUser} onChange={(value) => setForm((previous) => ({ ...previous, assignedTo: value }))} options={assignableNames(team, currentUser, role).map((name) => ({ value: name, label: name }))} placeholder="Search team members…"/></FormField><FormField label="Trial account reference"><input className={fieldClass} value={form.accountRef||""} onChange={e=>setForm(p=>({...p,accountRef:e.target.value}))} placeholder="Optional reference only"/></FormField></FieldGrid><FormField label="Notes"><textarea className={`${fieldClass} h-20 py-2`} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></FormField><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit">Save evaluation</Button></div></form></Modal>
    <Modal open={extend!==null} onClose={()=>setExtend(null)} title="Extend evaluation" description="An extension appends a history entry instead of overwriting the old expiry."><form onSubmit={doExtend} className="space-y-4"><FormField label="Additional days"><select className={selectClass} value={extendDays} onChange={e=>setExtendDays(e.target.value)}><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></FormField><p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">For the selected evaluation, the end date will be extended and the action will be recorded in history.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setExtend(null)}>Cancel</Button><Button type="submit">Confirm extension</Button></div></form></Modal>
    <Modal open={convert!==null} onClose={()=>setConvert(null)} title="Close deal" description="Record the deal value and close the evaluation lifecycle."><form onSubmit={doConvert} className="space-y-4"><FormField label="Product / service"><select className={selectClass} value={conversion.plan} onChange={e=>setConversion(p=>({...p,plan:e.target.value}))}><option>Starter</option><option>Professional</option><option>Enterprise</option></select></FormField><FormField label="Deal value (₹)" required><input required min="0" type="number" className={fieldClass} value={conversion.price} onChange={e=>setConversion(p=>({...p,price:e.target.value}))} placeholder="e.g. 12000"/></FormField><FormField label="Invoice / payment reference"><input className={fieldClass} value={conversion.reference} onChange={e=>setConversion(p=>({...p,reference:e.target.value}))} placeholder="Optional reference"/></FormField><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setConvert(null)}>Cancel</Button><Button type="submit"><CircleDollarSign size={14}/> Record closed deal</Button></div></form></Modal>
  </>;
}
function calculateDate(start,days){const d=new Date(`${String(start).slice(0,10)}T12:00:00`);d.setDate(d.getDate()+Number(days||0));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}

export function FollowUpsPage({ followUps, setFollowUps, medicals, role, currentUser, team = [] }) {
  const [search,setSearch]=useState("");const [tab,setTab]=useState("Open");const [open,setOpen]=useState(false);const [form,setForm]=useState({channel:"Call",priority:"Medium",assignedTo:currentUser,done:false});
  const visible=followUps.filter(f=>`${f.title} ${nameOf(medicals,f.medicalId)} ${f.channel} ${f.assignedTo}`.toLowerCase().includes(search.toLowerCase())&&(tab==="All"||(tab==="Completed"?f.done:!f.done)));
  const add=async(e)=>{e.preventDefault();const result=await setFollowUps(p=>[{id:createId(),...form,done:false},...p]);if(result?.success===false)return;setOpen(false);setForm({channel:"Call",priority:"Medium",assignedTo:currentUser,done:false});toast.success("Follow-up scheduled");};
  const toggle=async(id)=>{const result=await setFollowUps(p=>p.map(f=>f.id===id?{...f,done:!f.done,completedAt:!f.done?new Date().toISOString():null}:f));if(result?.success===false)return;toast.success("Follow-up status updated");};
  const channelIcon=(c)=>c==="WhatsApp"?<MessageCircle size={16}/>:c==="Email"?<Mail size={16}/>:c==="Visit"?<MapPinned size={16}/>:c==="Meeting"?<CalendarDays size={16}/>:<PhoneCall size={16}/>;
  return <><PageHeading eyebrow="Sales cadence" title="Follow-ups"  action={<Button onClick={()=>setOpen(true)}><Plus size={16}/> Schedule follow-up</Button>}/><div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:"Open follow-ups",value:followUps.filter(f=>!f.done).length,icon:CalendarClock,tint:"violet"},{label:"Due today / overdue",value:followUps.filter(f=>!f.done&&new Date(f.dueAt)<=new Date(new Date().setHours(23,59,59,999))).length,icon:Clock3,tint:"amber"},{label:"Completed",value:followUps.filter(f=>f.done).length,icon:CheckCircle2,tint:"green"}].map(x=><Panel key={x.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tint==="green"?"bg-emerald-50 text-emerald-600":x.tint==="amber"?"bg-amber-50 text-amber-600":"bg-violet-50 text-violet-600"}`}><x.icon size={18}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{x.value}</p></div></Panel>)}</div><Panel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-1 rounded-xl bg-slate-100 p-1">{["Open","Completed","All"].map(x=><button key={x} onClick={()=>setTab(x)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab===x?"bg-white text-violet-700 shadow-sm":"text-slate-500 hover:text-slate-800"}`}>{x}</button>)}</div><div className="w-full sm:max-w-xs"><SearchInput value={search} onChange={setSearch} placeholder="Search follow-ups..."/></div></div><div className="divide-y divide-slate-100">{visible.sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt)).map(f=>{const due=new Date(f.dueAt);const overdue=!f.done&&due<new Date();return <div key={f.id} className={`flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:items-center ${f.done?"opacity-60":""}`}><button onClick={()=>toggle(f.id)} className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border sm:mt-0 ${f.done?"border-violet-600 bg-violet-600 text-white":"border-slate-300 bg-white text-transparent hover:border-violet-500 hover:text-violet-500"}`}><Check size={12}/></button><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${f.channel==="Visit"?"bg-emerald-50 text-emerald-600":f.channel==="WhatsApp"?"bg-green-50 text-green-600":f.channel==="Email"?"bg-violet-50 text-violet-600":"bg-blue-50 text-blue-600"}`}>{channelIcon(f.channel)}</div><div className="min-w-0 flex-1"><p className={`text-xs font-bold ${f.done?"line-through text-slate-400":"text-slate-800"}`}>{f.title}</p><p className="mt-1 text-[11px] text-slate-500">{nameOf(medicals,f.medicalId)} · {f.channel} · {f.assignedTo}</p>{f.notes&&<p className="mt-1 max-w-xl truncate text-[10px] text-slate-400">{f.notes}</p>}</div><div className="hidden min-w-[155px] sm:block"><p className={`text-[11px] font-semibold ${overdue?"text-rose-600":"text-slate-600"}`}>{dateLabel(f.dueAt)}</p>{overdue&&<p className="mt-1 text-[10px] text-rose-500">Overdue</p>}</div><Badge tone={priorityTone[leadPriority(f.priority)]||"slate"}>{leadPriority(f.priority)}</Badge></div>})}{!visible.length&&<EmptyState title="No follow-ups found" detail="Schedule a call, visit, email or message to keep the sales process moving."/>}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">{visible.length} follow-up records</div></Panel>
    <Modal open={open} onClose={()=>setOpen(false)} title="Schedule a follow-up" ><form onSubmit={add} className="space-y-4"><FormField label="Account" required><SearchableSelect required value={form.medicalId || ""} onChange={(value) => setForm((previous) => ({ ...previous, medicalId: value }))} options={accountSelectOptions(medicals)} placeholder="Search account, contact, area, phone…"/></FormField><FormField label="Action title" required><input required className={fieldClass} value={form.title||""} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Follow up on proposal feedback"/></FormField><div className="grid gap-4 sm:grid-cols-2"><FormField label="Channel"><select className={selectClass} value={form.channel} onChange={e=>setForm(p=>({...p,channel:e.target.value}))}>{["Call","Visit","WhatsApp","Email","Meeting"].map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></FormField><FormField label="Priority"><select className={selectClass} value={leadPriority(form.priority)} onChange={e=>setForm(p=>({...p,priority:e.target.value}))}><option>Low</option><option>Medium</option><option>High</option></select></FormField><FormField label="Due date/time" required><input required type="datetime-local" className={fieldClass} value={form.dueAt||""} onChange={e=>setForm(p=>({...p,dueAt:e.target.value}))}/></FormField><FormField label="Assigned staff"><SearchableSelect value={form.assignedTo || currentUser} onChange={(value) => setForm((previous) => ({ ...previous, assignedTo: value }))} options={assignableNames(team, currentUser, role).map((name) => ({ value: name, label: name }))} placeholder="Search team members…"/></FormField></div><FormField label="Notes"><textarea className={`${fieldClass} h-20 py-2`} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></FormField><div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit">Save follow-up</Button></div></form></Modal>
  </>;
}

export function TeamPage({ team = [], setTeam, role, currentUserId }) {
  const { confirm: confirmInPage, dialog: teamDialog } = useInPageDialog();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "STAFF", status: "Active", assignedArea: "" });
  const superAdminCount = team.filter((user) => user.role === "SUPER_ADMIN").length;
  const activeSuperAdminCount = team.filter((user) => user.role === "SUPER_ADMIN" && user.status === "Active").length;
  const adminCount = team.filter((user) => user.role === "ADMIN").length;
  const activeCount = team.filter((user) => user.status === "Active").length;
  const visible = team.filter((user) => (user.name + " " + user.email + " " + user.assignedArea + " " + user.role).toLowerCase().includes(search.toLowerCase()));
  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", role: "STAFF", status: "Active", assignedArea: "" });
    setFormOpen(true);
  };
  const openEdit = (user) => {
    setEditing(user);
    setForm({ name: user.name || "", email: user.email || "", phone: user.phone || "", role: user.role, status: user.status || "Active", assignedArea: user.assignedArea || "" });
    setFormOpen(true);
  };
  const saveUser = async (event) => {
    event.preventDefault();
    if (role === "ADMIN" && form.role !== "STAFF") { toast.error("Admins can manage Staff accounts only."); return; }
    if (role === "SUPER_ADMIN" && form.role === "ADMIN" && (!editing || editing.role !== "ADMIN") && adminCount >= 2) { toast.error("The workspace can have up to two Admins. Change an existing role first."); return; }
    const fields = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: role === "ADMIN" ? "STAFF" : form.role, status: form.status, assignedArea: form.assignedArea.trim() };
    const result = editing
      ? await setTeam((items) => items.map((user) => String(user.id) === String(editing.id) ? { ...user, ...fields } : user))
      : await setTeam((items) => [{ id: createId(), ...fields }, ...items]);
    if (result?.success === false) return;
    setFormOpen(false);
    setEditing(null);
    toast.success(editing ? "Team member updated" : "Invitation sent", editing ? undefined : { description: "A one-time password setup link was emailed to the new teammate." });
  };
  const removeUser = async (user) => {
    const isSelf = String(user.id) === String(currentUserId);
    if ((isSelf && !(role === "SUPER_ADMIN" && user.role === "SUPER_ADMIN")) || (role === "ADMIN" && user.role !== "STAFF")) return;
    if (user.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") { toast.error("Only the Super Admin can remove a Super Admin account."); return; }
    if (user.role === "SUPER_ADMIN" && superAdminCount <= 1 && !isSelf) { toast.error("The workspace must keep its Super Admin account."); return; }
    const description = isSelf
      ? "This removes your only Super Admin account and signs you out. A new Super Admin must be provisioned from the server before anyone can administer this workspace again. Existing CRM records are retained."
      : "Remove " + user.name + " from the team? Their account access will stop, while existing CRM records and audit history are retained.";
    const accepted = await confirmInPage({ title: isSelf ? "Delete your Super Admin account?" : "Remove team member?", description, confirmText: isSelf ? "Delete account and sign out" : "Remove member", danger: true });
    if (!accepted) return;
    const result = await setTeam((items) => items.filter((item) => String(item.id) !== String(user.id)));
    if (result?.success !== false) {
      toast.success(isSelf ? "Super Admin account removed" : "Team member removed");
      if (isSelf) window.location.reload();
    }
  };
  const canEditUser = (user) => role === "SUPER_ADMIN" || (role === "ADMIN" && user.role === "STAFF");
  const canRemoveUser = (user) => {
    const isSelf = String(user.id) === String(currentUserId);
    if (user.role === "SUPER_ADMIN") return role === "SUPER_ADMIN" && (isSelf || superAdminCount > 1);
    return !isSelf && (role === "SUPER_ADMIN" || (role === "ADMIN" && user.role === "STAFF"));
  };
  const canEditRole = role === "SUPER_ADMIN" && (!editing || String(editing.id) !== String(currentUserId)) && (editing?.role !== "SUPER_ADMIN" || superAdminCount > 1);

  return <>
    <PageHeading eyebrow="Access & ownership" title="Team & roles"  action={<Button onClick={openAdd} disabled={role === "STAFF"}><Plus size={16}/> Add team member</Button>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Team members", value: team.length, icon: Users, tone: "violet" }, { label: "Active accounts", value: activeCount, icon: CheckCircle2, tone: "green" }, { label: "Super Admin seats", value: (role === "ADMIN" ? 1 : superAdminCount) + " / 1", icon: ShieldCheck, tone: "amber" }, { label: "Admin seats", value: adminCount + " / 2", icon: UserCog, tone: "blue" }].map((item) => <Panel key={item.label} className="flex items-center gap-3 p-4"><span className={"flex h-10 w-10 items-center justify-center rounded-xl " + (item.tone === "green" ? "bg-emerald-50 text-emerald-700" : item.tone === "amber" ? "bg-amber-50 text-amber-700" : item.tone === "blue" ? "bg-sky-50 text-sky-700" : "bg-violet-50 text-violet-700")}><item.icon size={18}/></span><div><p className="text-xs text-slate-500">{item.label}</p><p className="mt-0.5 text-lg font-extrabold text-slate-900">{item.value}</p></div></Panel>)}
    </div>
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d8e4d4] bg-[#f3f7ef] p-4"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-[#456b4c]"/><div><p className="text-sm font-bold text-[#294633]">Signed in as {role.replace("_", " ")}</p><p className="mt-1 text-xs leading-5 text-[#5e705f]">One Super Admin is protected. Up to two Admin seats are available; all other team members are Staff. Admins manage Staff accounts, while the Super Admin manages roles and all team accounts.</p></div></div>
    <Panel className="overflow-hidden"><TableToolbar search={search} setSearch={setSearch} placeholder="Search name, email, area, or role..."><Badge tone="violet">{visible.length} of {team.length} members</Badge></TableToolbar>
      <div className="divide-y divide-slate-100 md:hidden">{visible.map((user) => <article key={user.id} className="space-y-3 p-4"><div className="flex items-center gap-3"><Avatar name={user.name}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{user.name}</p><p className="mt-1 truncate text-xs text-slate-500">{user.email}</p></div><Badge tone={user.status === "Active" ? "green" : "rose"}>{user.status}</Badge></div><div className="grid grid-cols-2 gap-3"><div><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Role</span><p className="mt-1 text-xs font-semibold text-slate-700">{user.role.replace("_", " ")}</p></div><div><span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Assigned area</span><p className="mt-1 truncate text-xs text-slate-700">{user.assignedArea || "Not set"}</p></div></div><div className="flex justify-end gap-2">{canEditUser(user) && <Button variant="secondary" size="sm" onClick={() => openEdit(user)}><Pencil size={13}/> Edit</Button>}{canRemoveUser(user) && <Button variant="danger" size="sm" onClick={() => removeUser(user)}><Trash2 size={13}/> Remove</Button>}</div></article>)}{!visible.length && <EmptyState title="No team members found"/>}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Team member</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Assigned area</th><th className="px-3 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-[#f7f8f2]"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar name={user.name}/><div><p className="text-xs font-bold text-slate-800">{user.name}{String(user.id) === String(currentUserId) ? <span className="ml-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">You</span> : null}</p><p className="mt-1 text-[10px] text-slate-400">{user.email}{user.phone ? " · " + user.phone : ""}</p></div></div></td><td className="px-3 py-4"><Badge tone={user.role === "SUPER_ADMIN" ? "violet" : user.role === "ADMIN" ? "blue" : "slate"}>{user.role.replace("_", " ")}</Badge></td><td className="px-3 py-4 text-xs text-slate-600">{user.assignedArea || "Not set"}</td><td className="px-3 py-4"><Badge tone={user.status === "Active" ? "green" : "rose"}>{user.status}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-2">{canEditUser(user) && <Button variant="secondary" size="sm" onClick={() => openEdit(user)}><Pencil size={13}/> Edit</Button>}{canRemoveUser(user) && <Button variant="danger" size="sm" onClick={() => removeUser(user)}><Trash2 size={13}/> Remove</Button>}</div></td></tr>)}</tbody></table>{!visible.length && <EmptyState title="No team members found" detail="Try a different name, email, area, or role."/>}</div>
    </Panel>
    <div className="mt-5 grid gap-4 md:grid-cols-3">{[{ role: "SUPER_ADMIN", title: "Super Admin · 1 seat", text: "Single workspace owner. Role and account protection prevents lockout." }, { role: "ADMIN", title: "Admin · up to 2 seats", text: "Manage Staff accounts and workspace records. Admins cannot create or promote other Admins." }, { role: "STAFF", title: "Staff · remaining seats", text: "Work assigned accounts, log activity, and manage customer follow-ups." }].map((item) => <Panel key={item.role} className="p-5"><div className="mb-3 flex items-center gap-2"><ShieldCheck size={17} className="text-[#456b4c]"/><Badge tone={item.role === "SUPER_ADMIN" ? "violet" : item.role === "ADMIN" ? "blue" : "slate"}>{item.title}</Badge></div><p className="text-xs leading-5 text-slate-500">{item.text}</p></Panel>)}</div>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit team member" : "Invite a team member"} description={editing ? "Update the member profile, role, status, and assigned area." : "Add their details and we’ll email them a secure link to set their own password."}>
      <form onSubmit={saveUser} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Full name" required><input required minLength={2} maxLength={100} className={fieldClass} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Team member name"/></FormField><FormField label="Work email" required><input required type="email" maxLength={254} className={fieldClass} value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} placeholder="name@company.com"/></FormField></div>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Phone"><input type="tel" className={fieldClass} value={form.phone} onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))} placeholder="Optional phone number"/></FormField><FormField label="Assigned area"><input maxLength={100} className={fieldClass} value={form.assignedArea} onChange={(event) => setForm((previous) => ({ ...previous, assignedArea: event.target.value }))} placeholder="City or territory"/></FormField></div>
        <div className="grid gap-4 sm:grid-cols-2"><FormField label="Workspace role"><select className={selectClass} value={form.role} disabled={role === "ADMIN" || !canEditRole && Boolean(editing)} onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}><option value="STAFF">Staff</option>{role === "SUPER_ADMIN" && <option value="ADMIN" disabled={adminCount >= 2 && (!editing || editing.role !== "ADMIN")}>Admin{adminCount >= 2 && (!editing || editing.role !== "ADMIN") ? " · 2-seat limit reached" : ""}</option>}{editing?.role === "SUPER_ADMIN" ? <option value="SUPER_ADMIN">Super Admin · protected</option> : null}</select>{role === "ADMIN" && <span className="mt-1 block text-[10px] text-slate-400">Admins can assign Staff roles only.</span>}</FormField><FormField label="Account status"><select className={selectClass} value={form.status} disabled={!editing || Boolean(editing && String(editing.id) === String(currentUserId)) || Boolean(editing?.role === "SUPER_ADMIN" && editing.status === "Active" && activeSuperAdminCount <= 1)} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></FormField></div>
        {!editing && <p className="rounded-xl border border-[#dce5d5] bg-[#f4f6ed] px-3.5 py-3 text-xs leading-5 text-[#52664f]">We’ll send a personal welcome email to this address with a one-time setup link. Their password stays private and is created by them.</p>}
        {editing?.role === "SUPER_ADMIN" && superAdminCount <= 1 ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">This is the workspace’s single Super Admin account. Its role and active access are protected.</p> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit">{editing ? "Save changes" : "Send invitation"}</Button></div>
      </form>
    </Modal>
    {teamDialog}
  </>;
}

export function BusinessDashboard({ medicals, demos, trials, followUps, sales, setPage }) {
  // Data is already scoped by the API; keep dashboard visibility consistent with each route.
  const myMedicals = medicals;
  const myDemos = demos;
  const myTrials = trials;
  const myFollowUps = followUps;
  const mySales = sales;
  const activeTrials = myTrials.filter((trial) => ["Active", "Extended"].includes(trial.status));
  const expiringTrials = activeTrials
    .filter((trial) => daysUntil(trial.expiresAt) !== null && daysUntil(trial.expiresAt) >= 0 && daysUntil(trial.expiresAt) <= 7)
    .sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));
  const openFollowUps = myFollowUps
    .filter((followUp) => !followUp.done)
    .sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0));
  const dueFollowUps = openFollowUps.filter((followUp) => followUp.dueAt && new Date(followUp.dueAt) <= new Date(new Date().setHours(23, 59, 59, 999)));
  const upcomingDemos = myDemos
    .filter((demo) => ["Scheduled", "Rescheduled"].includes(demo.status))
    .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0))
    .slice(0, 4);
  const recentMedicals = [...myMedicals].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4);
  const pipelineStages = [
    { label: "New / contacted", value: myMedicals.filter((item) => ["New", "Contacted"].includes(item.salesStage)).length, tone: "violet" },
    { label: "Qualified", value: myMedicals.filter((item) => item.salesStage === "Qualified").length, tone: "blue" },
    { label: "Meetings / evaluations", value: myMedicals.filter((item) => ["Demo Requested", "Demo Scheduled", "Demo Completed", "Trial Requested", "Trial Active"].includes(item.salesStage)).length, tone: "cyan" },
    { label: "Negotiation", value: myMedicals.filter((item) => item.salesStage === "Negotiation").length, tone: "amber" },
    { label: "Won", value: myMedicals.filter((item) => item.salesStage === "Won").length, tone: "green" },
    { label: "Lost", value: myMedicals.filter((item) => item.salesStage === "Lost").length, tone: "slate" },
  ];
  const stageMax = Math.max(1, ...pipelineStages.map((stage) => stage.value));
  const activeRate = myTrials.length ? Math.round((activeTrials.length / myTrials.length) * 100) : 0;
  const dateText = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "long" });
  const priorityClass = (priority) => ({ High: "is-high", Hot: "is-high", Medium: "is-medium", Warm: "is-medium", Low: "is-low", Cold: "is-low" }[leadPriority(priority)] || "is-low");

  return <>
    <div className="dashboard-heading mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="ui-page-eyebrow mb-2 flex items-center gap-2 text-[10px] font-bold uppercase"><Sparkles size={12}/>CRM workspace</p>
        <h1 className="ui-page-title font-display text-2xl font-extrabold tracking-tight sm:text-[30px]">CRM Overview</h1>
        
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="dashboard-date-chip"><CalendarDays size={15}/><span>{dateText}</span></div>
        <Button className="dashboard-add-button" onClick={() => setPage("Medicals")}><Plus size={15}/> Add account</Button>
      </div>
    </div>

    <section aria-label="CRM summary" className="mb-4 grid gap-4 lg:grid-cols-12">
      <Panel className="dashboard-card overflow-hidden lg:col-span-7 xl:col-span-5">
        <PanelHeading title="Sales overview" />
        <div className="flex items-end justify-between gap-3 px-5 pt-5 sm:px-6">
          <div><p className="dashboard-primary-number">{myMedicals.length.toLocaleString("en-IN")}</p><p className="mt-1 text-[11px] text-slate-500">Total accounts in view</p></div>
          <button type="button" onClick={() => setPage("Leads")} className="mb-1 flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-900">View pipeline <ArrowUpRight size={13}/></button>
        </div>
        <div className="px-5 pt-5 sm:px-6">
          <div className="dashboard-segment-track" role="img" aria-label={pipelineStages.map((stage) => `${stage.label}: ${stage.value}`).join(", ")}>
            {myMedicals.length ? pipelineStages.map((stage) => <span key={stage.label} className={`dashboard-segment segment-${stage.tone}`} style={{ width: `${(stage.value / myMedicals.length) * 100}%` }} title={`${stage.label}: ${stage.value}`}/>) : <span className="dashboard-empty-segment"/>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {pipelineStages.map((stage) => <div key={stage.label} className="flex min-w-0 items-start gap-2"><span className={`dashboard-legend-dot segment-${stage.tone}`}/><div className="min-w-0"><p className="truncate text-[10px] text-slate-500">{stage.label}</p><p className="mt-0.5 text-sm font-bold text-slate-800">{stage.value.toLocaleString("en-IN")}</p></div></div>)}
          </div>
        </div>
        <div className="dashboard-card-footer mt-5 flex items-center justify-between gap-3"><span>Recorded paid conversions</span><strong>{mySales.length.toLocaleString("en-IN")}</strong></div>
      </Panel>

      <Panel className="dashboard-card overflow-hidden lg:col-span-5 xl:col-span-3">
        <PanelHeading title="Evaluation health"  action={<button type="button" aria-label="View all evaluations" onClick={() => setPage("Trials")} className="dashboard-round-action"><ArrowUpRight size={15}/></button>}/>
        <div className="flex items-center justify-center px-4 pb-3 pt-5">
          <div className="dashboard-progress-ring" style={{ background: `conic-gradient(#7b61ee ${activeRate}%, #eeeafa ${activeRate}% 100%)` }}>
            <div className="dashboard-progress-center"><strong>{activeTrials.length}</strong><span>Active</span></div>
          </div>
        </div>
        <div className="dashboard-health-stats mx-5 mb-5 grid grid-cols-2 divide-x divide-slate-200 rounded-xl sm:mx-6">
          <div className="px-3 py-3"><p className="text-[10px] text-slate-500">All evaluations</p><p className="mt-1 text-base font-extrabold text-slate-900">{myTrials.length}</p></div>
          <div className="px-3 py-3"><p className="text-[10px] text-slate-500">Ending in 7 days</p><p className={`mt-1 text-base font-extrabold ${expiringTrials.length ? "text-amber-600" : "text-slate-900"}`}>{expiringTrials.length}</p></div>
        </div>
        <button type="button" onClick={() => setPage("Trials")} className="dashboard-card-footer flex w-full items-center justify-between text-left hover:bg-violet-50/70"><span>Open evaluation management</span><ArrowUpRight size={14}/></button>
      </Panel>

      <Panel className="dashboard-card overflow-hidden lg:col-span-12 xl:col-span-4">
        <PanelHeading title="Follow-up pulse"  action={<button type="button" onClick={() => setPage("Follow-ups")} className="dashboard-text-action">Open queue <ArrowUpRight size={13}/></button>}/>
        <div className="grid grid-cols-2 gap-3 px-5 pb-4 pt-4 sm:px-6">
          <div className="dashboard-mini-stat"><span className="dashboard-stat-icon stat-violet"><CalendarClock size={16}/></span><div><p className="text-[10px] text-slate-500">Open actions</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{openFollowUps.length}</p></div></div>
          <div className="dashboard-mini-stat"><span className="dashboard-stat-icon stat-blue"><Clock3 size={16}/></span><div><p className="text-[10px] text-slate-500">Due today / overdue</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{dueFollowUps.length}</p></div></div>
        </div>
        <div className="dashboard-list divide-y divide-slate-100">
          {openFollowUps.slice(0, 3).map((followUp) => {
            const dueDate = new Date(followUp.dueAt);
            const isOverdue = followUp.dueAt && !Number.isNaN(dueDate.getTime()) && dueDate < new Date();
            return <button type="button" key={followUp.id} onClick={() => setPage("Follow-ups")} className="dashboard-list-row w-full text-left hover:bg-violet-50/50">
              <span className="dashboard-list-icon stat-violet"><CalendarClock size={15}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-800">{followUp.title}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{nameOf(myMedicals, followUp.medicalId)} · {dateLabel(followUp.dueAt)}</span></span>
              <span className={`dashboard-priority ${priorityClass(followUp.priority)}`}>{isOverdue ? "Overdue" : leadPriority(followUp.priority)}</span>
            </button>;
          })}
          {!openFollowUps.length && <div className="px-5 py-5"><EmptyState title="All caught up" detail="Open follow-ups will appear here."/></div>}
        </div>
      </Panel>
    </section>

    <section aria-label="Pipeline and evaluation end dates" className="mb-4 grid gap-4 lg:grid-cols-12">
      <Panel className="dashboard-card overflow-hidden lg:col-span-7 xl:col-span-8">
        <PanelHeading title="Pipeline performance"  action={<button type="button" onClick={() => setPage("Leads")} className="dashboard-text-action">View leads <ArrowUpRight size={13}/></button>}/>
        <div className="space-y-4 px-5 pb-6 pt-5 sm:px-6">
          {pipelineStages.map((stage) => <div key={stage.label} className="dashboard-bar-row">
            <div className="mb-2 flex items-center justify-between gap-3"><span className="text-[11px] font-semibold text-slate-700">{stage.label}</span><span className="text-[11px] font-bold tabular-nums text-slate-800">{stage.value}</span></div>
            <div className="dashboard-bar-track"><div className={`dashboard-bar-fill segment-${stage.tone}`} style={{ width: `${(stage.value / stageMax) * 100}%` }}/></div>
          </div>)}
        </div>
      </Panel>

      <Panel className="dashboard-card overflow-hidden lg:col-span-5 xl:col-span-4">
        <PanelHeading title="Evaluation end-date watch"  action={<button type="button" onClick={() => setPage("Trials")} className="dashboard-round-action"><ArrowUpRight size={15}/></button>}/>
        <div className="divide-y divide-slate-100">
          {expiringTrials.map((trial) => {
            const days = daysUntil(trial.expiresAt);
            return <button key={trial.id} type="button" onClick={() => setPage("Trials")} className="dashboard-list-row w-full text-left hover:bg-amber-50/50">
              <span className="dashboard-list-icon stat-amber"><Clock3 size={15}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-800">{nameOf(myMedicals, trial.medicalId)}</span><span className="mt-1 block text-[10px] text-slate-500">Ends {dateLabel(trial.expiresAt)}</span></span>
              <span className={`dashboard-priority ${days <= 1 ? "is-high" : "is-medium"}`}>{days === 0 ? "Today" : `${days}d`}</span>
            </button>;
          })}
          {!expiringTrials.length && <div className="px-5 py-7 text-center"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={18}/></div><p className="text-xs font-semibold text-slate-700">No evaluations ending soon</p><p className="mt-1 text-[10px] text-slate-400">Evaluations nearing their end date will appear here.</p></div>}
        </div>
        <div className="dashboard-card-footer"><button type="button" onClick={() => setPage("Trials")} className="flex w-full items-center justify-between text-left"><span>Manage evaluations</span><ArrowUpRight size={14}/></button></div>
      </Panel>
    </section>

    <section aria-label="Recent records" className="grid gap-4 lg:grid-cols-12">
      <Panel className="dashboard-card overflow-hidden lg:col-span-7">
        <PanelHeading title="Recently added accounts"  action={<button type="button" onClick={() => setPage("Medicals")} className="dashboard-text-action">View all <ArrowUpRight size={13}/></button>}/>
        <div className="mt-3 divide-y divide-slate-100 md:hidden">
          {recentMedicals.map((account) => <button type="button" key={account.id} onClick={() => setPage("Medicals")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-violet-50/40">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600">{account.medicalPhotoUrl ? <img loading="lazy" decoding="async" src={account.medicalPhotoUrl} className="h-full w-full object-cover" alt=""/> : <Store size={16}/>}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-800">{account.medicalName}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{account.ownerName} · {account.locality || account.city || "Location pending"}</span><span className="mt-1 block text-[10px] text-slate-500">{account.assignedTo || "Unassigned"}</span></span>
            <Badge tone={stageTone[account.salesStage] || "slate"}>{stageLabel(account.salesStage)}</Badge>
          </button>)}
          {!recentMedicals.length && <EmptyState title="No accounts yet" detail="Add your first business prospect."/>}
        </div>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[480px] text-left"><thead><tr className="border-y border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Account / contact</th><th className="px-3 py-3">Stage</th><th className="px-5 py-3">Assigned to</th></tr></thead><tbody>
            {recentMedicals.map((account) => <tr key={account.id} className="border-b border-slate-50 transition hover:bg-violet-50/30"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600">{account.medicalPhotoUrl ? <img loading="lazy" decoding="async" src={account.medicalPhotoUrl} className="h-full w-full object-cover" alt=""/> : <Store size={16}/>}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{account.medicalName}</p><p className="mt-1 truncate text-[10px] text-slate-400">{account.ownerName} · {account.locality || account.city || "Location pending"}</p></div></div></td><td className="px-3 py-3.5"><Badge tone={stageTone[account.salesStage] || "slate"}>{stageLabel(account.salesStage)}</Badge></td><td className="px-5 py-3.5 text-xs text-slate-600">{account.assignedTo || "Unassigned"}</td></tr>)}
          </tbody></table>
          {!recentMedicals.length && <EmptyState title="No accounts yet" detail="Add your first business prospect."/>}
        </div>
      </Panel>

      <Panel className="dashboard-card overflow-hidden lg:col-span-5">
        <PanelHeading title="Upcoming meetings"  action={<button type="button" onClick={() => setPage("Demos")} className="dashboard-text-action">All meetings <ArrowUpRight size={13}/></button>}/>
        <div className="dashboard-list divide-y divide-slate-100">
          {upcomingDemos.map((demo) => <button key={demo.id} type="button" onClick={() => setPage("Demos")} className="dashboard-list-row w-full text-left hover:bg-blue-50/40"><span className="dashboard-list-icon stat-blue"><MonitorPlay size={15}/></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-slate-800">{nameOf(myMedicals, demo.medicalId)}</span><span className="mt-1 block text-[10px] text-slate-500">{demo.demoType || "Meeting"} · {demo.assignedTo || "Unassigned"}</span><span className="mt-1 block text-[10px] text-slate-400">{dateLabel(demo.scheduledAt)}</span></span><Badge tone={demo.status === "Rescheduled" ? "violet" : "blue"}>{demo.status}</Badge></button>)}
          {!upcomingDemos.length && <div className="px-5 py-7 text-center"><div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><MonitorPlay size={18}/></div><p className="text-xs font-semibold text-slate-700">No meetings scheduled</p><p className="mt-1 text-[10px] text-slate-400">Scheduled meetings will appear here.</p><Button variant="secondary" size="sm" className="mt-3" onClick={() => setPage("Demos")}>Open meeting management</Button></div>}
        </div>
      </Panel>
    </section>
  </>;
}
export function BusinessReportsPage({ medicals, demos, trials, followUps, sales, role, currentUser }) {
  const ms = medicals, ds = demos, ts = trials, fs = followUps, ss = sales;
  const [exportFormat, setExportFormat] = useState("xlsx");
  const active = ts.filter((trial) => ["Active", "Extended"].includes(trial.status)).length;
  const converted = ts.filter((trial) => trial.status === "Converted").length;
  const conversionRate = ts.length ? Math.round(converted / ts.length * 100) : 0;
  const demoCompletion = ds.length ? Math.round(ds.filter((demo) => demo.status === "Completed").length / ds.length * 100) : 0;
  const byStage = ["New", "Contacted", "Qualified", "Demo Requested", "Demo Scheduled", "Demo Completed", "Trial Requested", "Trial Active", "Negotiation", "Won", "Lost"].map((stage) => ({ stage, count: ms.filter((medical) => medical.salesStage === stage).length }));
  const bySource = ["Field Visit", "Phone", "WhatsApp", "Email", "Website", "Referral", "Campaign"].map((source) => ({ source, count: ms.filter((medical) => medical.leadSource === source).length })).filter((item) => item.count > 0);
  const paidValue = ss.reduce((sum, sale) => sum + Number(sale.price || 0), 0);
  const statusRows = (items) => Object.entries(items.reduce((counts, item) => { const status = item.status || "Unknown"; counts[status] = (counts[status] || 0) + 1; return counts; }, {})).sort(([a], [b]) => a.localeCompare(b));
  const completedFollowUps = fs.filter((item) => item.done).length;
  const openFollowUps = fs.length - completedFollowUps;
  const reportSheets = [
    { name: "Overview", rows: [["Metric", "Value"], ["Accounts", ms.length], ["Meetings", ds.length], ["Meeting completion (%)", demoCompletion], ["Evaluations", ts.length], ["Active evaluations", active], ["Converted evaluations", converted], ["Evaluation conversion (%)", conversionRate], ["Closed deals", ss.length], ["Recorded sales value (INR)", paidValue], ["Completed follow-ups", completedFollowUps], ["Open follow-ups", openFollowUps]] },
    { name: "Sales funnel", rows: [["Sales stage", "Accounts"], ...byStage.map((item) => [stageLabel(item.stage), item.count])] },
    { name: "Lead sources", rows: [["Lead source", "Accounts"], ...bySource.map((item) => [item.source, item.count])] },
    { name: "Meetings", rows: [["Meeting status", "Count"], ...statusRows(ds)] },
    { name: "Evaluations", rows: [["Evaluation status", "Count"], ...statusRows(ts)] },
    { name: "Follow-ups", rows: [["Follow-up status", "Count"], ["Open", openFollowUps], ["Completed", completedFollowUps]] },
    { name: "Closed deals", rows: [["Account", "Plan", "Price (INR)", "Closed at", "Assigned to", "Reference"], ...ss.map((sale) => [sale.medicalName || "Account", sale.plan || "", Number(sale.price || 0), sale.soldAt || "", sale.assignedTo || "", sale.reference || ""])] }
  ];
  const exportReport = () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    if (exportFormat === "xlsx") { workbookDownload("sales-report-" + dateStamp + ".xlsx", reportSheets); return; }
    if (exportFormat === "json") {
      const data = Object.fromEntries(reportSheets.map((sheet) => [sheet.name, { columns: sheet.rows[0], rows: sheet.rows.slice(1) }]));
      saveBlob("sales-report-" + dateStamp + ".json", new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), report: data }, null, 2)], { type: "application/json;charset=utf-8" })); return;
    }
    if (exportFormat === "pdf") {
      if (!printReport("Sales performance report", reportSheets)) toast.error("The print view was blocked. Allow pop-ups for this site, then try again.");
      return;
    }
    const rows = [];
    reportSheets.forEach((sheet) => {
      rows.push([sheet.name, sheet.rows[0].join(" · "), "", ""]);
      sheet.rows.slice(1).forEach((row) => rows.push([sheet.name, row[0] ?? "", row[1] ?? "", row.slice(2).join(" · ")]));
    });
    csvDownload("sales-report-" + dateStamp + ".csv", ["Report section", "Metric / item", "Value", "Details"], rows);
  };
  return <>
    <PageHeading eyebrow="Sales intelligence" title={role === "STAFF" ? "My performance" : "Sales reports"}  action={<div className="flex flex-wrap items-center gap-2"><select aria-label="Sales report export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} className={selectClass + " w-auto min-w-[170px] text-xs"}><option value="xlsx">Excel workbook (.xlsx)</option><option value="pdf">PDF / print view</option><option value="csv">CSV data</option><option value="json">JSON data</option></select><Button onClick={exportReport}><Download size={15}/> Export report</Button></div>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Accounts", value: ms.length, icon: Store }, { label: "Meeting completion", value: demoCompletion + "%", icon: MonitorPlay }, { label: "Evaluation-to-won", value: conversionRate + "%", icon: CircleDollarSign }, { label: "Recorded paid value", value: formatINR(paidValue), icon: CheckCircle2 }].map((item) => <Panel key={item.label} className="p-5"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{item.label}</p><item.icon size={17} className="text-violet-600"/></div><p className="mt-3 font-display text-2xl font-extrabold text-slate-900">{item.value}</p></Panel>)}</div>
    <div className="grid gap-5 xl:grid-cols-2"><Panel><PanelHeading title="Sales funnel" /><div className="space-y-4 px-6 pb-6 pt-6">{byStage.map((item) => <div key={item.stage}><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">{stageLabel(item.stage)}</span><span className="text-xs font-bold text-slate-800">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: Math.max(0, item.count / Math.max(ms.length, 1) * 100) + "%" }}/></div></div>)}</div></Panel><Panel><PanelHeading title="Lead source mix" /><div className="space-y-4 px-6 pb-6 pt-6">{bySource.map((item, index) => <div key={item.source}><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">{item.source}</span><span className="text-xs font-bold text-slate-800">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: Math.max(5, item.count / Math.max(ms.length, 1) * 100) + "%", opacity: 1 - index * .08 }}/></div></div>)}{!bySource.length && <EmptyState title="No lead source data yet" detail="Add account prospects with a lead source."/>}</div></Panel></div>
    <div className="mt-5 grid gap-5 md:grid-cols-3"><Panel className="p-5"><p className="text-xs text-slate-500">Active evaluations</p><p className="mt-3 font-display text-2xl font-extrabold text-slate-900">{active}</p><p className="mt-1 text-[10px] text-slate-400">Evaluations currently in progress</p></Panel><Panel className="p-5"><p className="text-xs text-slate-500">Follow-ups completed</p><p className="mt-3 font-display text-2xl font-extrabold text-slate-900">{completedFollowUps}</p><p className="mt-1 text-[10px] text-slate-400">Completed customer follow-ups</p></Panel><Panel className="p-5"><p className="text-xs text-slate-500">Open follow-ups</p><p className="mt-3 font-display text-2xl font-extrabold text-slate-900">{openFollowUps}</p><p className="mt-1 text-[10px] text-slate-400">Outstanding customer actions</p></Panel></div>
  </>;
}

export function BusinessLeadsPage({ medicals, setMedicals, role, currentUser, setPage, team = [] }) {
  const { confirm: confirmInPage, prompt: promptInPage, dialog: leadDialog } = useInPageDialog();
  const [search,setSearch]=useState("");const [stage,setStage]=useState("All");const [priority,setPriority]=useState("All");
  const rows=medicals.filter(m=>`${m.medicalName} ${m.ownerName} ${m.phone} ${m.email} ${m.locality} ${m.city}`.toLowerCase().includes(search.toLowerCase())&&(stage==="All"||m.salesStage===stage)&&(priority==="All"||leadPriority(m.priority)===priority));
  const stageOptions=["New","Contacted","Qualified","Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Negotiation","Won","Lost"];
  const update=async(id,key,value)=>{if(key==="salesStage"&&["Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Won"].includes(value)){toast.info(value==="Won"?"Use Evaluation Management to mark this opportunity as won.":"This stage is updated automatically by the Meeting or Evaluation workflow.");return;}let extra={};if(key==="salesStage"&&value==="Lost"){if(role==="STAFF"){toast.info("Ask an Admin to close this lead as lost and record the reason.");return;}const reason=await promptInPage({title:"Mark opportunity as lost",description:"Record a short reason so your team can learn from this outcome.",inputLabel:"Reason",placeholder:"e.g. Budget, timing, or chose another solution",confirmText:"Save reason",required:true});if(!reason)return;extra.lostReason=reason;}const result=await setMedicals(p=>p.map(m=>m.id===id?{...m,...extra,[key]:value,updatedAt:new Date().toISOString()}:m));if(result?.success!==false)toast.success(key==="salesStage"?"Lead stage update saved":"Lead update saved");};
  return <><PageHeading eyebrow="Lead management" title="Sales leads"  action={<Button onClick={()=>setPage("Medicals")}><Plus size={16}/> Add account lead</Button>}/><div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:"Open leads",value:medicals.filter(m=>!['Won','Lost'].includes(m.salesStage)).length,icon:Target,tint:"violet"},{label:"High-priority leads",value:medicals.filter(m=>leadPriority(m.priority)==="High").length,icon:Zap,tint:"rose"},{label:"Qualified",value:medicals.filter(m=>m.salesStage==="Qualified").length,icon:CheckCircle2,tint:"green"}].map(x=><Panel key={x.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${x.tint==="rose"?"bg-rose-50 text-rose-600":x.tint==="green"?"bg-emerald-50 text-emerald-600":"bg-violet-50 text-violet-600"}`}><x.icon size={18}/></div><div><p className="text-xs text-slate-500">{x.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{x.value}</p></div></Panel>)}</div><Panel className="overflow-hidden"><TableToolbar search={search} setSearch={setSearch} placeholder="Search account, contact, phone... "><select value={stage} onChange={e=>setStage(e.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option>{stageOptions.map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select><select value={priority} onChange={e=>setPriority(e.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select><Button variant="secondary" onClick={()=>csvDownload("business-leads.csv",["Account","Contact","Phone","Stage","Priority","Source","Staff"],rows.map(m=>[m.medicalName,m.ownerName,m.phone,m.salesStage,leadPriority(m.priority),m.leadSource,m.assignedTo]))}><Download size={14}/> Export</Button></TableToolbar><div className="divide-y divide-slate-100 md:hidden">{rows.map(m=><article key={m.id} className="space-y-3 p-4"><div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600">{m.medicalPhotoUrl?<img loading="lazy" decoding="async" src={m.medicalPhotoUrl} alt="" className="h-full w-full object-cover"/>:<Store size={18}/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{m.medicalName}</p><p className="mt-1 truncate text-xs text-slate-500">{m.ownerName}</p><p className="mt-1 text-xs text-slate-500">{m.phone||"No phone"} · {m.locality||m.city||"Area unknown"}</p></div><Badge tone={priorityTone[leadPriority(m.priority)]||"slate"}>{leadPriority(m.priority)}</Badge></div><div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sales stage</span><select value={m.salesStage||"New"} onChange={e=>update(m.id,"salesStage",e.target.value)} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs">{stageOptions.map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></label><label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Priority</span><select value={leadPriority(m.priority)} onChange={e=>update(m.id,"priority",e.target.value)} className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-xs"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label></div><div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] text-slate-500">{m.leadSource||"Source unknown"} · {m.assignedTo||"Unassigned"}</span>{m.phone&&<a href={`tel:${m.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"><Phone size={13}/> Call</a>}</div></article>)}{!rows.length&&<EmptyState title="No sales leads found" detail="Try changing the search or qualification filters."/>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1050px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Account / contact</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Assigned to</th><th className="px-4 py-3">View</th></tr></thead><tbody>{rows.map(m=><tr key={m.id} className="border-b border-slate-50 hover:bg-violet-50/30"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-violet-50 text-violet-600">{m.medicalPhotoUrl?<img loading="lazy" decoding="async" src={m.medicalPhotoUrl} alt="" className="h-full w-full object-cover"/>:<Store size={16}/>}</div><div><p className="text-xs font-bold text-slate-800">{m.medicalName}</p><p className="mt-1 text-[10px] text-slate-400">{m.ownerName} · {m.locality||m.city||"Area unknown"}</p></div></div></td><td className="px-3 py-3.5"><p className="text-xs text-slate-700">{m.phone||"—"}</p><p className="mt-1 text-[10px] text-slate-400">{m.email||"No email"}</p></td><td className="px-3 py-3.5"><Badge tone="slate">{m.leadSource||"Unknown"}</Badge></td><td className="px-3 py-3.5"><select value={m.salesStage||"New"} onChange={e=>update(m.id,"salesStage",e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{stageOptions.map(x=><option key={x} value={x}>{stageLabel(x)}</option>)}</select></td><td className="px-3 py-3.5"><select value={leadPriority(m.priority)} onChange={e=>update(m.id,"priority",e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></td><td className="px-3 py-3.5"><select disabled={role==="STAFF"} value={m.assignedTo||""} onChange={e=>update(m.id,"assignedTo",e.target.value)} className="max-w-[150px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs disabled:opacity-60"><option value="">Unassigned</option>{assignableNames(team, currentUser, role).map(x=><option key={x} value={x}>{x}</option>)}</select></td><td className="px-4 py-3.5"><button onClick={()=>setPage("Medicals")} className="rounded-lg px-2.5 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">Account profile</button></td></tr>)}</tbody></table>{!rows.length&&<EmptyState title="No sales leads found" detail="Try changing the search or qualification filters."/>}</div><div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">{rows.length} visible sales leads</div></Panel>{leadDialog}</>;
}

export function BusinessPipelinePage({ medicals, setMedicals, role, currentUser, setPage }) {
  const { confirm: confirmInPage, prompt: promptInPage, dialog: pipelineDialog } = useInPageDialog();
  const [view,setView]=useState("Board");const stages=["New","Contacted","Qualified","Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Negotiation","Won","Lost"];
  const visible=medicals; // The API scopes the list to the current user's authorized records.
  const counts=stages.map(stage=>({stage,items:visible.filter(m=>m.salesStage===stage)}));
  const move=async(id,salesStage)=>{if(["Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Won"].includes(salesStage)){toast.info(salesStage==="Won"?"Close the opportunity from Evaluation Management to record the deal.":"Use the meeting or evaluation workflow to move an account into this stage.");return;}let extra={};if(salesStage==="Lost"){if(role==="STAFF"){toast.info("An Admin must close this lead as lost.");return;}const reason=await promptInPage({title:"Mark opportunity as lost",description:"Record a short reason so your team can learn from this outcome.",inputLabel:"Reason",placeholder:"e.g. Budget, timing, or chose another solution",confirmText:"Save reason",required:true});if(!reason)return;extra.lostReason=reason;}const result=await setMedicals(p=>p.map(m=>m.id===id?{...m,...extra,salesStage,updatedAt:new Date().toISOString()}:m));if(result?.success!==false)toast.success(`Lead stage saved: ${salesStage}`);};
  return <><PageHeading eyebrow="Sales conversion" title="Sales pipeline"  action={<Button onClick={()=>setPage("Medicals")}><Plus size={16}/> Add lead</Button>}/><div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:"Open prospects",value:visible.filter(m=>!['Won','Lost'].includes(m.salesStage)).length},{label:"In evaluation / negotiation",value:visible.filter(m=>['Trial Active','Negotiation'].includes(m.salesStage)).length},{label:"Won customers",value:visible.filter(m=>m.salesStage==='Won').length}].map(x=><Panel key={x.label} className="p-4"><p className="text-xs text-slate-500">{x.label}</p><p className="mt-2 font-display text-2xl font-extrabold text-slate-900">{x.value}</p></Panel>)}</div><div className="mb-4 flex items-center justify-between gap-3"><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={()=>setView("Board")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view==="Board"?"bg-violet-50 text-violet-700":"text-slate-500"}`}>Board view</button><button onClick={()=>setView("List")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view==="List"?"bg-violet-50 text-violet-700":"text-slate-500"}`}>List view</button></div><p className="text-[11px] text-slate-400">Drag a card or use the stage selector</p></div>{view==="Board"?<div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">{counts.map(({stage,items})=><div key={stage} onDragOver={e=>e.preventDefault()} onDrop={e=>{const id=String(e.dataTransfer.getData("text/plain"));if(id)move(id,stage)}} className="w-[252px] min-w-[252px] rounded-2xl border border-slate-200/80 bg-slate-100/65 p-3"><div className="mb-3 flex items-center justify-between px-1"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${stage==="Won"?"bg-emerald-500":stage==="Lost"?"bg-rose-500":stage.includes("Evaluation")?"bg-blue-500":stage.includes("Demo")?"bg-violet-500":"bg-slate-400"}`}/><h3 className="text-xs font-bold text-slate-800">{stageLabel(stage)}</h3><span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-500">{items.length}</span></div></div><div className="space-y-3">{items.map(m=><div key={m.id} draggable onDragStart={e=>e.dataTransfer.setData("text/plain",String(m.id))} className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-[0_2px_8px_rgba(28,20,54,.025)] transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"><div className="flex items-start gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-violet-50 text-violet-600">{m.medicalPhotoUrl?<img loading="lazy" decoding="async" src={m.medicalPhotoUrl} alt="" className="h-full w-full object-cover"/>:<Store size={15}/>}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold leading-5 text-slate-800">{m.medicalName}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{m.ownerName}</p></div></div><div className="mt-3 flex items-center justify-between"><Badge tone={priorityTone[leadPriority(m.priority)]||"slate"}>{leadPriority(m.priority)}</Badge><span className="text-[10px] text-slate-400">{m.leadSource||"Source unknown"}</span></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="truncate text-[10px] text-slate-500">{m.assignedTo||"Unassigned"}</span><select aria-label={`Move ${m.medicalName}`} value={m.salesStage} onChange={e=>move(m.id,e.target.value)} className="max-w-[120px] rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px]">{[...new Set([m.salesStage,"New","Contacted","Qualified","Negotiation",...(role!=="STAFF"?["Lost"]:[])])].map(s=><option key={s} disabled={["Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Won"].includes(s)}>{s}</option>)}</select></div></div>)}{!items.length&&<div className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-8 text-center text-[11px] text-slate-400">Drop an account here</div>}</div></div>)}</div>:<Panel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Account</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3">Priority</th><th className="px-3 py-3">Assigned to</th></tr></thead><tbody>{visible.map(m=><tr key={m.id} className="border-b border-slate-50"><td className="px-5 py-4 text-xs font-bold">{m.medicalName}</td><td className="px-3 py-4 text-xs">{m.ownerName}</td><td className="px-3 py-4"><select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={m.salesStage} onChange={e=>move(m.id,e.target.value)}>{[...new Set([m.salesStage,"New","Contacted","Qualified","Negotiation",...(role!=="STAFF"?["Lost"]:[])])].map(s=><option key={s} disabled={["Demo Requested","Demo Scheduled","Demo Completed","Trial Requested","Trial Active","Won"].includes(s)}>{s}</option>)}</select></td><td className="px-3 py-4"><Badge tone={priorityTone[leadPriority(m.priority)]||"slate"}>{leadPriority(m.priority)}</Badge></td><td className="px-3 py-4 text-xs">{m.assignedTo}</td></tr>)}</tbody></table></div></Panel>}{pipelineDialog}</>;
}

export function ActivityLogPage({ activities, setActivities, medicals, role, currentUser, team = [], loading = false }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [form, setForm] = useState({});
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openCreate = () => {
    setForm({
      medicalId: "", type: "Call", direction: "Outbound", title: "", details: "",
      outcome: "Connected", occurredAt: toDateTimeLocal(new Date()), assignedTo: currentUser,
      latitude: null, longitude: null, locationAccuracy: null, locationCapturedAt: null,
      locationMethod: "Not captured", googleMapsUrl: ""
    });
    setFormOpen(true);
  };
  const captureVisitLocation = () => {
    if (!window.isSecureContext) { toast.error("Visit GPS needs a secure page. On PC use http://localhost:5173; on a phone run npm.cmd run dev:mobile and open its HTTPS URL."); return; }
    if (!navigator.geolocation) { toast.error("This browser does not support location capture."); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setForm((previous) => ({ ...previous, latitude, longitude, locationAccuracy: Math.round(accuracy), locationCapturedAt: new Date().toISOString(), locationMethod: "GPS", googleMapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}` }));
      setGeoBusy(false);
      toast.success("Visit location captured", { description: `Device location accuracy is approximately ${Math.round(accuracy)} metres. Confirm this is the account location.` });
    }, (error) => {
      setGeoBusy(false);
      toast.error(error.code === 1 ? "Location permission denied. You can still log the visit without GPS." : "Could not capture location. Try again or log the visit without GPS.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const filtered = activities.filter((item) => {
    const text = `${item.title} ${item.details} ${item.medicalName || nameOf(medicals, item.medicalId)} ${item.ownerName || ownerOf(medicals, item.medicalId)} ${item.assignedTo} ${item.type} ${item.outcome}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (typeFilter === "All" || item.type === typeFilter);
  }).sort((a, b) => new Date(b.occurredAt || b.createdAt || 0) - new Date(a.occurredAt || a.createdAt || 0));

  const saveActivity = async (event) => {
    event.preventDefault();
    if (!form.medicalId) { toast.error("Select the account this activity relates to."); return; }
    if (form.type === "Visit" && ((form.latitude == null) !== (form.longitude == null))) { toast.error("The location is incomplete. Capture GPS again or remove the coordinates."); return; }
    const payload = {
      id: createId(), medicalId: form.medicalId, type: form.type, direction: form.direction,
      title: form.title.trim(), details: form.details.trim(), outcome: form.outcome,
      occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : new Date().toISOString(),
      assignedTo: form.assignedTo || currentUser, locationMethod: form.locationMethod || "Not captured",
      latitude: form.latitude == null || form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude == null || form.longitude === "" ? null : Number(form.longitude),
      locationAccuracy: form.locationAccuracy == null || form.locationAccuracy === "" ? null : Number(form.locationAccuracy),
      locationCapturedAt: form.locationCapturedAt || null, googleMapsUrl: form.googleMapsUrl || ""
    };
    const result = await setActivities((previous) => [payload, ...previous]);
    if (result?.success === false) return;
    setFormOpen(false);
    toast.success("Activity added to the history", { description: "This is an activity log; it does not send messages automatically." });
  };

  const iconFor = (type) => type === "Call" ? PhoneCall : type === "Visit" ? MapPinned : type === "WhatsApp" ? MessageCircle : type === "Email" ? Mail : type === "Meeting" ? CalendarDays : FileText;
  const toneFor = (type) => type === "Call" ? "blue" : type === "Visit" ? "green" : type === "WhatsApp" ? "green" : type === "Email" ? "violet" : type === "Meeting" ? "amber" : "slate";

  return <>
    <PageHeading eyebrow="Customer touchpoints" title="Activity history"  action={<Button onClick={openCreate}><Plus size={16}/> Log activity</Button>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      {[{ label: "All activity logs", value: activities.length, icon: Activity, tint: "violet" }, { label: "Field visits", value: activities.filter((x) => x.type === "Visit").length, icon: MapPinned, tint: "green" }, { label: "Calls & online touchpoints", value: activities.filter((x) => ["Call", "WhatsApp", "Email", "Meeting"].includes(x.type)).length, icon: PhoneCall, tint: "blue" }].map((metric) => <Panel key={metric.label} className="flex items-center gap-3 p-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tint === "green" ? "bg-emerald-50 text-emerald-600" : metric.tint === "blue" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}><metric.icon size={18}/></div><div><p className="text-xs text-slate-500">{metric.label}</p><p className="mt-0.5 text-xl font-extrabold text-slate-900">{metric.value}</p></div></Panel>)}
    </div>
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="w-full sm:max-w-sm"><SearchInput value={search} onChange={setSearch} placeholder="Search account, activity, contact..."/></div><div className="flex flex-wrap items-center gap-2"><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={`${selectClass} w-auto text-xs`}><option>All</option>{["Call", "Visit", "WhatsApp", "Email", "Meeting", "Note"].map((type) => <option key={type}>{type}</option>)}</select><Button variant="secondary" onClick={() => csvDownload("activity-history.csv", ["Account", "Contact", "Type", "Direction", "Title", "Outcome", "Occurred at", "Staff", "Details", "Latitude", "Longitude"], filtered.map((item) => [item.medicalName || nameOf(medicals, item.medicalId), item.ownerName || ownerOf(medicals, item.medicalId), item.type, item.direction, item.title, item.outcome, item.occurredAt, item.assignedTo, item.details, item.latitude, item.longitude]))}><Download size={14}/> Export</Button></div></div>
      <div className="divide-y divide-slate-100">
        {filtered.map((item) => {
          const Icon = iconFor(item.type);
          const medicalName = item.medicalName || nameOf(medicals, item.medicalId);
          const ownerName = item.ownerName || ownerOf(medicals, item.medicalId);
          return <div key={item.id} className="flex gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:gap-4 sm:px-6">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === "Visit" ? "bg-emerald-50 text-emerald-600" : item.type === "Call" ? "bg-blue-50 text-blue-600" : item.type === "WhatsApp" ? "bg-green-50 text-green-600" : item.type === "Email" ? "bg-violet-50 text-violet-600" : item.type === "Meeting" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"}`}><Icon size={17}/></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold text-slate-900">{item.title}</p><Badge tone={toneFor(item.type)}>{item.type}</Badge><Badge tone={item.direction === "Inbound" ? "blue" : item.direction === "Internal" ? "slate" : "violet"}>{item.direction || "Outbound"}</Badge></div>
              <p className="mt-1.5 text-xs text-slate-600"><span className="font-semibold text-slate-800">{medicalName}</span> <span className="text-slate-300">·</span> Contact: {ownerName}</p>
              {item.details && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{item.details}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400"><span className="inline-flex items-center gap-1"><CalendarDays size={11}/>{dateLabel(item.occurredAt || item.createdAt)}</span><span>Logged by {item.createdBy || item.assignedTo || "Team"}</span><span>Assigned to {item.assignedTo || currentUser}</span>{item.outcome && <Badge tone={item.outcome === "Interested" || item.outcome === "Meeting booked" || item.outcome === "Evaluation requested" ? "green" : item.outcome === "Not interested" || item.outcome === "No answer" ? "amber" : "slate"}>{item.outcome}</Badge>}</div>
            </div>
            {item.latitude != null && item.longitude != null && <a href={item.googleMapsUrl || `https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" className="flex h-9 shrink-0 items-center gap-1 self-start rounded-lg border border-slate-200 px-2.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-50"><MapPin size={12}/> Map</a>}
          </div>;
        })}
        {!filtered.length && <EmptyState title={loading ? "Loading activity history…" : "No activity records yet"} detail="Log a call, business visit, message, meeting or note to start the timeline."/>}
      </div>
      <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">{filtered.length} activity records · Activity logs are append-only; add a correction note instead of silently changing history.</div>
    </Panel>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Log a sales activity" description="Record an interaction. This does not send a call, email or WhatsApp message." wide>
      <form onSubmit={saveActivity} className="space-y-4">
        <FieldGrid>
          <FormField label="Business account" required><SearchableSelect value={form.medicalId || ""} onChange={(value) => set("medicalId", value)} placeholder="Search account name or area…" required options={medicals.filter((m) => !m.archived).map((m) => ({ value: m.id, label: `${m.medicalName}${m.locality ? ` · ${m.locality}` : ""}${m.phone ? ` · ${m.phone}` : ""}` }))} /></FormField>
          <FormField label="Activity type" required><SearchableSelect value={form.type || "Call"} onChange={(type) => setForm((previous) => ({ ...previous, type, ...(type !== "Visit" ? { latitude: null, longitude: null, locationAccuracy: null, locationCapturedAt: null, locationMethod: "Not captured", googleMapsUrl: "" } : {}) }))} options={["Call", "Visit", "WhatsApp", "Email", "Meeting", "Note"].map((type) => ({ value: type, label: type }))} /></FormField>
          <FormField label="Direction"><SearchableSelect value={form.direction || "Outbound"} onChange={(value) => set("direction", value)} options={["Outbound", "Inbound", "Internal"].map((x) => ({ value: x, label: x }))} /></FormField>
          <FormField label="Outcome"><SearchableSelect value={form.outcome || "Other"} onChange={(value) => set("outcome", value)} options={["Connected", "No answer", "Interested", "Follow-up requested", "Not interested", "Meeting booked", "Evaluation requested", "Callback requested", "Wrong number", "Other"].map((x) => ({ value: x, label: x }))} /></FormField>
          <FormField label="Activity title" required><input required minLength={2} maxLength={180} className={inputClass} value={form.title || ""} onChange={(event) => set("title", event.target.value)} placeholder="e.g. Discussed goals, timeline and next steps"/></FormField>
          <FormField label="Date and time" required><input required type="datetime-local" className={inputClass} value={form.occurredAt || ""} onChange={(event) => set("occurredAt", event.target.value)}/></FormField>
          <FormField label="Assigned to"><SearchableSelect value={form.assignedTo || currentUser} onChange={(value) => set("assignedTo", value)} options={assignableNames(team, currentUser, role).map((name) => ({ value: name, label: name }))} /></FormField>
        </FieldGrid>
        <FormField label="Notes / details"><textarea rows={4} maxLength={3000} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100" value={form.details || ""} onChange={(event) => set("details", event.target.value)} placeholder="What was discussed? Any objections, requirements or next steps?"/></FormField>
        {form.type === "Visit" && <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-800">Optional visit location</p><p className="mt-1 text-[11px] text-slate-500">Capture this device's location only while you are at the visit. It is not independent proof that you are at the business location.</p></div><Button type="button" variant="secondary" onClick={captureVisitLocation} disabled={geoBusy}><LocateFixed size={14}/>{geoBusy ? "Capturing…" : form.latitude != null ? "Refresh GPS" : "Use current location"}</Button></div>{form.latitude != null && form.longitude != null && <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-600"><span>{Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}</span><span>±{form.locationAccuracy || "?"} m</span><a className="font-semibold text-violet-700 hover:underline" target="_blank" rel="noreferrer" href={form.googleMapsUrl}>Preview map</a><button type="button" onClick={() => setForm((previous) => ({ ...previous, latitude: null, longitude: null, locationAccuracy: null, locationCapturedAt: null, locationMethod: "Not captured", googleMapsUrl: "" }))} className="font-semibold text-rose-600 hover:underline">Remove location</button></div>}</div>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit"><Plus size={15}/> Save activity</Button></div>
      </form>
    </Modal>
  </>;
}


export function WhatsAppPage({ medicals = [], role = "STAFF" }) {
  const { confirm: confirmInPage, prompt: promptInPage, dialog: whatsAppDialog } = useInPageDialog();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [mediaName, setMediaName] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [sending, setSending] = useState(false);
  const eligible = medicals.filter((m) => m.whatsappOptIn && (m.whatsapp || m.phone) && !m.archived);
  const filtered = eligible.filter((m) => `${m.medicalName} ${m.ownerName} ${m.whatsapp || m.phone}`.toLowerCase().includes(search.toLowerCase()));
  const toggle = (id) => setSelected((previous) => previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]);
  const send = async () => {
    if (!selected.length) { toast.error("Select at least one contact with confirmed WhatsApp consent."); return; }
    if (!message.trim() && !mediaUrl.trim() && !mediaId) { toast.error("Write a message or attach media."); return; }
    if (selected.length > 1 && role === "STAFF") { toast.error("Staff can send to one contact at a time. Bulk sends are restricted to Admin and Super Admin."); return; }
    if (mediaUrl.trim() && !/^https:\/\//i.test(mediaUrl.trim())) { toast.error("Media must be hosted at an HTTPS URL accessible by WhatsApp Cloud API."); return; }
    if (!await confirmInPage({ title: "Send WhatsApp message?", description: `Send this message to ${selected.length} opted-in contact${selected.length === 1 ? "" : "s"}?`, confirmText: `Send to ${selected.length} contact${selected.length === 1 ? "" : "s"}` })) return;
    setSending(true);
    try {
      const result = await api.post("/whatsapp/broadcast", { recipientIds: selected, message: message.trim(), ...(mediaId ? { mediaId, mediaType } : mediaUrl.trim() ? { mediaUrl: mediaUrl.trim(), mediaType } : {}) });
      const summary = result.summary || {};
      toast.success(`Provider accepted ${summary.sent || 0} message(s)`, { description: `${summary.failed || 0} failed · ${summary.skipped || 0} skipped. Accepted by provider does not guarantee delivery.` });
      setSelected([]);
    } catch (error) { toast.error("WhatsApp send could not be completed", { description: error.message }); }
    finally { setSending(false); }
  };
  return <><PageHeading eyebrow="Customer communication" title="WhatsApp Business" /><div className="mb-5 grid gap-3 sm:grid-cols-3">{[{label:"Opted-in contacts",value:eligible.length},{label:"Selected recipients",value:selected.length},{label:"Access",value:role === "SUPER_ADMIN" ? "Super Admin" : role === "ADMIN" ? "Admin" : "Single contact"}].map((x)=><Panel key={x.label} className="p-4"><p className="text-xs text-slate-500">{x.label}</p><p className="mt-2 font-display text-2xl font-bold text-slate-900">{x.value}</p></Panel>)}</div><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div><h2 className="text-sm font-bold text-slate-900">Recipients</h2><p className="mt-1 text-xs text-slate-500">Only contacts marked as opted-in appear here.</p></div><Button variant="secondary" size="sm" onClick={()=>setSelected(filtered.map((m)=>m.id))} disabled={!filtered.length}>Select visible</Button></div><div className="border-b border-slate-100 p-3"><SearchInput value={search} onChange={setSearch} placeholder="Search opted-in contacts..."/></div><div className="max-h-[480px] divide-y divide-slate-100 overflow-auto">{filtered.map((m)=><label key={m.id} className="flex cursor-pointer items-center gap-3 p-3.5 hover:bg-violet-50/40"><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)} className="accent-violet-600"/><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle size={17}/></span><span className="min-w-0 flex-1"><b className="block truncate text-xs text-slate-800">{m.medicalName}</b><span className="mt-1 block truncate text-[11px] text-slate-500">{m.ownerName || "Contact"} · {m.whatsapp || m.phone}</span></span><Badge tone="green">Opted in</Badge></label>)}{!filtered.length&&<EmptyState title="No opted-in contacts" detail="Open an account profile and record explicit WhatsApp consent first."/>}</div><div className="border-t border-slate-100 p-3 text-[11px] text-slate-500">{filtered.length} contacts match · {selected.length} selected</div></Panel><Panel className="p-5"><div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><MessageCircle size={20}/></span><div><h2 className="text-sm font-bold text-slate-900">Compose message</h2><p className="mt-1 text-xs text-slate-500">Personalized campaigns should use approved templates when required by Meta.</p></div></div><label className="mb-1.5 block text-xs font-semibold text-slate-700">Message / caption</label><textarea value={message} onChange={(e)=>setMessage(e.target.value)} rows={6} maxLength={4096} placeholder="Write a clear, relevant message..." className={`${fieldClass} min-h-32 resize-y`}/><p className="mt-1 text-right text-[10px] text-slate-400">{message.length}/4096</p><div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr]"><label className="text-xs font-semibold text-slate-700">Media type<select value={mediaType} onChange={(e)=>setMediaType(e.target.value)} className={`${selectClass} mt-1.5`}><option value="image">Image / banner</option><option value="video">Video</option><option value="document">Document</option></select></label><div className="text-xs font-semibold text-slate-700">Upload media (optional)<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" disabled={uploadingMedia || sending} onChange={async (e)=>{const file=e.target.files?.[0]; if(!file)return; const mime=file.type; const kind=mime.startsWith("image/")?"image":mime.startsWith("video/")?"video":"document"; if(file.size>16*1024*1024){toast.error("Media must be 16 MB or smaller.");e.target.value="";return;} setUploadingMedia(true);setMediaType(kind);setMediaId("");setMediaUrl("");try{const data=new FormData();data.append("media",file);const result=await api.post("/whatsapp/media",data);setMediaId(result.mediaId);setMediaName(file.name);toast.success("Media uploaded to WhatsApp");}catch(error){toast.error("Media upload failed",{description:error.message});}finally{setUploadingMedia(false);}}} className={`${fieldClass} mt-1.5 text-[11px]`}/>{uploadingMedia&&<span className="mt-1 block text-[11px] text-violet-700">Uploading media securely…</span>}{mediaId&&<span className="mt-1 block text-[11px] text-emerald-700">Ready: {mediaName}</span>}</div></div><label className="mt-3 block text-xs font-semibold text-slate-700">Or use a public HTTPS media URL<input value={mediaUrl} onChange={(e)=>{setMediaUrl(e.target.value);if(e.target.value)setMediaId("");}} placeholder="https://your-domain.com/banner.jpg" className={`${fieldClass} mt-1.5`}/></label><p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">Messages are sent only to contacts with recorded opt-in. Meta may require approved templates outside the customer-service window. Upload supports JPG, PNG, WebP, MP4 and PDF (up to 16 MB). Follow WhatsApp Business policies and local messaging rules.</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><Button variant="secondary" onClick={()=>setSelected([])}>Clear selection</Button><Button onClick={send} disabled={sending || uploadingMedia || !selected.length}>{sending ? "Sending…" : `Send to ${selected.length} contact${selected.length===1?"":"s"}`}</Button></div></Panel></div>{whatsAppDialog}</>;
}





