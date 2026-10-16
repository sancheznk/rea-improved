import { expect, it } from "vitest";
import { createEvidence } from "../evidence.js";
import type { AnalysisViewParent } from "./analysisView.js";
import { projectAnalysisView } from "./analysisView.js";
import { androidManifestSurfaceItemSchema } from "./androidPackageView.js";

const ANDROID = "http://schemas.android.com/apk/res/android";

const packageParent = (
  manifest: string,
  status: "complete" | "partial" = "complete",
  metadata: {
    package_name?: string | null;
    min_sdk?: string | null;
    target_sdk?: string | null;
  } = {},
): AnalysisViewParent => {
  const path = "/fixtures/surface.apk";
  const evidence = createEvidence(
    { path, sha256: "a".repeat(64), format: "apk" },
    { id: "jadx", name: "JADX", version: "0.7.1" },
    {
      operation: "inspect_android_package",
      parameters: { path },
      result: {
        engine: {
          name: "jadx",
          version: "0.7.1",
          artifact_sha256: "b".repeat(64),
          source_revision: null,
          worker_count: 1,
          heap_limit_mib: null,
        },
        package_name: metadata.package_name ?? "com.example",
        version_name: null,
        version_code: null,
        min_sdk: metadata.min_sdk ?? "23",
        target_sdk: metadata.target_sdk ?? "35",
        permissions: [],
        manifest: {
          status,
          text: manifest,
          reported_total_bytes: Buffer.byteLength(manifest, "utf8"),
        },
        class_count: 0,
        resource_count: 0,
        signature_verification: "not_performed",
      },
      limitations: [],
    },
  );
  return {
    evidenceId: evidence.evidence_id,
    operation: evidence.operation,
    normalizedResult: evidence.normalized_result,
    subject: evidence.subject,
    limitations: evidence.limitations,
  };
};

const manifest = `<manifest xmlns:a="${ANDROID}" package="com.example">
  <uses-sdk a:minSdkVersion="23" a:targetSdkVersion="35" />
  <uses-permission a:name="android.permission.INTERNET" a:maxSdkVersion="35" />
  <uses-permission-sdk-23 a:name="android.permission.CAMERA" a:usesPermissionFlags="neverForLocation" />
  <uses-feature a:name="android.hardware.camera" a:required="false" />
  <uses-feature a:glEsVersion="0x00030000" />
  <application a:debuggable="true" a:allowBackup="false" a:usesCleartextTraffic="true" a:requestLegacyExternalStorage="false" a:largeHeap="true" a:allowAudioPlaybackCapture="true" a:testOnly="false">
    <activity a:name=".MainActivity" a:exported="true" a:permission="com.example.OPEN"><intent-filter a:priority="7" a:autoVerify="true"><action a:name="com.example.OPEN" /><action /><category a:name="android.intent.category.DEFAULT" /><data a:scheme="https" a:host="example.com" a:pathPrefix="/open" a:mimeType="text/plain" /><uri-relative-filter-group a:allow="true"><data a:pathSuffix=".html" /></uri-relative-filter-group></intent-filter></activity>
    <activity-alias a:name=".Alias" a:targetActivity=".MainActivity" />
    <service a:name=".SyncService" a:exported="false" />
    <provider a:name=".LegacyProvider" a:authorities="com.example.files" a:readPermission="com.example.READ" a:writePermission="com.example.WRITE" />
    <receiver a:name=".OddReceiver" a:exported="maybe" />
  </application>
</manifest>`;

it("projects exact Android manifest declarations with stable component paging and source identity", () => {
  const parent = packageParent(manifest);
  const result = projectAnalysisView(parent, {
    kind: "android-manifest-surface",
    offset: 2,
    limit: 2,
  });
  if (!result.ok) throw result.error;
  if (result.value.kind !== "android-manifest-surface")
    throw new Error("Unexpected Android view kind");
  expect(
    result.value.item.components.map((component) => component.component_type),
  ).toEqual(["service", "provider"]);
  const fullResult = projectAnalysisView(parent, {
    kind: "android-manifest-surface",
    offset: 0,
    limit: 64,
  });
  if (!fullResult.ok) throw fullResult.error;
  if (fullResult.value.kind !== "android-manifest-surface")
    throw new Error("Unexpected Android view kind");
  const parsed = androidManifestSurfaceItemSchema.parse(fullResult.value.item);
  expect(result.value).toMatchObject({
    kind: "android-manifest-surface",
    parent_operation: "inspect_android_package",
    artifact: { path: "/fixtures/surface.apk", sha256: "a".repeat(64) },
    coverage: { status: "page", examined: 2, total: 5, next_offset: 4 },
  });
  expect(parsed).toMatchObject({
    package_name: "com.example",
    manifest_package_name: "com.example",
    min_sdk: "23",
    manifest_min_sdk: "23",
    target_sdk: "35",
    manifest_target_sdk: "35",
    application_declared: true,
    component_counts: {
      total: 5,
      activity: 1,
      activity_alias: 1,
      service: 1,
      provider: 1,
      receiver: 1,
      explicitly_exported: 1,
      explicitly_not_exported: 1,
      exported_omitted: 2,
      exported_unrecognized: 1,
    },
    declared_permissions: [
      {
        declaration: "uses-permission",
        name: "android.permission.INTERNET",
        max_sdk_version: "35",
        uses_permission_flags: null,
      },
      {
        declaration: "uses-permission-sdk-23",
        name: "android.permission.CAMERA",
        max_sdk_version: null,
        uses_permission_flags: "neverForLocation",
      },
    ],
    declared_features: [
      {
        name: "android.hardware.camera",
        required: { state: "false", raw_value: "false" },
        gl_es_version: null,
      },
      {
        name: null,
        required: { state: "omitted", raw_value: null },
        gl_es_version: "0x00030000",
      },
    ],
  });
  expect(parsed.application_flags).toMatchObject({
    debuggable: { state: "true", raw_value: "true" },
    allow_backup: { state: "false", raw_value: "false" },
    uses_cleartext_traffic: { state: "true", raw_value: "true" },
    request_legacy_external_storage: { state: "false", raw_value: "false" },
    large_heap: { state: "true", raw_value: "true" },
    allow_audio_playback_capture: { state: "true", raw_value: "true" },
    test_only: { state: "false", raw_value: "false" },
  });
  expect(result.value.item.components[0]).toMatchObject({
    declared_name: ".SyncService",
    exported: { state: "false", raw_value: "false" },
    intent_filter_count: 0,
  });
  expect(result.value.unknowns.join(" ")).toContain(
    "JADX package permission metadata differs",
  );
  expect(
    parsed.components.find(
      (component) => component.component_type === "provider",
    ),
  ).toMatchObject({ authorities: "com.example.files" });
  expect(
    parsed.components.find(
      (component) => component.component_type === "activity",
    )?.intent_filters,
  ).toEqual([
    {
      priority: "7",
      auto_verify: "true",
      actions: ["com.example.OPEN", null],
      categories: ["android.intent.category.DEFAULT"],
      unmodeled_children: ["uri-relative-filter-group"],
      data: [
        {
          mime_type: "text/plain",
          scheme: "https",
          host: "example.com",
          port: null,
          path: null,
          path_prefix: "/open",
          path_pattern: null,
          path_suffix: null,
          path_advanced_pattern: null,
          scheme_specific_part: null,
          scheme_specific_part_prefix: null,
          scheme_specific_part_pattern: null,
        },
      ],
    },
  ]);
  expect(
    parsed.components.find(
      (component) => component.component_type === "activity-alias",
    ),
  ).toMatchObject({
    declared_name: ".Alias",
    target_activity: ".MainActivity",
  });
  expect(result.value.unknowns.join(" ")).toContain("platform defaults");
  expect(result.value.unknowns.join(" ")).toContain("runtime reachability");
  expect(result.value.unknowns.join(" ")).toContain(
    "outside action/category/data",
  );
});

it("preserves partial source coverage and reports mismatched metadata without reconciling it", () => {
  const parent = packageParent(manifest, "partial", {
    package_name: "other.package",
    min_sdk: "21",
    target_sdk: "34",
  });
  const result = projectAnalysisView(parent, {
    kind: "android-manifest-surface",
    offset: 0,
    limit: 64,
  });
  if (!result.ok) throw result.error;
  if (result.value.kind !== "android-manifest-surface")
    throw new Error("Unexpected Android view kind");
  const parsed = androidManifestSurfaceItemSchema.parse(result.value.item);
  expect(parsed.manifest_source.status).toBe("partial");
  expect(parsed.package_name).toBe("other.package");
  expect(parsed.manifest_package_name).toBe("com.example");
  expect(parsed.target_sdk).toBe("34");
  expect(parsed.manifest_target_sdk).toBe("35");
  expect(result.value.unknowns.join(" ")).toContain("manifest is partial");
  expect(result.value.unknowns.join(" ")).toContain("package metadata differs");
  expect(result.value.unknowns.join(" ")).toContain(
    "target-SDK metadata differs",
  );
});

it("fails closed on malformed retained manifest XML instead of reporting an empty surface", () => {
  const parent = packageParent(`<manifest package="com.example"><application>`);
  expect(
    projectAnalysisView(parent, {
      kind: "android-manifest-surface",
      offset: 0,
      limit: 64,
    }),
  ).toMatchObject({ ok: false, error: { _tag: "AnalysisOutputError" } });
});
