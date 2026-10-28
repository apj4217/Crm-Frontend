import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

function isFile(value) {
  return typeof File !== "undefined" && value instanceof File;
}

function isMongoId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ""));
}

function normaliseDateFields(resource, payload) {
  const datesByResource = {
    medicals: ["locationCapturedAt"],
    demos: ["requestedAt", "scheduledAt", "completedAt", "nextActionAt"],
    trials: ["requestedAt", "approvedAt", "startedAt", "expiresAt", "convertedAt"],
    followUps: ["dueAt", "completedAt"],
    activities: ["occurredAt", "locationCapturedAt"],
    users: ["lastLoginAt"]
  };
  const dayOnlyFields = new Set(["startedAt", "expiresAt"]);
  for (const key of datesByResource[resource] || []) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if (value === "" || value == null) { payload[key] = null; continue; }
    if (typeof value === "string" && !value.endsWith("Z") && !/[+-]\d\d:\d\d$/.test(value)) {
      if (dayOnlyFields.has(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) payload[key] = `${value}T00:00:00.000Z`;
      else {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) payload[key] = date.toISOString();
      }
    }
  }
  return payload;
}

function preparePayload(resource, item, previous) {
  const payload = { ...item };
  delete payload.id;
  delete payload._id;
  delete payload.__v;
  delete payload.createdAt;
  delete payload.updatedAt;
  delete payload.createdBy;
  delete payload.createdById;
  delete payload.assignedToId;
  delete payload.approvedById;
  delete payload.updatedBy;
  delete payload.archived;
  delete payload.lastLoginAt;
  delete payload.mustChangePassword;
  delete payload.statusLabel;

  if (resource === "medicals") {
    const medicalPhoto = payload.medicalPhotoUrl;
    const ownerPhoto = payload.ownerPhotoUrl;
    delete payload.medicalPhotoUrl;
    delete payload.ownerPhotoUrl;
    if (isFile(medicalPhoto)) payload.__medicalPhoto = medicalPhoto;
    else if (!medicalPhoto && previous?.medicalPhotoUrl) payload.removeMedicalPhoto = true;
    if (isFile(ownerPhoto)) payload.__ownerPhoto = ownerPhoto;
    else if (!ownerPhoto && previous?.ownerPhotoUrl) payload.removeOwnerPhoto = true;
  }
  if (resource === "trials" && (payload.demoId === "" || payload.demoId === 0 || payload.demoId == null)) delete payload.demoId;
  if (resource === "users") {
    delete payload.createdBy;
    delete payload.createdById;
    delete payload.lastLoginAt;
    delete payload.mustChangePassword;
  }
  return normaliseDateFields(resource, payload);
}

async function sendCollectionMutation(resource, method, item, previous) {
  const id = String(item.id);
  const payload = preparePayload(resource, item, previous);
  const medicalPhoto = payload.__medicalPhoto;
  const ownerPhoto = payload.__ownerPhoto;
  delete payload.__medicalPhoto;
  delete payload.__ownerPhoto;

  if (resource === "medicals" && (isFile(medicalPhoto) || isFile(ownerPhoto))) {
    const form = new FormData();
    form.append("data", JSON.stringify(payload));
    if (isFile(medicalPhoto)) form.append("medicalPhoto", medicalPhoto, medicalPhoto.name);
    if (isFile(ownerPhoto)) form.append("ownerPhoto", ownerPhoto, ownerPhoto.name);
    return method === "POST" ? api.post("/medicals", form) : api.patch(`/medicals/${id}`, form);
  }
  const body = { ...payload };
  if (method === "POST") return api.post(`/${resource === "followUps" ? "follow-ups" : resource}`, body);
  if (method === "PATCH") return api.patch(`/${resource === "followUps" ? "follow-ups" : resource}/${id}`, body);
  return api.delete(`/${resource === "followUps" ? "follow-ups" : resource}/${id}`);
}

function same(a, b) {
  const normalise = (value) => {
    if (isFile(value)) return { __file: value.name, size: value.size, modified: value.lastModified };
    if (Array.isArray(value)) return value.map(normalise);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalise(value[key])]));
    return value;
  };
  return JSON.stringify(normalise(a)) === JSON.stringify(normalise(b));
}

function mergeServerRecord(resource, serverRecord, currentRecord) {
  if (!serverRecord) return currentRecord;
  const merged = { ...currentRecord, ...serverRecord, id: String(serverRecord.id || currentRecord.id) };
  for (const key of ["createdAt", "updatedAt", "createdBy", "createdById", "assignedToId", "mustChangePassword", "lastLoginAt", "archived"]) {
    if (key in serverRecord) merged[key] = serverRecord[key];
  }
  if (resource === "medicals") {
    // Server-generated authenticated URLs replace File objects after a successful upload.
    merged.medicalPhotoUrl = serverRecord.medicalPhotoUrl || "";
    merged.ownerPhotoUrl = serverRecord.ownerPhotoUrl || "";
    delete merged.allowDuplicate;
    delete merged.removeMedicalPhoto;
    delete merged.removeOwnerPhoto;
  }
  if (resource === "users") delete merged.initialPassword;
  return merged;
}

export function useRemoteCollection(resource, enabled = true) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const itemsRef = useRef([]);
  // Map temporary client IDs to Mongo IDs after a create request succeeds. This prevents
  // a quick follow-up edit from PATCHing a placeholder ID while mutations are queued.
  const idMapRef = useRef(new Map());
  const enabledRef = useRef(enabled);
  const queueRef = useRef(Promise.resolve());
  enabledRef.current = enabled;

  const refresh = useCallback(async () => {
    if (!enabledRef.current) return [];
    setLoading(true);
    try {
      const endpoint = resource === "followUps" ? "/follow-ups?limit=500" : `/${resource}?limit=500`;
      const rows = await api.get(endpoint);
      const next = Array.isArray(rows) ? rows.map((x) => ({ ...x, id: String(x.id || x._id) })) : [];
      itemsRef.current = next;
      setItems(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      itemsRef.current = [];
      idMapRef.current.clear();
      setItems([]);
      setLoading(false);
      return () => { mounted = false; };
    }
    setLoading(true);
    const endpoint = resource === "followUps" ? "/follow-ups?limit=500" : `/${resource}?limit=500`;
    api.get(endpoint).then((rows) => {
      if (!mounted) return;
      const next = Array.isArray(rows) ? rows.map((x) => ({ ...x, id: String(x.id || x._id) })) : [];
      itemsRef.current = next;
      setItems(next);
    }).catch((error) => {
      if (mounted) toast.error(`Could not load ${resource}`, { description: error.message });
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [resource, enabled]);

  const setData = useCallback((updater) => {
    const before = itemsRef.current;
    const next = typeof updater === "function" ? updater(before) : updater;
    if (!Array.isArray(next)) return;
    const oldById = new Map(before.map((item) => [String(item.id), item]));
    const nextById = new Map(next.map((item) => [String(item.id), item]));
    itemsRef.current = next;
    setItems(next);
    if (!enabledRef.current) return Promise.resolve({ success: true });

    const jobs = [];
    for (const oldItem of before) if (!nextById.has(String(oldItem.id))) jobs.push({ method: "DELETE", item: oldItem, previous: oldItem });
    for (const item of next) {
      const previous = oldById.get(String(item.id));
      if (!previous) jobs.push({ method: "POST", item, previous: null });
      else if (!same(previous, item)) jobs.push({ method: "PATCH", item, previous });
    }
    if (!jobs.length) return Promise.resolve({ success: true });

    queueRef.current = queueRef.current.catch(() => ({ success: false })).then(async () => {
      let failed = false;
      for (const originalJob of jobs) {
        try {
          const originalId = String(originalJob.item.id);
          const resolvedId = idMapRef.current.get(originalId) || originalId;
          const job = resolvedId === originalId ? originalJob : {
            ...originalJob,
            item: { ...originalJob.item, id: resolvedId },
            previous: originalJob.previous ? { ...originalJob.previous, id: resolvedId } : null
          };
          if (job.method === "DELETE" && resource === "medicals") {
            await api.delete(`/medicals/${job.item.id}`);
            continue;
          }
          if (job.method === "DELETE") {
            // History-bearing CRM records are cancelled/closed rather than silently erased.
            if (resource === "demos") await api.patch(`/demos/${job.item.id}`, { status: "Cancelled" });
            else if (resource === "trials") await api.patch(`/trials/${job.item.id}`, { status: "Cancelled" });
            else if (resource === "followUps") await api.patch(`/follow-ups/${job.item.id}`, { done: true });
            else if (resource === "users") await api.delete(`/users/${job.item.id}`);
            continue;
          }
          const serverRecord = await sendCollectionMutation(resource, job.method, job.item, job.previous);
          if (job.method === "POST" && serverRecord?.id && originalId !== String(serverRecord.id)) {
            idMapRef.current.set(originalId, String(serverRecord.id));
          }
          const lookupId = job.method === "POST" ? originalId : resolvedId;
          const current = itemsRef.current.find((x) => String(x.id) === String(lookupId));
          if (current && serverRecord && typeof serverRecord === "object") {
            const merged = mergeServerRecord(resource, serverRecord, current);
            const updated = itemsRef.current.map((x) => String(x.id) === String(lookupId) ? merged : x);
            itemsRef.current = updated;
            setItems(updated);
          }
        } catch (error) {
          failed = true;
          const title = resource === "medicals" && originalJob.method === "DELETE" ? "Could not delete account" : `Could not save ${resource}`;
          toast.error(title, { description: error.message });
          try { await refresh(); } catch { /* Keep the current view and surface the save failure. */ }
        }
      }
      return { success: !failed };
    });
    return queueRef.current;
  }, [resource, refresh]);

  return { data: items, setData, refresh, loading };
}

export function useRemoteValue(path, enabled = true, initial = []) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(enabled));
  const refresh = useCallback(async () => {
    if (!enabled) return initial;
    setLoading(true);
    try {
      const result = await api.get(path);
      setData(result);
      return result;
    } finally { setLoading(false); }
  }, [path, enabled]);
  useEffect(() => {
    let mounted = true;
    if (!enabled) { setData(initial); setLoading(false); return () => { mounted = false; }; }
    setLoading(true);
    api.get(path).then((result) => { if (mounted) setData(result); }).catch((error) => { if (mounted) toast.error(`Could not load ${path}`, { description: error.message }); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [path, enabled]);
  return { data, setData, refresh, loading };
}
