import {
  DOMParser,
  type Document,
  type Element,
  type Node,
} from "@xmldom/xmldom";
import { z } from "zod";
import { AnalysisOutputError } from "../analysisErrorCore.js";
import type { AnalysisError } from "../analysisErrorBase.js";
import { androidResultSchemas } from "../android/androidAnalysis.js";
import {
  INSPECT_ANALYSIS_VIEW_OPERATION,
  analysisViewInputError,
} from "./analysisViewErrors.js";
import { err, ok, type Result } from "../result.js";
import { parseAnalysisViewResult } from "./analysisViewParent.js";
import type {
  AnalysisViewParent,
  AnalysisViewRequest,
  UnsignedAnalysisView,
} from "./analysisView.js";
import {
  completeWithinViewCoverage,
  pageViewCoverage,
} from "./analysisViewCoverage.js";
import { analysisTextPage } from "./analysisViewText.js";

const packageSchema = androidResultSchemas.inspect_android_package;
const ANDROID_NAMESPACE = "http://schemas.android.com/apk/res/android";

/** Exact declaration state; omitted and unrecognized values are not inferred. */
export const androidManifestAttributeDeclarationSchema = z.strictObject({
  state: z.enum(["true", "false", "omitted", "unrecognized"]),
  raw_value: z.string().nullable(),
});

/** All package declarations remain inline; decoded manifest text stays retained. */
export const androidPackageSummarySchema = packageSchema.extend({
  manifest: packageSchema.shape.manifest.omit({ text: true }).extend({
    text_code_units: z.number().int().nonnegative(),
    text_included: z.literal(false),
  }),
});

/** Exact decoded text; offsets and limits count UTF-16 code units. */
export const androidViewRequestSchema = z.strictObject({
  kind: z.literal("android"),
  facet: z.literal("manifest"),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive(),
});

/** Bounded, typed projection of declarations already present in package Evidence. */
export const androidManifestSurfaceViewRequestSchema = z.strictObject({
  kind: z.literal("android-manifest-surface"),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().positive().default(64),
});

const componentKindSchema = z.enum([
  "activity",
  "activity-alias",
  "service",
  "receiver",
  "provider",
]);

const declaredIntentFilterSchema = z.strictObject({
  priority: z.string().nullable(),
  auto_verify: z.string().nullable(),
  actions: z.array(z.string().nullable()),
  categories: z.array(z.string().nullable()),
  unmodeled_children: z.array(z.string()),
  data: z.array(
    z.strictObject({
      mime_type: z.string().nullable(),
      scheme: z.string().nullable(),
      host: z.string().nullable(),
      port: z.string().nullable(),
      path: z.string().nullable(),
      path_prefix: z.string().nullable(),
      path_pattern: z.string().nullable(),
      path_suffix: z.string().nullable(),
      path_advanced_pattern: z.string().nullable(),
      scheme_specific_part: z.string().nullable(),
      scheme_specific_part_prefix: z.string().nullable(),
      scheme_specific_part_pattern: z.string().nullable(),
    }),
  ),
});

const declaredPermissionSchema = z.strictObject({
  declaration: z.enum([
    "uses-permission",
    "uses-permission-sdk-23",
    "uses-permission-sdk-m",
  ]),
  name: z.string().nullable(),
  max_sdk_version: z.string().nullable(),
  uses_permission_flags: z.string().nullable(),
});

const declaredFeatureSchema = z.strictObject({
  name: z.string().nullable(),
  required: androidManifestAttributeDeclarationSchema,
  gl_es_version: z.string().nullable(),
});

export const androidManifestSurfaceComponentSchema = z.strictObject({
  component_type: componentKindSchema,
  declared_name: z.string().nullable(),
  target_activity: z.string().nullable(),
  exported: androidManifestAttributeDeclarationSchema,
  permission: z.string().nullable(),
  read_permission: z.string().nullable(),
  write_permission: z.string().nullable(),
  authorities: z.string().nullable(),
  intent_filter_count: z.number().int().nonnegative(),
  intent_filters: z.array(declaredIntentFilterSchema),
});

const componentCountsSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  activity: z.number().int().nonnegative(),
  activity_alias: z.number().int().nonnegative(),
  service: z.number().int().nonnegative(),
  receiver: z.number().int().nonnegative(),
  provider: z.number().int().nonnegative(),
  explicitly_exported: z.number().int().nonnegative(),
  explicitly_not_exported: z.number().int().nonnegative(),
  exported_omitted: z.number().int().nonnegative(),
  exported_unrecognized: z.number().int().nonnegative(),
});

const applicationFlagsSchema = z.strictObject({
  debuggable: androidManifestAttributeDeclarationSchema,
  allow_backup: androidManifestAttributeDeclarationSchema,
  uses_cleartext_traffic: androidManifestAttributeDeclarationSchema,
  request_legacy_external_storage: androidManifestAttributeDeclarationSchema,
  large_heap: androidManifestAttributeDeclarationSchema,
  allow_audio_playback_capture: androidManifestAttributeDeclarationSchema,
  test_only: androidManifestAttributeDeclarationSchema,
});

export const androidManifestSurfaceItemSchema = z.strictObject({
  package_name: z.string().nullable(),
  manifest_package_name: z.string().nullable(),
  min_sdk: z.string().nullable(),
  manifest_min_sdk: z.string().nullable(),
  target_sdk: z.string().nullable(),
  manifest_target_sdk: z.string().nullable(),
  manifest_source: z.strictObject({
    status: packageSchema.shape.manifest.shape.status,
    reported_total_bytes:
      packageSchema.shape.manifest.shape.reported_total_bytes,
    text_code_units: z.number().int().nonnegative(),
  }),
  application_declared: z.boolean(),
  application_flags: applicationFlagsSchema,
  declared_permissions: z.array(declaredPermissionSchema),
  declared_features: z.array(declaredFeatureSchema),
  component_counts: componentCountsSchema,
  components: z.array(androidManifestSurfaceComponentSchema),
});

export const androidManifestViewItemSchema = z.strictObject({
  text: z.string(),
  unit: z.literal("utf16-code-units"),
  source_status: packageSchema.shape.manifest.shape.status,
  reported_total_bytes: packageSchema.shape.manifest.shape.reported_total_bytes,
});

const attributeDeclaration = (
  element: Element | undefined,
  localName: string,
): z.infer<typeof androidManifestAttributeDeclarationSchema> => {
  const rawValue =
    element !== undefined &&
    element.hasAttributeNS(ANDROID_NAMESPACE, localName)
      ? element.getAttributeNS(ANDROID_NAMESPACE, localName)
      : null;
  const state =
    rawValue === null
      ? "omitted"
      : rawValue === "true" || rawValue === "false"
        ? rawValue
        : "unrecognized";
  return { state, raw_value: rawValue };
};

const androidAttribute = (
  element: Element,
  localName: string,
): string | null =>
  element.hasAttributeNS(ANDROID_NAMESPACE, localName)
    ? element.getAttributeNS(ANDROID_NAMESPACE, localName)
    : null;

const plainAttribute = (element: Element, name: string): string | null =>
  element.hasAttribute(name) ? element.getAttribute(name) : null;

const parseIntentFilter = (filter: Element) => {
  const children = elementChildren(filter);
  const data = children
    .filter((child) => child.nodeName === "data")
    .map((element) => ({
      mime_type: androidAttribute(element, "mimeType"),
      scheme: androidAttribute(element, "scheme"),
      host: androidAttribute(element, "host"),
      port: androidAttribute(element, "port"),
      path: androidAttribute(element, "path"),
      path_prefix: androidAttribute(element, "pathPrefix"),
      path_pattern: androidAttribute(element, "pathPattern"),
      path_suffix: androidAttribute(element, "pathSuffix"),
      path_advanced_pattern: androidAttribute(element, "pathAdvancedPattern"),
      scheme_specific_part: androidAttribute(element, "ssp"),
      scheme_specific_part_prefix: androidAttribute(element, "sspPrefix"),
      scheme_specific_part_pattern: androidAttribute(element, "sspPattern"),
    }));
  return {
    priority: androidAttribute(filter, "priority"),
    auto_verify: androidAttribute(filter, "autoVerify"),
    actions: children
      .filter((child) => child.nodeName === "action")
      .map((element) => androidAttribute(element, "name")),
    categories: children
      .filter((child) => child.nodeName === "category")
      .map((element) => androidAttribute(element, "name")),
    unmodeled_children: children
      .filter(
        (child) =>
          child.nodeName !== "action" &&
          child.nodeName !== "category" &&
          child.nodeName !== "data",
      )
      .map((child) => child.nodeName),
    data,
  };
};

const elementChildren = (node: Node): Element[] => {
  const elements: Element[] = [];
  for (let child = node.firstChild; child !== null; child = child.nextSibling)
    if (child.nodeType === 1) elements.push(child as Element);
  return elements;
};

const malformedManifest = (message: string, cause?: unknown) =>
  err(
    new AnalysisOutputError(
      INSPECT_ANALYSIS_VIEW_OPERATION,
      message,
      cause === undefined ? undefined : { cause },
    ),
  );

const parseManifestSurface = (
  report: z.infer<typeof packageSchema>,
): Result<z.infer<typeof androidManifestSurfaceItemSchema>, AnalysisError> => {
  const parserErrors: string[] = [];
  let document: Document;
  try {
    document = new DOMParser({
      normalizeLineEndings: (source) => source,
      onError: (_level, message) => parserErrors.push(message),
    }).parseFromString(report.manifest.text, "application/xml");
  } catch (cause: unknown) {
    return malformedManifest(
      "The retained Android manifest cannot be parsed as well-formed XML.",
      cause,
    );
  }
  const root = document.documentElement;
  if (parserErrors.length > 0 || root === null || root.nodeName !== "manifest")
    return malformedManifest(
      `The retained Android manifest cannot be parsed as a well-formed <manifest> document${parserErrors[0] === undefined ? "." : `: ${parserErrors[0]}`}`,
    );

  const children = elementChildren(root);
  const applications = children.filter(
    (element) => element.nodeName === "application",
  );
  const sdkElements = children.filter(
    (element) => element.nodeName === "uses-sdk",
  );
  if (
    applications.length > 1 ||
    sdkElements.length > 1 ||
    children.filter((element) => element.nodeName === "uses-permission")
      .length > 1_000 ||
    children.filter((element) => element.nodeName === "uses-feature").length >
      1_000
  )
    return malformedManifest(
      "The retained Android manifest has ambiguous singleton declarations or exceeds the structured permission/feature declaration budget.",
    );

  const application = applications[0];
  const components: z.infer<typeof androidManifestSurfaceComponentSchema>[] =
    [];
  for (const element of application === undefined
    ? []
    : elementChildren(application)) {
    if (
      element.nodeName !== "activity" &&
      element.nodeName !== "activity-alias" &&
      element.nodeName !== "service" &&
      element.nodeName !== "receiver" &&
      element.nodeName !== "provider"
    )
      continue;
    components.push({
      component_type: element.nodeName,
      declared_name: androidAttribute(element, "name"),
      target_activity: androidAttribute(element, "targetActivity"),
      exported: attributeDeclaration(element, "exported"),
      permission: androidAttribute(element, "permission"),
      read_permission: androidAttribute(element, "readPermission"),
      write_permission: androidAttribute(element, "writePermission"),
      authorities: androidAttribute(element, "authorities"),
      intent_filter_count: elementChildren(element).filter(
        (child) => child.nodeName === "intent-filter",
      ).length,
      intent_filters: elementChildren(element)
        .filter((child) => child.nodeName === "intent-filter")
        .map(parseIntentFilter),
    });
  }

  const count = (kind: z.infer<typeof componentKindSchema>) =>
    components.filter((component) => component.component_type === kind).length;
  const componentCounts = {
    total: components.length,
    activity: count("activity"),
    activity_alias: count("activity-alias"),
    service: count("service"),
    receiver: count("receiver"),
    provider: count("provider"),
    explicitly_exported: components.filter(
      (component) => component.exported.state === "true",
    ).length,
    explicitly_not_exported: components.filter(
      (component) => component.exported.state === "false",
    ).length,
    exported_omitted: components.filter(
      (component) => component.exported.state === "omitted",
    ).length,
    exported_unrecognized: components.filter(
      (component) => component.exported.state === "unrecognized",
    ).length,
  };
  const sdk = sdkElements[0];
  return ok(
    androidManifestSurfaceItemSchema.parse({
      package_name: report.package_name,
      manifest_package_name: plainAttribute(root, "package"),
      min_sdk: report.min_sdk,
      manifest_min_sdk:
        sdk === undefined ? null : androidAttribute(sdk, "minSdkVersion"),
      target_sdk: report.target_sdk,
      manifest_target_sdk:
        sdk === undefined ? null : androidAttribute(sdk, "targetSdkVersion"),
      manifest_source: {
        status: report.manifest.status,
        reported_total_bytes: report.manifest.reported_total_bytes,
        text_code_units: report.manifest.text.length,
      },
      application_declared: application !== undefined,
      declared_permissions: children
        .filter(
          (element) =>
            element.nodeName === "uses-permission" ||
            element.nodeName === "uses-permission-sdk-23" ||
            element.nodeName === "uses-permission-sdk-m",
        )
        .map((element) => ({
          declaration: element.nodeName,
          name: androidAttribute(element, "name"),
          max_sdk_version: androidAttribute(element, "maxSdkVersion"),
          uses_permission_flags: androidAttribute(
            element,
            "usesPermissionFlags",
          ),
        })),
      declared_features: children
        .filter((element) => element.nodeName === "uses-feature")
        .map((element) => ({
          name: androidAttribute(element, "name"),
          required: attributeDeclaration(element, "required"),
          gl_es_version: androidAttribute(element, "glEsVersion"),
        })),
      application_flags: {
        debuggable: attributeDeclaration(application, "debuggable"),
        allow_backup: attributeDeclaration(application, "allowBackup"),
        uses_cleartext_traffic: attributeDeclaration(
          application,
          "usesCleartextTraffic",
        ),
        request_legacy_external_storage: attributeDeclaration(
          application,
          "requestLegacyExternalStorage",
        ),
        large_heap: attributeDeclaration(application, "largeHeap"),
        allow_audio_playback_capture: attributeDeclaration(
          application,
          "allowAudioPlaybackCapture",
        ),
        test_only: attributeDeclaration(application, "testOnly"),
      },
      component_counts: componentCounts,
      components,
    }),
  );
};

/** Project an authenticated package record without reopening the APK or engine. */
export const projectAndroidPackageView = (
  parent: AnalysisViewParent,
  view: AnalysisViewRequest,
): Result<UnsignedAnalysisView, AnalysisError> => {
  if (
    view.kind !== "summary" &&
    view.kind !== "android" &&
    view.kind !== "android-manifest-surface"
  )
    return err(
      analysisViewInputError([
        {
          path: ["view"],
          reason: "invalid_value",
          message:
            "Android package Evidence supports summary, manifest-text, and structured manifest-surface views.",
        },
      ]),
    );
  const parsed = parseAnalysisViewResult(packageSchema, parent);
  if (!parsed.ok) return parsed;
  // Engine artifact_sha256 identifies the JAR, never the APK. A missing
  // authenticated APK subject cannot be repaired using the engine identity.
  if (parent.subject == null)
    return err(
      analysisViewInputError([
        {
          path: ["source", "subject"],
          reason: "invalid_value",
          message:
            "Android package views require the recorded APK subject identity.",
        },
      ]),
    );
  const report = parsed.value;
  const shared = {
    parent_evidence_id: parent.evidenceId,
    parent_operation: "inspect_android_package" as const,
    parent_digest: parent.evidenceId.slice(3),
    artifact: {
      path: parent.subject.local_path,
      sha256: parent.subject.digest.sha256,
    },
    limitations: [...parent.limitations],
    unknowns: [
      "APK signatures were not verified; package declarations do not establish authenticity or runtime behavior.",
      ...(report.manifest.status === "partial"
        ? [
            "The decoded manifest is partial; exhausting retained text does not establish complete manifest coverage.",
          ]
        : []),
    ],
  };
  if (view.kind === "summary") {
    const { text, ...manifest } = report.manifest;
    return ok({
      kind: "summary",
      view,
      ...shared,
      summary: {
        ...report,
        manifest: {
          ...manifest,
          text_code_units: text.length,
          text_included: false,
        },
      },
      coverage: completeWithinViewCoverage(1, 1),
    });
  }
  if (view.kind === "android-manifest-surface") {
    const surface = parseManifestSurface(report);
    if (!surface.ok) return surface;
    const item = surface.value;
    const start = Math.min(view.offset, item.components.length);
    const end = Math.min(start + view.limit, item.components.length);
    const components = item.components.slice(start, end);
    const jadxPermissions = [...new Set(report.permissions)].sort();
    const manifestPermissions = [
      ...new Set(
        item.declared_permissions
          .map((permission) => permission.name)
          .filter((permission): permission is string => permission !== null),
      ),
    ].sort();
    const permissionMetadataDiffers =
      report.manifest.status === "complete" &&
      JSON.stringify(jadxPermissions) !== JSON.stringify(manifestPermissions);
    const unknowns = [
      ...shared.unknowns,
      "Component export values report only the literal android:exported declaration; omitted or unrecognized values are not resolved using Android platform defaults.",
      "Intent actions, categories, and data entries are returned as separate literal declarations; Android runtime filter merging, URI resolution, matching behavior, and dispatch are not evaluated.",
      "Manifest declarations do not establish runtime reachability, permission enforcement, exploitability, or application behavior.",
      ...(item.package_name !== null &&
      item.manifest_package_name !== null &&
      item.package_name !== item.manifest_package_name
        ? [
            "JADX package metadata differs from the manifest package attribute; both observed values are retained.",
          ]
        : []),
      ...(item.min_sdk !== null &&
      item.manifest_min_sdk !== null &&
      item.min_sdk !== item.manifest_min_sdk
        ? [
            "JADX min-SDK metadata differs from the manifest uses-sdk declaration; both observed values are retained.",
          ]
        : []),
      ...(item.target_sdk !== null &&
      item.manifest_target_sdk !== null &&
      item.target_sdk !== item.manifest_target_sdk
        ? [
            "JADX target-SDK metadata differs from the manifest uses-sdk declaration; both observed values are retained.",
          ]
        : []),
      ...(permissionMetadataDiffers
        ? [
            "JADX package permission metadata differs from the complete retained manifest declarations; both source records are preserved for follow-up.",
          ]
        : []),
      ...(item.components.some((component) =>
        component.intent_filters.some(
          (filter) => filter.unmodeled_children.length > 0,
        ),
      )
        ? [
            "One or more intent filters contain child elements outside action/category/data; their names are reported, but their routing semantics are not interpreted.",
          ]
        : []),
    ];
    return ok({
      kind: "android-manifest-surface",
      view,
      ...shared,
      unknowns,
      item: { ...item, components },
      coverage: pageViewCoverage(
        view.offset,
        components.length,
        item.components.length,
      ),
    });
  }
  const page = analysisTextPage(
    report.manifest.text,
    view.offset,
    view.limit,
    "Manifest",
  );
  if (!page.ok) return page;
  return ok({
    kind: "android",
    view,
    ...shared,
    item: {
      ...page.value.item,
      source_status: report.manifest.status,
      reported_total_bytes: report.manifest.reported_total_bytes,
    },
    coverage: page.value.coverage,
  });
};
