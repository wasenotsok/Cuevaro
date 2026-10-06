import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  Pressable,
  TextInput,
  StyleSheet,
  Image,
  Platform,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import * as Crypto from "expo-crypto";
import {
  openStore,
  type LocalStore,
  type Capture,
  type RecordCache,
} from "./storage";
import { pick, preserve, inspect, cleanupCaptureCache } from "./capture";
import { capturePages, assemblePage } from "./pages";
import {
  reviewItems,
  initialItemFacts,
  type ItemChoice,
} from "../../packages/domain/review-items";
import { copy } from "./strings";
import {
  correctRecord,
  type Correction,
} from "../../packages/domain/corrections";
import {
  extractText,
  confirm,
  derive,
  fields,
  type Field,
  type Draft,
} from "../../packages/domain/purchase";
import { mayExtract, pdfQuality } from "../../packages/domain/quality";
import {
  updateAttention,
  type AttentionCommand,
} from "../../packages/domain/attention";
const api = "http://127.0.0.1:4329";
const labels: Record<Field, string> = {
  merchant: "Merchant",
  purchaseDate: "Purchase date",
  total: "Total",
  currency: "Currency",
  item: "Item",
  returnDate: "Return deadline",
  warrantyDate: "Warranty ends",
};
const findingLabels: Record<string, string> = {
  blur: "Text may be blurry.",
  glare: "Too much light may hide text.",
  low_light: "The photo is too dark.",
  faded: "The receipt has too little contrast.",
  small_text: "Text is too small to read reliably.",
  cut_off: "Part of the receipt is cut off.",
  skew: "The receipt angle is too steep.",
  perspective:
    "The receipt is photographed at a steep perspective. Retake it straight-on.",
  washout:
    "A bright region may hide text. Check it against the original or retake without reflection.",
  occlusion: "A large region may cover or hide receipt text.",
  multiple_documents: "There may be more than one document.",
  unverified_edges:
    "I cannot verify that every receipt edge is visible. Check the full receipt before continuing.",
};
const consequential = new Set<Field>([
  "purchaseDate",
  "total",
  "returnDate",
  "warrantyDate",
]);
function bytes64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(s);
}
async function request(path: string, body?: unknown) {
  if (Platform.OS !== "web")
    throw Error("Native cloud sync is not configured.");
  const res = await fetch(api + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Cuevaro-Development": "synthetic-only",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!res.ok) throw Error(data.code ?? "PROCESSING_FAILED");
  return data;
}
export default function App() {
  const dark = useColorScheme() === "dark",
    p = {
      background: dark ? "#14251F" : "#F5F4ED",
      surface: dark ? "#20382D" : "#FFFFFF",
      text: dark ? "#F3F5EF" : "#19382F",
      muted: dark ? "#B7C9BF" : "#526B60",
    };
  const [store, setStore] = useState<LocalStore>(),
    [captures, setCaptures] = useState<Capture[]>([]),
    [records, setRecords] = useState<RecordCache[]>([]),
    [tab, setTab] = useState<"Home" | "Things" | "Timeline">("Home");
  const [capture, setCapture] = useState<Capture>(),
    [draft, setDraft] = useState<Draft>(),
    [values, setValues] = useState<Partial<Record<Field, string | null>>>({}),
    [checked, setChecked] = useState<Set<Field>>(new Set()),
    [itemChoices, setItemChoices] = useState<ItemChoice[]>([]),
    [itemChecked, setItemChecked] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<RecordCache>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [previewPageId, setPreviewPageId] = useState<string>(),
    [development, setDevelopment] = useState(false);
  const [correction, setCorrection] = useState<{
      purchaseId: string;
      command: Correction;
    }>(),
    [historyVisible, setHistoryVisible] = useState(false);
  async function reload(s = store) {
    if (!s) return;
    setCaptures(await s.captures());
    setRecords(await s.records());
  }
  useEffect(() => {
    if (!development) return;
    openStore()
      .then(async (s) => {
        setStore(s);
        await reload(s);
      })
      .catch(() =>
        setError(
          "Secure storage could not open. Use a native SQLCipher development build. Existing evidence has not been deleted.",
        ),
      );
  }, [development]);
  const showDraft = (d: Draft) => {
    setDraft(d);
    setValues(
      Object.fromEntries(d.observations.map((o) => [o.field, o.value])),
    );
    setChecked(new Set());
    setItemChoices(
      d.itemCandidates?.map((c) => ({
        candidateId: c.id,
        name: c.observation.value,
      })) ?? [],
    );
    setItemChecked(new Set());
  };
  async function receive(bytes: Uint8Array, mime: string, uri: string) {
    if (!store) return;
    setError("");
    setMessage("");
    setBusy(true);
    setSelected(undefined);
    setPreview(false);
    setDraft(undefined);
    let preserved = false;
    try {
      const { capture: c, duplicate } = await preserve(bytes, mime, store);
      preserved = true;
      setCapture(c);
      await reload();
      if (duplicate) {
        setMessage(
          "This evidence is already saved. No duplicate purchase was created.",
        );
        if (c.draft && c.state !== "confirmed") showDraft(c.draft);
        return;
      }
      const q = mime === "application/pdf" ? pdfQuality() : await inspect(uri);
      const updated = { ...c, quality: q };
      await store.saveCapture(updated);
      setCapture(updated);
      await reload();
      if (q.grade === "good") await processCapture(updated);
    } catch {
      setError(
        "Could not finish reading this capture. Any original already saved is retained. Try again or choose another image.",
      );
    } finally {
      try {
        await cleanupCaptureCache(uri, preserved);
      } catch {
        setError(
          "The original is saved, but temporary capture cleanup failed. Retry on this device before using real documents.",
        );
      }
      setBusy(false);
    }
  }
  async function choose(kind: "camera" | "library" | "pdf") {
    try {
      const asset = await pick(kind);
      if (asset) await receive(asset.bytes, asset.mime, asset.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open capture.");
    }
  }
  async function choosePage(kind: "camera" | "library", replaceIndex?: number) {
    if (!store || !capture) return;
    setBusy(true);
    setError("");
    let uri: string | undefined,
      preserved = false;
    try {
      const asset = await pick(kind);
      if (!asset) return;
      uri = asset.uri;
      const result = await preserve(asset.bytes, asset.mime, store);
      preserved = true;
      if (
        result.capture.id === capture.id ||
        (capture.pageIds ?? []).includes(result.capture.id)
      )
        throw Error("This page is already included. Choose a different page.");
      if (
        result.capture.state === "confirmed" ||
        result.capture.assemblySealed ||
        result.capture.serverId ||
        result.capture.draft ||
        result.capture.pageIds ||
        (result.capture.groupParentId &&
          result.capture.groupParentId !== capture.id)
      )
        throw Error("PHOTO_PAGES_ONLY");
      const page = { ...result.capture, quality: await inspect(asset.uri) };
      await store.saveCapture(page);
      const changes = await assemblePage(
        capture,
        page,
        await store.captures(),
        (text) =>
          Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
        replaceIndex,
      );
      await store.saveCaptures(changes);
      setCapture(changes[0]);
      setDraft(undefined);
      setPreview(false);
      setPreviewPageId(undefined);
      setMessage(
        "Page original saved. Add every page of this receipt before continuing; review each page's quality.",
      );
      await reload();
    } catch (e) {
      const labels: Record<string, string> = {
        LOCAL_STORAGE_FULL:
          "Local storage could not finish the page attachment. Any originals already saved remain available.",
        INVALID_PAGE_BUNDLE:
          "Use up to 10 different receipt photos, totaling at most 20 MB.",
        PHOTO_PAGES_ONLY:
          "Choose a separate photo of this receipt. Already linked records cannot be attached as a new page.",
        ASSEMBLY_ALREADY_SEALED:
          "Processing has started. These originals are retained; start a new receipt capture for changes.",
        MISSING_PAGE_ORIGINAL:
          "A page original is unavailable on this device. Restore it before processing.",
        PAGE_QUALITY_REQUIRED:
          "A page has not been checked. Its saved original is retained.",
      };
      setError(
        e instanceof Error
          ? (labels[e.message] ?? e.message)
          : "Could not attach the page. Any saved original is retained.",
      );
      await reload();
    } finally {
      if (uri)
        try {
          await cleanupCaptureCache(uri, preserved);
        } catch {
          setError("Original retained; temporary capture cleanup failed.");
        }
      setBusy(false);
    }
  }
  async function sample() {
    setBusy(true);
    try {
      const res = await fetch(api + "/v1/fixture", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw Error();
      const blob = await res.blob(),
        uri = URL.createObjectURL(blob);
      try {
        await receive(
          new Uint8Array(await blob.arrayBuffer()),
          "image/png",
          uri,
        );
      } finally {
        URL.revokeObjectURL(uri);
      }
    } catch {
      setError(
        "Start the local development API to load the synthetic receipt.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function processCapture(c: Capture) {
    if (!store || !c.quality || !mayExtract(c.quality, !!c.useAnyway)) return;
    setBusy(true);
    setError("");
    let pending = c;
    let unsupportedPdf = false;
    try {
      pending = { ...c, assemblySealed: true };
      await store.saveCapture({ ...pending, state: "local_pending" });
      setCapture(pending);
      const originals = capturePages(c, await store.captures());
      const ack = await request("/v1/captures", {
        clientId: c.id,
        base64: bytes64(originals[0].bytes),
        ...(originals.length > 1
          ? { additionalPages: originals.slice(1).map((p) => bytes64(p.bytes)) }
          : {}),
        useAnyway: !!c.useAnyway,
      });
      if (!ack.durable || ack.hash !== c.hash) throw Error("INVALID_ACK");
      pending = { ...pending, serverId: ack.id };
      await store.saveCapture(pending);
      setCapture(pending);
      setMessage(
        "Original stored in the local development database. Local OCR is processing; this is not cloud backup.",
      );
      for (let attempt = 0; attempt < 45; attempt++) {
        const result = await request(`/v1/captures/${ack.id}`);
        if (result.draft) {
          const ready = {
            ...pending,
            state: "review_ready" as const,
            draft: result.draft,
          };
          await store.saveCapture(ready);
          setCapture(ready);
          showDraft(result.draft);
          setMessage(
            "Review what the evidence supports. OCR never confirms a deadline for you.",
          );
          await reload();
          return;
        }
        if (result.state === "failed") {
          const advice: Record<string, string> = {
            PDF_PASSWORD_REQUIRED:
              "This PDF needs a password. Choose an unlocked copy or review manually; do not send passwords here.",
            PDF_NO_TEXT:
              "No embedded text was found. Scanned PDF OCR is not enabled. Choose receipt photos or review manually.",
            PDF_PAGE_LIMIT:
              "This PDF exceeds the 10-page extraction limit. Choose a shorter document or review manually.",
            PDF_TEXT_LIMIT:
              "This PDF exceeds the extraction text limit. Choose a shorter document or review manually.",
            PDF_INVALID:
              "This PDF could not be parsed. The original is retained. Choose another copy or review manually.",
          };
          if (advice[result.errorCode]) {
            unsupportedPdf = true;
            setMessage(advice[result.errorCode]);
          }
          throw Error("EXTRACTION_FAILED");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw Error("PROCESSING_PENDING");
    } catch {
      await store.saveCapture({ ...pending, state: "failed" });
      setCapture({ ...pending, state: "failed" });
      await reload();
      setError(
        unsupportedPdf
          ? "Automatic extraction cannot process this PDF. The original is retained. Choose another document or review manually."
          : "Processing is unavailable or pending. The original is safe on this device. Retry after reconnecting, or review manually.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function useAnyway() {
    if (!capture || !store) return;
    const next = { ...capture, useAnyway: true };
    await store.saveCapture(next);
    setCapture(next);
    await processCapture(next);
  }
  function manualReview() {
    if (!capture?.quality || !mayExtract(capture.quality, !!capture.useAnyway))
      return;
    showDraft(
      extractText(
        "",
        capture.id,
        "questionable",
        new Date().toISOString().slice(0, 10),
      ),
    );
    setMessage(
      "Manual fallback: enter only verified facts. Missing dates stay Unknown.",
    );
  }
  async function save() {
    if (!draft || !capture || !store) return;
    setBusy(true);
    setError("");
    try {
      if (
        fields.some(
          (f) => consequential.has(f) && values[f] != null && !checked.has(f),
        )
      )
        throw Error("Confirm each consequential value or choose Keep unknown.");
      let record: RecordCache;
      const reviewedItems = reviewItems(
        draft,
        draft.itemCandidates ? itemChoices : undefined,
        values.item ?? null,
        Crypto.randomUUID,
      );
      if (draft.itemCandidates?.some((c) => !itemChecked.has(c.id)))
        throw Error("Confirm or skip each item before saving.");
      if (capture.serverId && draft.provider !== "local-text-parser") {
        try {
          record = await request(
            `/v1/captures/${capture.serverId}/confirm`,
            draft.itemCandidates ? { values, itemChoices } : values,
          );
        } catch (e) {
          const saved: RecordCache[] = await request("/v1/records");
          const existing = saved.find(
            (r) =>
              r.captureId === capture.serverId &&
              r.facts.every((f) => f.value === values[f.field]) &&
              (!draft.itemCandidates ||
                (r.items?.length === reviewedItems.length &&
                  reviewedItems.every((i) =>
                    r.items?.some(
                      (saved) =>
                        saved.candidateId === i.candidateId &&
                        saved.name === i.name,
                    ),
                  ))),
          );
          if (!existing) throw e;
          record = existing;
        }
      } else {
        const now = new Date().toISOString(),
          id = Crypto.randomUUID(),
          facts = confirm(
            draft,
            values,
            "local-development-user",
            now,
            Crypto.randomUUID,
          );
        record = {
          id,
          captureId: capture.id,
          facts,
          items: reviewedItems,
          history: facts,
          itemHistory: initialItemFacts(
            reviewedItems,
            "local-development-user",
            now,
          ),
          ...derive(facts, "Asia/Manila", id),
          createdAt: now,
          version: 1,
        };
      }
      if (capture.serverId && draft.provider !== "local-text-parser")
        record = {
          ...record,
          serverCaptureId: record.captureId,
          captureId: capture.id,
        };
      await store.saveRecord(record, { ...capture, state: "confirmed", draft });
      await reload();
      setSelected(record);
      setCapture(undefined);
      setDraft(undefined);
      setMessage("Purchase saved. Cues are in-app only; push is not enabled.");
      setTab("Things");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Evidence remains on this device.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeCue(record: RecordCache, command: AttentionCommand) {
    if (!store) return;
    setBusy(true);
    setError("");
    try {
      if (record.pendingCorrection)
        throw Error("Resolve the queued correction before changing reminders.");
      const original = captures.find((c) => c.id === record.captureId);
      if (!original)
        throw Error("Original evidence is unavailable on this device.");
      let recovered = false;
      let applied = true;
      let updated: RecordCache;
      if (record.serverCaptureId) {
        try {
          updated = {
            ...record,
            ...(await request(`/v1/purchases/${record.id}/attention`, {
              version: record.version,
              command,
            })),
          };
        } catch {
          // A mutation may have committed before its response was lost. Refresh
          // authoritative state, never repeat a stale version or assume success.
          const records: RecordCache[] = await request("/v1/records");
          const latest = records.find(
            (r) => r.id === record.id && r.captureId === record.serverCaptureId,
          );
          if (!latest || latest.version < record.version)
            throw Error("RECOVERY_UNAVAILABLE");
          updated = {
            ...record,
            ...latest,
            captureId: record.captureId,
            serverCaptureId: record.serverCaptureId,
          };
          recovered = true;
          applied =
            command.type === "stop"
              ? latest.events.some(
                  (e) =>
                    e.kind === command.kind && e.status === "not_applicable",
                )
              : latest.cues.some(
                  (c) =>
                    c.id === command.cueId &&
                    (command.type === "dismiss"
                      ? c.state === "dismissed"
                      : c.state === "scheduled" &&
                        c.scheduledFor === command.date),
                );
        }
      } else
        updated = updateAttention(
          record,
          command,
          record.version,
          new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
        );
      await store.saveRecord(updated, original);
      await reload();
      if (selected?.id === record.id) setSelected(updated);
      setMessage(
        recovered && !applied
          ? "Current reminder state recovered. Review it before trying your change again."
          : "Reminder updated. Purchase and original evidence kept.",
      );
    } catch {
      setError(
        "Could not update this reminder. It remains saved; try again after reconnecting.",
      );
    } finally {
      setBusy(false);
    }
  }
  function startCorrection(record: RecordCache, field: Field, itemId?: string) {
    if (record.pendingCorrection) return;
    const value = itemId
      ? record.items?.find((i) => i.id === itemId)?.name
      : record.facts.find((f) => f.field === field)?.value;
    setCorrection({
      purchaseId: record.id,
      command: {
        mutationId: Crypto.randomUUID(),
        version: record.version,
        field,
        value: value ?? null,
        ...(itemId ? { itemId } : {}),
      },
    });
  }
  async function applyCorrection(record: RecordCache, command: Correction) {
    if (!store) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const original = captures.find((c) => c.id === record.captureId);
      if (!original) throw Error("Original unavailable.");
      if (
        record.pendingCorrection &&
        record.pendingCorrection.mutationId !== command.mutationId
      )
        throw Error("Resolve the existing queued correction first.");
      let updated: RecordCache;
      if (record.serverCaptureId) {
        const pending = { ...record, pendingCorrection: command };
        await store.saveRecord(pending, original);
        await reload();
        if (selected?.id === record.id) setSelected(pending);
        const result = await request(
          `/v1/purchases/${record.id}/corrections`,
          command,
        );
        if (result.appliedMutationId !== command.mutationId)
          throw Error("CORRECTION_ACK_MISMATCH");
        updated = {
          ...record,
          ...result,
          captureId: record.captureId,
          serverCaptureId: record.serverCaptureId,
          pendingCorrection: undefined,
        };
      } else
        updated = correctRecord(
          record,
          command,
          "local-development-user",
          new Date().toISOString(),
          Crypto.randomUUID,
        );
      await store.saveRecord(updated, original);
      await reload();
      if (selected?.id === record.id) setSelected(updated);
      setCorrection(undefined);
      setMessage(
        "Correction saved with history. Supported reminder dates updated; stopped reminders stay stopped.",
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === "STATE_CONFLICT"
          ? "Saved facts changed elsewhere. Refresh and review before correcting again. Your queued correction is retained."
          : "Correction is not confirmed. Any queued draft is safe on this device; retry after reconnecting. Saved facts and original evidence are retained.",
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }
  async function discardQueuedCorrection(record: RecordCache) {
    if (!store || !record.serverCaptureId) return;
    setBusy(true);
    setError("");
    try {
      const latest: RecordCache[] = await request("/v1/records"),
        saved = latest.find(
          (r) => r.id === record.id && r.captureId === record.serverCaptureId,
        ),
        original = captures.find((c) => c.id === record.captureId);
      if (!saved || !original) throw Error("RECOVERY_UNAVAILABLE");
      const updated = {
        ...record,
        ...saved,
        captureId: record.captureId,
        serverCaptureId: record.serverCaptureId,
        pendingCorrection: undefined,
      };
      await store.saveRecord(updated, original);
      await reload();
      setSelected(updated);
      setCorrection(undefined);
      setMessage(
        "Current facts refreshed. Queued draft cleared; previously committed changes remain in history.",
      );
    } catch {
      setError(
        "Could not refresh saved facts. The queued correction is retained.",
      );
    } finally {
      setBusy(false);
    }
  }
  const Button = ({
    label,
    onPress,
    primary = false,
    disabled = false,
  }: {
    label: string;
    onPress: () => void;
    primary?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        primary ? styles.primary : { borderColor: p.muted },
        (disabled || busy) && { opacity: 0.45 },
      ]}
    >
      <Text
        style={{
          color: primary ? "#FFFFFF" : p.text,
          fontWeight: "600",
          fontSize: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  const title = (s: string) => (
    <Text accessibilityRole="header" style={[styles.title, { color: p.text }]}>
      {s}
    </Text>
  );
  const text = (s: string) => (
    <Text style={[styles.body, { color: p.muted }]}>{s}</Text>
  );
  const card = (children: React.ReactNode) => (
    <View style={[styles.card, { backgroundColor: p.surface }]}>
      {children}
    </View>
  );
  const originalRoot =
    capture ?? captures.find((c) => c.id === selected?.captureId);
  const pageIds =
    originalRoot?.pageIds ?? (originalRoot ? [originalRoot.id] : []);
  const allowedPreviewIds = [
    ...pageIds,
    ...(originalRoot?.retiredPageIds ?? []),
  ];
  const chosenPageId =
    previewPageId && allowedPreviewIds.includes(previewPageId)
      ? previewPageId
      : pageIds[0];
  const original =
      chosenPageId === originalRoot?.id
        ? originalRoot
        : captures.find((c) => c.id === chosenPageId),
    evidenceUri = original?.mime.startsWith("image/")
      ? `data:${original.mime};base64,${bytes64(original.bytes)}`
      : undefined;
  const filtered = records.filter(
    (r) =>
      r.facts.some((f) =>
        f.value?.toLowerCase().includes(search.toLowerCase()),
      ) ||
      r.items?.some((i) => i.name.toLowerCase().includes(search.toLowerCase())),
  );
  const cues = records.flatMap((r) =>
    r.cues
      .filter((c) => c.state === "scheduled" || c.state === "delivered")
      .map((c) => ({ ...c, record: r })),
  );
  const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    }),
    tomorrowDate = new Date(`${today}T00:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  if (!development)
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: p.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.brand, { color: p.text }]}>{copy.brand}</Text>
          {title(copy.promise)}
          {text(copy.synthetic)}
          {card(
            <>
              {title("A private place for the important stuff")}
              {text(
                "The first slice is under development. Use generated receipts only. No real account or external processing is connected.",
              )}
              <Button
                label="Open synthetic development preview"
                primary
                onPress={() => setDevelopment(true)}
              />
            </>,
          )}
        </ScrollView>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: p.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.brand, { color: p.text }]}>{copy.brand}</Text>
          <Text style={[styles.badge, { color: p.muted }]}>DEVELOPMENT</Text>
        </View>
        {text(copy.synthetic)}
        <View style={styles.row}>
          {(["Home", "Things", "Timeline"] as const).map((t) => (
            <Button
              key={t}
              label={t}
              primary={tab === t}
              onPress={() => {
                setTab(t);
                setHistoryVisible(false);
                setCorrection(undefined);
                setCapture(undefined);
                setDraft(undefined);
                setSelected(undefined);
                setPreview(false);
              }}
            />
          ))}
        </View>
        {message ? text(message) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {busy ? (
          <View style={styles.row}>
            <ActivityIndicator />
            <Text style={{ color: p.text }}>Working · original retained</Text>
          </View>
        ) : null}
        {!capture &&
          !selected &&
          card(
            <>
              {title(copy.empty)}
              <Button
                label={copy.camera}
                primary
                disabled={!store}
                onPress={() => choose("camera")}
              />
              <View style={styles.row}>
                <Button
                  label={copy.library}
                  disabled={!store}
                  onPress={() => choose("library")}
                />
                <Button
                  label="Choose PDF"
                  disabled={!store}
                  onPress={() => choose("pdf")}
                />
              </View>
              {Platform.OS === "web" ? (
                <Button
                  label="Try synthetic receipt"
                  disabled={!store}
                  onPress={sample}
                />
              ) : null}
            </>,
          )}
        {capture &&
          card(
            <>
              {title(copy.quality)}
              {text(copy.local)}
              {title(
                capture.quality?.grade === "bad"
                  ? "Bad · retake needed"
                  : capture.quality?.grade === "good"
                    ? "Good"
                    : "Questionable · check before continuing",
              )}
              {capture.quality?.findings.map((f, i) => (
                <React.Fragment key={i}>
                  {text(findingLabels[f])}
                </React.Fragment>
              ))}
              {capture.mime === "application/pdf"
                ? text(
                    "PDF text can be extracted in the local development harness. Scanned PDF OCR and native PDF viewing are not enabled. Original retained.",
                  )
                : null}
              {capture.mime === "application/pdf"
                ? capture.quality?.limits.map((limit, i) => (
                    <React.Fragment key={i}>{text(limit)}</React.Fragment>
                  ))
                : null}
              <Button
                label={copy.source}
                onPress={() => setPreview(!preview)}
              />
              {capture.mime.startsWith("image/") ? (
                <>
                  {text(
                    `${pageIds.length} receipt page${pageIds.length === 1 ? "" : "s"}. Add all pages before processing. Originals are retained separately.`,
                  )}
                  {pageIds.map((id, i) => {
                    const page =
                      id === capture.id
                        ? capture
                        : captures.find((c) => c.id === id);
                    const q = page?.originalQuality ?? page?.quality;
                    return (
                      <View key={id}>
                        {text(`Page ${i + 1}: ${q?.grade ?? "Unprocessed"}`)}
                        <Button
                          label={`View page ${i + 1}`}
                          onPress={() => {
                            setPreviewPageId(id);
                            setPreview(true);
                          }}
                        />
                        {!capture.assemblySealed &&
                        !capture.serverId &&
                        !draft ? (
                          <Button
                            label={`Replace page ${i + 1}`}
                            onPress={() => choosePage("library", i)}
                          />
                        ) : null}
                        {!capture.assemblySealed &&
                        !capture.serverId &&
                        !draft &&
                        q?.grade === "bad" ? (
                          <Button
                            label={`Retake page ${i + 1}`}
                            onPress={() => choosePage("camera", i)}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                  {!capture.assemblySealed &&
                  !capture.serverId &&
                  !draft &&
                  pageIds.length < 10 ? (
                    <>
                      <Button
                        label="Take next receipt page"
                        onPress={() => choosePage("camera")}
                      />
                      <Button
                        label="Choose next receipt page"
                        onPress={() => choosePage("library")}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {capture.quality?.grade === "bad" ? (
                <>
                  <Button
                    label={
                      pageIds.length > 1
                        ? "Start a new receipt capture"
                        : copy.retake
                    }
                    primary
                    onPress={() => choose("camera")}
                  />
                  <Button
                    label={
                      pageIds.length > 1
                        ? "Start a new receipt from a photo"
                        : copy.chooseAnother
                    }
                    onPress={() => choose("library")}
                  />
                </>
              ) : !draft ? (
                <>
                  <Button
                    label={
                      capture.useAnyway ? "Retry processing" : copy.useAnyway
                    }
                    primary
                    onPress={
                      capture.useAnyway
                        ? () => processCapture(capture)
                        : useAnyway
                    }
                  />
                  <Button
                    label={copy.retake}
                    onPress={() => choose("camera")}
                  />
                  {capture.useAnyway ? (
                    <Button label="Review manually" onPress={manualReview} />
                  ) : null}
                </>
              ) : null}
            </>,
          )}
        {!capture && originalRoot?.pageIds ? (
          <View>
            {text(`${pageIds.length} saved receipt pages`)}
            {pageIds.map((id, i) => (
              <Button
                key={id}
                label={`View page ${i + 1}`}
                onPress={() => {
                  setPreviewPageId(id);
                  setPreview(true);
                }}
              />
            ))}
          </View>
        ) : null}
        {originalRoot?.retiredPageIds?.length ? (
          <View>
            {text("Earlier page originals retained")}
            {originalRoot.retiredPageIds.map((id, i) => (
              <Button
                key={id}
                label={`View earlier original ${i + 1}`}
                onPress={() => {
                  setPreviewPageId(id);
                  setPreview(true);
                }}
              />
            ))}
          </View>
        ) : null}
        {preview && evidenceUri ? (
          <Image
            accessible
            accessibilityRole={Platform.OS === "web" ? undefined : "image"}
            accessibilityLabel="Original purchase evidence"
            source={{ uri: evidenceUri }}
            style={styles.evidence}
            resizeMode="contain"
          />
        ) : null}
        {preview && original?.mime === "application/pdf" ? (
          <View>
            {text("Original PDF retained. This app does not render PDF pages.")}
            {Platform.OS === "web" ? (
              <Button
                label="Download original PDF"
                onPress={() => {
                  const blob = new Blob([new Uint8Array(original.bytes)], {
                    type: "application/pdf",
                  });
                  const uri = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = uri;
                  anchor.download = "cuevaro-original.pdf";
                  anchor.click();
                  setTimeout(() => URL.revokeObjectURL(uri), 5000);
                }}
              />
            ) : (
              text(
                "Native PDF viewing is not connected in this development build.",
              )
            )}
          </View>
        ) : null}
        {draft &&
          card(
            <>
              {title("Check these facts")}
              {text(
                "Correct what is uncertain. Unsupported return or warranty dates stay Unknown. No retailer policy is assumed.",
              )}
              {draft.itemCandidates ? (
                <>
                  {title("Items to track")}
                  {text(
                    "Confirm or skip each labeled item. Repeated names may be duplicate evidence. Receipt-level dates do not prove coverage for every item.",
                  )}
                  {draft.itemCandidates.map((candidate, i) => (
                    <View key={candidate.id} style={styles.fact}>
                      {text(
                        `Item ${i + 1} — ${itemChecked.has(candidate.id) ? "Reviewed" : "Needs review"}`,
                      )}
                      <TextInput
                        accessibilityLabel={`Item ${i + 1} name`}
                        value={
                          itemChoices.find(
                            (c) => c.candidateId === candidate.id,
                          )?.name ?? ""
                        }
                        onChangeText={(name) => {
                          setItemChoices(
                            itemChoices.map((c) =>
                              c.candidateId === candidate.id
                                ? { ...c, name: name.trim() ? name : null }
                                : c,
                            ),
                          );
                          setItemChecked(
                            new Set(
                              [...itemChecked].filter(
                                (id) => id !== candidate.id,
                              ),
                            ),
                          );
                        }}
                        style={[
                          styles.input,
                          { color: p.text, borderColor: p.muted },
                        ]}
                      />
                      {text(
                        `Receipt${candidate.observation.pages?.length ? ` (page ${candidate.observation.pages.join(", ")})` : ""}: "${candidate.observation.excerpt}" — low confidence`,
                      )}
                      <View style={styles.row}>
                        <Button
                          label={`Track item ${i + 1}`}
                          disabled={
                            !itemChoices.find(
                              (c) => c.candidateId === candidate.id,
                            )?.name
                          }
                          onPress={() =>
                            setItemChecked(
                              new Set([...itemChecked, candidate.id]),
                            )
                          }
                        />
                        <Button
                          label={`Skip item ${i + 1}`}
                          onPress={() => {
                            setItemChoices(
                              itemChoices.map((c) =>
                                c.candidateId === candidate.id
                                  ? { ...c, name: null }
                                  : c,
                              ),
                            );
                            setItemChecked(
                              new Set([...itemChecked, candidate.id]),
                            );
                          }}
                        />
                      </View>
                    </View>
                  ))}
                </>
              ) : null}
              {draft.observations
                .filter((o) => !draft.itemCandidates || o.field !== "item")
                .map((o) => (
                  <View key={o.field} style={styles.fact}>
                    <Text style={[styles.subtitle, { color: p.text }]}>
                      {labels[o.field]} ·{" "}
                      {values[o.field] === null
                        ? "Unknown"
                        : checked.has(o.field)
                          ? "Reviewed"
                          : "Needs review"}
                    </Text>
                    <TextInput
                      accessibilityLabel={labels[o.field]}
                      placeholder={copy.unknown}
                      placeholderTextColor={p.muted}
                      value={values[o.field] ?? ""}
                      onChangeText={(v) => {
                        setValues({
                          ...values,
                          [o.field]: v.trim() ? v : null,
                        });
                        const c = new Set(checked);
                        c.delete(o.field);
                        setChecked(c);
                      }}
                      style={[
                        styles.input,
                        { color: p.text, borderColor: p.muted },
                      ]}
                      keyboardType={
                        o.field === "total" ? "decimal-pad" : "default"
                      }
                    />
                    {text(
                      o.excerpt
                        ? `Receipt${o.pages?.length ? ` (${originalRoot?.mime === "application/pdf" ? "PDF " : ""}page ${o.pages.join(", ")})` : ""}: "${o.excerpt}"`
                        : "No supporting text found.",
                    )}
                    {text(
                      `Extraction confidence: ${o.confidence}. ${o.reason === "missing" ? "Not found in evidence." : o.reason === "ambiguous_or_invalid_date" ? "Date is ambiguous or invalid; keep unknown unless verified." : "Verify this value against the original."}`,
                    )}
                    {consequential.has(o.field) ? (
                      <View style={styles.row}>
                        <Button
                          label={
                            o.field === "warrantyDate"
                              ? "Track warranty"
                              : `Confirm ${labels[o.field].toLowerCase()}`
                          }
                          disabled={!values[o.field]}
                          onPress={() =>
                            setChecked(new Set([...checked, o.field]))
                          }
                        />
                        <Button
                          label={
                            o.field === "warrantyDate"
                              ? "Don't track warranty"
                              : "Keep unknown"
                          }
                          onPress={() => {
                            setValues({ ...values, [o.field]: null });
                            setChecked(new Set([...checked, o.field]));
                          }}
                        />
                      </View>
                    ) : null}
                  </View>
                ))}
              <Button label={copy.save} primary onPress={save} />
            </>,
          )}
        {selected &&
          card(
            <>
              {title(
                selected.facts.find((f) => f.field === "item")?.value ??
                  "Purchase",
              )}
              {text(copy.local)}
              {selected.items?.length ? (
                <>
                  {title("Tracked items")}
                  {selected.items.map((item, i) => (
                    <View key={item.id}>
                      {text(item.name)}
                      {text(
                        `${item.authority === "user_entered" ? "Corrected by you" : "Confirmed by you"} - ${item.observation.excerpt}`,
                      )}
                      <Button
                        label={`Correct tracked item ${i + 1}`}
                        disabled={!!selected.pendingCorrection}
                        onPress={() =>
                          startCorrection(selected, "item", item.id)
                        }
                      />
                    </View>
                  ))}
                  {text(
                    "Dates below belong to this receipt. Item-specific warranty coverage remains unverified.",
                  )}
                </>
              ) : null}
              {selected.facts
                .filter((f) => f.field !== "item" || !selected.items?.length)
                .map((f) => (
                  <View key={f.id} style={styles.fact}>
                    <Text style={[styles.subtitle, { color: p.text }]}>
                      {labels[f.field]}
                    </Text>
                    {text(f.value ?? "Unknown")}
                    {text(
                      f.value
                        ? `${f.authority === "user_entered" ? "Entered by you" : "Confirmed by you"} · ${f.observation.excerpt || "Manual review"}`
                        : "No supported value",
                    )}
                    <Button
                      label={`Correct ${labels[f.field].toLowerCase()}`}
                      disabled={!!selected.pendingCorrection}
                      onPress={() => startCorrection(selected, f.field)}
                    />
                  </View>
                ))}
              {selected.pendingCorrection ? (
                <View>
                  {title("Correction waiting to sync")}
                  {text(
                    `${labels[selected.pendingCorrection.field]} draft: ${selected.pendingCorrection.value ?? "Unknown"}. Showing last confirmed facts; the queued value is not yet confirmed on this device.`,
                  )}
                  <Button
                    label="Retry queued correction"
                    primary
                    onPress={() =>
                      applyCorrection(selected, selected.pendingCorrection!)
                    }
                  />
                  <Button
                    label="Discard queued correction & refresh facts"
                    onPress={() => discardQueuedCorrection(selected)}
                  />
                </View>
              ) : correction?.purchaseId === selected.id ? (
                <View>
                  {title(
                    `Correct ${labels[correction.command.field].toLowerCase()}`,
                  )}
                  {text(
                    "The original observation and earlier confirmed values stay in history. Only supported dates create cues; stopped reminders stay stopped.",
                  )}
                  <TextInput
                    accessibilityLabel="Corrected value"
                    value={correction.command.value ?? ""}
                    onChangeText={(value) =>
                      setCorrection({
                        ...correction,
                        command: {
                          ...correction.command,
                          value: value.trim() ? value : null,
                        },
                      })
                    }
                    placeholder="Unknown"
                    placeholderTextColor={p.muted}
                    style={[
                      styles.input,
                      { color: p.text, borderColor: p.muted },
                    ]}
                  />
                  {!correction.command.itemId ? (
                    <Button
                      label="Set corrected fact to Unknown"
                      onPress={() =>
                        setCorrection({
                          ...correction,
                          command: { ...correction.command, value: null },
                        })
                      }
                    />
                  ) : null}
                  <Button
                    label="Save correction & update reminders"
                    primary
                    onPress={() =>
                      applyCorrection(selected, correction.command)
                    }
                    disabled={
                      correction.command.itemId
                        ? correction.command.value ===
                            selected.items?.find(
                              (i) => i.id === correction.command.itemId,
                            )?.name || !correction.command.value
                        : correction.command.value ===
                          selected.facts.find(
                            (f) => f.field === correction.command.field,
                          )?.value
                    }
                  />
                  <Button
                    label="Cancel correction draft"
                    onPress={() => setCorrection(undefined)}
                  />
                </View>
              ) : null}
              <Button
                label={
                  historyVisible
                    ? "Hide correction history"
                    : "View correction history"
                }
                onPress={() => setHistoryVisible(!historyVisible)}
              />
              {historyVisible ? (
                <View>
                  {title("Correction history")}
                  {[
                    ...(selected.history ?? selected.facts),
                    ...(selected.itemHistory ?? []),
                  ]
                    .filter(
                      (f) =>
                        f.supersedesId ||
                        [
                          ...(selected.history ?? []),
                          ...(selected.itemHistory ?? []),
                        ].some((n) => n.supersedesId === f.id),
                    )
                    .map((f) => (
                      <View key={f.id}>
                        {text(
                          `${labels[f.field]}: ${f.value ?? "Unknown"} — ${[...selected.facts, ...(selected.items ?? []).map((i) => ({ id: i.factId }))].some((n) => n.id === f.id) ? "Current" : "Earlier"}`,
                        )}
                        {text(
                          `${f.authority === "user_entered" ? "Entered by you" : "Confirmed by you"} · ${new Date(f.confirmedAt).toLocaleString()}`,
                        )}
                        {text(
                          `Original source: ${f.observation.excerpt || "Manual review; no extracted support"}`,
                        )}
                      </View>
                    ))}
                </View>
              ) : null}
              {title("What Cuevaro is watching")}
              {selected.events.map((e) => (
                <View key={e.kind}>
                  {text(
                    `${e.kind === "return" ? "Return deadline" : "Warranty ends"}: ${e.dueDate ?? "Unknown"} · ${e.timezone}${e.status === "not_applicable" ? " · Reminders stopped" : ""}`,
                  )}
                </View>
              ))}
              {text(
                "In-app cue dates: " +
                  (selected.cues
                    .filter((c) => ["scheduled", "delivered"].includes(c.state))
                    .map((c) => c.scheduledFor)
                    .join(", ") || "None — no dates invented"),
              )}
              <Button
                label={copy.source}
                onPress={() => setPreview(!preview)}
              />
              <Button
                label="Back to Things"
                onPress={() => setSelected(undefined)}
              />
            </>,
          )}
        {!capture && !selected && tab === "Home" && (
          <>
            {title(
              cues.some((c) => c.scheduledFor <= today)
                ? "Needs attention"
                : copy.quiet,
            )}
            {text("Push delivery is not enabled.")}
            {records
              .filter((r) => r.pendingCorrection)
              .map((r) => (
                <View key={r.id}>
                  {text("A saved correction is waiting to sync.")}
                  <Button
                    label="Review queued correction"
                    onPress={() => {
                      setSelected(r);
                      setTab("Things");
                      setCorrection(undefined);
                    }}
                  />
                </View>
              ))}
            {cues
              .filter((c) => c.scheduledFor <= today)
              .map((c) => (
                <View key={c.id}>
                  {card(
                    <>
                      {title(
                        `${c.kind === "return" ? "Return window" : "Warranty"} needs attention`,
                      )}
                      {text(
                        `Deadline ${c.dueDate} · ${c.record.facts.find((f) => f.field === "item")?.value ?? "Purchase"}`,
                      )}
                      <Button
                        label="View purchase & evidence"
                        onPress={() => setSelected(c.record)}
                      />
                    </>,
                  )}
                </View>
              ))}
            {title("Pending captures")}
            {captures
              .filter((c) => c.state !== "confirmed")
              .filter(
                (c) =>
                  !c.groupParentId ||
                  !captures.some((root) =>
                    [
                      ...(root.pageIds ?? []),
                      ...(root.retiredPageIds ?? []),
                    ].includes(c.id),
                  ),
              )
              .map((c) => (
                <View key={c.id}>
                  {card(
                    <>
                      {text(
                        `${c.quality?.grade ?? "Unprocessed"} · ${copy.local}`,
                      )}
                      <Button
                        label="Resume saved capture"
                        onPress={() => {
                          setCapture(c);
                          setPreview(false);
                          setSelected(undefined);
                          if (c.draft) showDraft(c.draft);
                        }}
                      />
                    </>,
                  )}
                </View>
              ))}
          </>
        )}
        {!capture && !selected && tab === "Things" && (
          <>
            {title("Your things")}
            <TextInput
              accessibilityLabel="Search saved purchases"
              placeholder="Search item, merchant or date"
              placeholderTextColor={p.muted}
              value={search}
              onChangeText={setSearch}
              style={[styles.input, { color: p.text, borderColor: p.muted }]}
            />
            {filtered.map((r) => (
              <View key={r.id}>
                {card(
                  <>
                    {title(
                      r.facts.find((f) => f.field === "item")?.value ??
                        "Purchase",
                    )}
                    {text(
                      r.facts.find((f) => f.field === "merchant")?.value ??
                        "Merchant unknown",
                    )}
                    <Button
                      label="Open saved purchase"
                      onPress={() => {
                        setSelected(r);
                        setPreview(false);
                      }}
                    />
                  </>,
                )}
              </View>
            ))}
          </>
        )}
        {!capture && !selected && tab === "Timeline" && (
          <>
            {title("Coming soon")}
            {text(
              "Calendar dates use Asia/Manila. No background push is enabled.",
            )}
            {cues
              .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
              .map((c) => (
                <View key={c.id}>
                  {card(
                    <>
                      {title(
                        `${c.kind === "return" ? "Return window" : "Warranty"} reminder`,
                      )}
                      {text(`${c.scheduledFor} · deadline ${c.dueDate}`)}
                      {text(
                        c.record.facts.find((f) => f.field === "item")?.value ??
                          "Purchase",
                      )}
                      <Button
                        label="View purchase & evidence"
                        onPress={() => setSelected(c.record)}
                      />
                      <Button
                        label="Dismiss this reminder"
                        onPress={() =>
                          changeCue(c.record, { type: "dismiss", cueId: c.id })
                        }
                      />
                      <Button
                        label="Remind tomorrow"
                        disabled={tomorrow > c.dueDate}
                        onPress={() =>
                          changeCue(c.record, {
                            type: "snooze",
                            cueId: c.id,
                            date: tomorrow,
                          })
                        }
                      />
                      <Button
                        label={
                          c.kind === "return"
                            ? "Stop return reminders"
                            : "Stop warranty reminders"
                        }
                        onPress={() =>
                          changeCue(c.record, { type: "stop", kind: c.kind })
                        }
                      />
                    </>,
                  )}
                </View>
              ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 20,
    gap: 20,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { fontSize: 26, fontWeight: "700" },
  badge: { fontSize: 11, letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: "600", lineHeight: 36 },
  subtitle: { fontSize: 17, fontWeight: "600", lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 23 },
  card: { padding: 20, borderRadius: 20, gap: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: "#28664E", borderColor: "#28664E" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 17,
    minHeight: 50,
  },
  fact: {
    gap: 9,
    paddingVertical: 10,
    borderBottomColor: "#95A99E",
    borderBottomWidth: 1,
  },
  error: { color: "#A53322", fontSize: 16, lineHeight: 24 },
  evidence: { width: "100%", height: 480 },
});
