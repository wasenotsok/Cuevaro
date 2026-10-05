import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform, Image } from "react-native";
import jpeg from "jpeg-js";
import { qualityGate } from "../../packages/domain/quality";
import type { Capture, LocalStore } from "./storage";
export async function preserve(
  bytes: Uint8Array,
  mime: string,
  store: LocalStore,
): Promise<{ capture: Capture; duplicate: boolean }> {
  if (
    !["image/jpeg", "image/png", "application/pdf"].includes(mime) ||
    bytes.length < 1 ||
    bytes.length > 20000000
  )
    throw Error("Choose a JPEG, PNG or PDF under 20 MB.");
  const hash = Array.from(
    new Uint8Array(
      await Crypto.digest(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bytes as Uint8Array<ArrayBuffer>,
      ),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
  const existing = (await store.captures()).find((c) => c.hash === hash);
  if (existing) return { capture: existing, duplicate: true };
  const capture: Capture = {
    id: Crypto.randomUUID(),
    hash,
    mime,
    bytes,
    createdAt: new Date().toISOString(),
    state: "local_pending",
  };
  await store.saveCapture(capture); // Durable local original BEFORE decoding, quality or network.
  return { capture, duplicate: false };
}
export async function pick(
  kind: "camera" | "library" | "pdf",
): Promise<{ bytes: Uint8Array; mime: string; uri: string } | null> {
  let uri: string, mime: string;
  if (kind === "pdf") {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    uri = result.assets[0].uri;
    mime = result.assets[0].mimeType ?? "application/pdf";
  } else {
    if (
      kind === "camera" &&
      !(await ImagePicker.requestCameraPermissionsAsync()).granted
    )
      throw Error("Camera access is off. Choose a photo instead.");
    const result =
      kind === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 1,
            mediaTypes: ["images"],
          });
    if (result.canceled) return null;
    uri = result.assets[0].uri;
    mime = result.assets[0].mimeType ?? "image/jpeg";
  }
  const bytes =
    Platform.OS === "web"
      ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
      : await new File(uri).bytes();
  return { bytes, mime, uri };
}
export async function inspect(uri: string) {
  const sourceWidth = await new Promise<number>((resolve, reject) =>
    Image.getSize(uri, (w) => resolve(w), reject),
  );
  const image = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: Math.min(900, sourceWidth) } }],
    { format: ImageManipulator.SaveFormat.JPEG, base64: true, compress: 0.9 },
  );
  const data = Uint8Array.from(atob(image.base64!), (c) => c.charCodeAt(0));
  const decoded = jpeg.decode(data, { useTArray: true, maxResolutionInMP: 10 });
  const luminance = new Uint8Array(decoded.width * decoded.height);
  for (let i = 0; i < luminance.length; i++)
    luminance[i] = Math.round(
      0.299 * decoded.data[i * 4] +
        0.587 * decoded.data[i * 4 + 1] +
        0.114 * decoded.data[i * 4 + 2],
    );
  // Original dimensions/readability must be evaluated, not upscaled pixels.
  return qualityGate({
    width: decoded.width,
    height: decoded.height,
    luminance,
  });
}
