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
import { pick, preserve, inspect } from "./capture";
import { copy } from "./strings";
import {
  extractText,
  confirm,
  derive,
  fields,
  type Field,
  type Draft,
} from "../../packages/domain/purchase";
import { mayExtract } from "../../packages/domain/quality";
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
  occlusion: "Part of the receipt is covered.",
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
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<RecordCache>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false),
    [development, setDevelopment] = useState(false);
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
  };
  async function receive(bytes: Uint8Array, mime: string, uri: string) {
    if (!store) return;
    setError("");
    setMessage("");
    setBusy(true);
    setSelected(undefined);
    setPreview(false);
    setDraft(undefined);
    try {
      const { capture: c, duplicate } = await preserve(bytes, mime, store);
      setCapture(c);
      await reload();
      if (duplicate) {
        setMessage(
          "This evidence is already saved. No duplicate purchase was created.",
        );
        if (c.draft && c.state !== "confirmed") showDraft(c.draft);
        return;
      }
      const q =
        mime === "application/pdf"
          ? {
              grade: "questionable" as const,
              findings: [],
              version: "quality-v1" as const,
              limits: [
                "PDF rendering and OCR are not implemented. Preserve it and review manually.",
              ],
            }
          : await inspect(uri);
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
    try {
      await store.saveCapture({ ...c, state: "local_pending" });
      if (c.mime === "application/pdf") {
        setMessage("PDF OCR is not enabled. Enter only facts you can verify.");
        showDraft(
          extractText(
            "",
            c.id,
            "questionable",
            new Date().toISOString().slice(0, 10),
          ),
        );
        return;
      }
      const ack = await request("/v1/captures", {
        clientId: c.id,
        base64: bytes64(c.bytes),
        useAnyway: !!c.useAnyway,
      });
      if (!ack.durable || ack.hash !== c.hash) throw Error("INVALID_ACK");
      const pending = { ...c, serverId: ack.id };
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
        if (result.state === "failed") throw Error("EXTRACTION_FAILED");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      throw Error("PROCESSING_PENDING");
    } catch {
      await store.saveCapture({ ...c, state: "failed" });
      setCapture({ ...c, state: "failed" });
      await reload();
      setError(
        "Processing is unavailable or pending. The original is safe on this device. Retry after reconnecting, or review manually.",
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
      if (capture.serverId && draft.provider !== "local-text-parser") {
        try {
          record = await request(
            `/v1/captures/${capture.serverId}/confirm`,
            values,
          );
        } catch (e) {
          const saved: RecordCache[] = await request("/v1/records");
          const existing = saved.find(
            (r) =>
              r.captureId === capture.serverId &&
              r.facts.every((f) => f.value === values[f.field]),
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
          ...derive(facts, "Asia/Manila", id),
          createdAt: now,
          version: 1,
        };
      }
      if (capture.serverId)
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
      const original = captures.find((c) => c.id === record.captureId);
      if (!original)
        throw Error("Original evidence is unavailable on this device.");
      const updated = record.serverCaptureId
        ? {
            ...record,
            ...(await request(`/v1/purchases/${record.id}/attention`, {
              version: record.version,
              command,
            })),
          }
        : updateAttention(
            record,
            command,
            record.version,
            new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }),
          );
      await store.saveRecord(updated, original);
      await reload();
      if (selected?.id === record.id) setSelected(updated);
      setMessage("Reminder updated. Purchase and original evidence kept.");
    } catch {
      setError(
        "Could not update this reminder. It remains saved; try again after reconnecting.",
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
  const original =
      capture ?? captures.find((c) => c.id === selected?.captureId),
    evidenceUri = original?.mime.startsWith("image/")
      ? `data:${original.mime};base64,${bytes64(original.bytes)}`
      : undefined;
  const filtered = records.filter((r) =>
    r.facts.some((f) => f.value?.toLowerCase().includes(search.toLowerCase())),
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
                    "PDF OCR is not enabled. Original retained for manual review.",
                  )
                : null}
              <Button
                label={copy.source}
                onPress={() => setPreview(!preview)}
              />
              {capture.quality?.grade === "bad" ? (
                <>
                  <Button
                    label={copy.retake}
                    primary
                    onPress={() => choose("camera")}
                  />
                  <Button
                    label={copy.chooseAnother}
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
        {draft &&
          card(
            <>
              {title("Check these facts")}
              {text(
                "Correct what is uncertain. Unsupported return or warranty dates stay Unknown. No retailer policy is assumed.",
              )}
              {draft.observations.map((o) => (
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
                      setValues({ ...values, [o.field]: v.trim() ? v : null });
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
                      ? `Receipt: “${o.excerpt}”`
                      : "No supporting text found.",
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
              {selected.facts.map((f) => (
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
                </View>
              ))}
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
                  (selected.cues.map((c) => c.scheduledFor).join(", ") ||
                    "None — no dates invented"),
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
