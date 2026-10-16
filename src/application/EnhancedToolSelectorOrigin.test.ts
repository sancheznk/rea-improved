import { describe, expect, it } from "vitest";
import {
  createAnalysisExecution,
  type AnalysisOperation,
  type AnalysisOperationPort,
} from "./AnalysisProvider.js";
import {
  AnalysisCancelledError,
  AnalysisInputError,
  AnalysisProtocolError,
} from "../domain/analysisErrorCore.js";
import type { JsonValue } from "../domain/jsonValue.js";
import { err, ok } from "../domain/result.js";
import { EnhancedTools } from "./EnhancedTools.js";

const provider = { id: "fixture", name: "Fixture", version: "1" };

interface RecordedCall {
  readonly operation: AnalysisOperation;
  readonly procedure: unknown;
  readonly origin: unknown;
}

/** Port that knows `main` (0x1000, calling 0x2000) and rejects `nosuch`. */
const recordingPort = () => {
  const calls: RecordedCall[] = [];
  const sentParameters: Readonly<Record<string, JsonValue>>[] = [];
  const port: AnalysisOperationPort = {
    execute: async (operation, parameters, options) => {
      sentParameters.push(parameters);
      calls.push({
        operation,
        procedure: parameters.procedure,
        origin: options?.selectorOrigin,
      });
      const known = (value: JsonValue) =>
        ok(createAnalysisExecution(value, provider));
      if (parameters.procedure === "nosuch")
        return err(new AnalysisInputError(operation));
      switch (operation) {
        case "procedure_address":
          return known(parameters.procedure === "main" ? "0x1000" : "0x2000");
        case "procedure_callees":
          return known(parameters.procedure === "0x1000" ? ["0x2000"] : []);
        case "procedure_pseudo_code":
          return known("int main(void) { return 0; }");
        case "address_name":
          return known("main");
        default:
          throw new Error(`Unexpected operation: ${operation}`);
      }
    },
  };
  return { calls, sentParameters, tools: new EnhancedTools(port) };
};

const of = (
  calls: readonly RecordedCall[],
  operation: AnalysisOperation,
): RecordedCall[] => calls.filter((call) => call.operation === operation);

describe("selector origin of composed workflows", () => {
  it("marks every call-graph expansion as provider-derived and the root selector as caller-supplied", async () => {
    const { calls, tools } = recordingPort();

    const result = await tools.execute("get_call_graph", { address: "main" });

    expect(result.ok, "the graph is built").toBe(true);
    expect(
      of(calls, "procedure_address"),
      "the caller's selector carries no provider origin",
    ).toEqual([
      { operation: "procedure_address", procedure: "main", origin: undefined },
    ]);
    expect(
      of(calls, "procedure_callees"),
      "the canonical start and every discovered callee are provider-derived",
    ).toEqual([
      {
        operation: "procedure_callees",
        procedure: "0x1000",
        origin: "provider",
      },
      {
        operation: "procedure_callees",
        procedure: "0x2000",
        origin: "provider",
      },
    ]);
  });

  it("marks trace expansions as provider-derived and the start and goal as caller-supplied", async () => {
    const { calls, tools } = recordingPort();

    const result = await tools.execute("trace_call_path", {
      start: "main",
      goal: "0x2000",
    });

    expect(result.ok, "the trace completes").toBe(true);
    expect(
      of(calls, "procedure_address").map(({ origin }) => origin),
      "start and goal resolutions are caller-supplied",
    ).toEqual([undefined, undefined]);
    expect(
      of(calls, "procedure_callees").map(({ origin }) => origin),
      "expansion of the resolved start is provider-derived",
    ).toEqual(["provider"]);
  });

  it("marks the canonical retry of batch_decompile as derived and keeps the unresolved fallback caller-supplied", async () => {
    const { calls, tools } = recordingPort();

    const result = await tools.execute("batch_decompile", {
      addresses: ["main", "nosuch"],
    });

    expect(result.ok, "per-item failures do not fail the batch").toBe(true);
    expect(
      of(calls, "procedure_pseudo_code")
        .map(({ procedure, origin }) => [procedure, origin])
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
      "the resolved canonical address is derived; the failed item keeps the caller's text",
    ).toEqual([
      ["0x1000", "provider"],
      ["nosuch", undefined],
    ]);
  });

  it("bounds batch_decompile provider work and preserves item order and provenance", async () => {
    const addresses = Array.from(
      { length: 11 },
      (_, index) => `selector-${index}`,
    );
    const active = new Map<AnalysisOperation, number>();
    const peak = new Map<AnalysisOperation, number>();
    const pseudocodeOrigins: unknown[] = [];
    const tools = new EnhancedTools({
      execute: async (operation, parameters, options) => {
        const current = (active.get(operation) ?? 0) + 1;
        active.set(operation, current);
        peak.set(operation, Math.max(peak.get(operation) ?? 0, current));
        if (operation === "procedure_pseudo_code")
          pseudocodeOrigins.push(options?.selectorOrigin);
        try {
          await new Promise<void>((resolve) => setImmediate(resolve));
          const selectorIndex = Number(
            String(parameters.procedure).replace("selector-", ""),
          );
          const address =
            operation === "procedure_address"
              ? `0x${(0x1000 + selectorIndex).toString(16)}`
              : String(parameters.address ?? parameters.procedure);
          const value =
            operation === "procedure_address"
              ? address
              : operation === "address_name"
                ? `name-${Number(address) - 0x1000}`
                : operation === "procedure_pseudo_code"
                  ? `pseudocode-${address}`
                  : undefined;
          if (value === undefined)
            throw new Error(`Unexpected operation: ${operation}`);
          return ok(createAnalysisExecution(value, provider));
        } finally {
          active.set(operation, (active.get(operation) ?? 1) - 1);
        }
      },
    });

    const result = await tools.execute("batch_decompile", { addresses });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      items: addresses.map((address, index) => {
        const canonical = `0x${(0x1000 + index).toString(16)}`;
        return {
          address,
          procedure: {
            status: "resolved",
            address: canonical,
            name: `name-${index}`,
          },
          status: "ok",
          pseudocode: `pseudocode-${canonical}`,
        };
      }),
      total: addresses.length,
      succeeded: addresses.length,
      failed: 0,
    });
    for (const operation of [
      "procedure_address",
      "address_name",
      "procedure_pseudo_code",
    ] as const)
      expect(peak.get(operation), `${operation} peak concurrency`).toBe(4);
    expect(pseudocodeOrigins).toEqual(addresses.map(() => "provider"));
  });

  it("never copies the origin into the parameters sent to the provider", async () => {
    const { sentParameters, tools } = recordingPort();

    await tools.execute("get_call_graph", { address: "main" });
    await tools.execute("trace_call_path", { start: "main" });
    await tools.execute("batch_decompile", { addresses: ["main"] });

    expect(
      sentParameters.length,
      "workflows issued provider calls",
    ).toBeGreaterThan(0);
    expect(
      sentParameters.some((parameters) => "selectorOrigin" in parameters),
      "the origin travels in the options only, never in Evidence-bound parameters",
    ).toBe(false);
  });
});

describe("batch_decompile cancellation admission", () => {
  it("stops admitting selectors after a provider cancellation while active calls settle", async () => {
    const addresses = Array.from(
      { length: 12 },
      (_, index) => `selector-${index}`,
    );
    const started: string[] = [];
    let admitFirstFour!: () => void;
    let releaseCancellation!: () => void;
    let releasePeers!: () => void;
    const firstFourAdmitted = new Promise<void>((resolve) => {
      admitFirstFour = resolve;
    });
    const cancellationGate = new Promise<void>((resolve) => {
      releaseCancellation = resolve;
    });
    const peerGate = new Promise<void>((resolve) => {
      releasePeers = resolve;
    });
    const tools = new EnhancedTools({
      execute: async (operation, parameters) => {
        if (operation !== "procedure_address")
          throw new Error(`Unexpected operation: ${operation}`);
        const selector = String(parameters.procedure);
        started.push(selector);
        if (started.length === 4) admitFirstFour();
        if (selector === addresses[0]) {
          await cancellationGate;
          return err(new AnalysisCancelledError(operation));
        }
        await peerGate;
        return ok(createAnalysisExecution(selector, provider));
      },
    });

    const pending = tools.execute("batch_decompile", { addresses });
    await firstFourAdmitted;
    releaseCancellation();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(started).toEqual(addresses.slice(0, 4));
    releasePeers();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AnalysisCancelledError);
    expect(started).toEqual(addresses.slice(0, 4));
  });

  it("stops admitting selectors when the caller aborts", async () => {
    const addresses = Array.from(
      { length: 12 },
      (_, index) => `selector-${index}`,
    );
    const started: string[] = [];
    let admitFirstFour!: () => void;
    let releasePeers!: () => void;
    const firstFourAdmitted = new Promise<void>((resolve) => {
      admitFirstFour = resolve;
    });
    const peerGate = new Promise<void>((resolve) => {
      releasePeers = resolve;
    });
    const controller = new AbortController();
    const tools = new EnhancedTools({
      execute: async (operation, parameters) => {
        if (operation !== "procedure_address")
          throw new Error(`Unexpected operation: ${operation}`);
        started.push(String(parameters.procedure));
        if (started.length === 4) admitFirstFour();
        await peerGate;
        return ok(
          createAnalysisExecution(String(parameters.procedure), provider),
        );
      },
    });

    const pending = tools.execute(
      "batch_decompile",
      { addresses },
      controller.signal,
    );
    await firstFourAdmitted;
    controller.abort();
    releasePeers();

    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(AnalysisCancelledError);
    expect(started).toEqual(addresses.slice(0, 4));
  });
});

describe("trace path completion and cancellation", () => {
  it("keeps an unreachable goal unknown when provider coverage is unresolved", async () => {
    const tools = new EnhancedTools({
      execute: async (operation, parameters) => {
        if (operation === "procedure_address")
          return ok(createAnalysisExecution(parameters.procedure, provider));
        if (operation === "procedure_callees")
          return ok(
            createAnalysisExecution([], provider, {
              relationshipCoverage: {
                status: "unknown",
                reason: "the provider cannot confirm graph coverage",
              },
            }),
          );
        throw new Error(`Unexpected operation: ${operation}`);
      },
    });

    const result = await tools.execute("trace_call_path", {
      start: "0x1000",
      goal: "0x2000",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { goal_status: "unknown", truncated: true },
    });
  });

  it.each([
    { abortSignal: false, errorKind: "cancelled" },
    { abortSignal: true, errorKind: "cancelled" },
    { abortSignal: true, errorKind: "protocol" },
  ])(
    "preserves provider $errorKind failure and cleanup with request abort: $abortSignal",
    async ({ abortSignal, errorKind }) => {
      const cleanup = {
        reason: "provider cleanup is still pending",
        resources: ["provider session"],
      };
      const providerFailure =
        errorKind === "cancelled"
          ? new AnalysisCancelledError("procedure_callees", { cleanup })
          : new AnalysisProtocolError("provider relationship read failed", {
              cleanup,
            });
      const controller = new AbortController();
      const tools = new EnhancedTools({
        execute: async (operation, parameters) => {
          if (operation === "procedure_address")
            return ok(createAnalysisExecution(parameters.procedure, provider));
          if (operation === "procedure_callees") {
            if (abortSignal) controller.abort();
            return err(providerFailure);
          }
          throw new Error(`Unexpected operation: ${operation}`);
        },
      });

      const result = await tools.execute(
        "trace_call_path",
        { start: "0x1000", goal: "0x2000" },
        abortSignal ? controller.signal : undefined,
      );

      expect(result).toMatchObject({
        ok: false,
        error: {
          _tag:
            errorKind === "cancelled"
              ? "AnalysisCancelledError"
              : "AnalysisProtocolError",
          cleanup,
        },
      });
      if (result.ok) throw new Error("expected provider failure");
      expect(result.error).toBe(providerFailure);
    },
  );

  it("stops after cancellation races with a successful relationship response", async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    const tools = new EnhancedTools({
      execute: async (operation, parameters) => {
        calls.push(operation);
        if (operation === "procedure_address")
          return ok(createAnalysisExecution(parameters.procedure, provider));
        if (operation === "procedure_callees") {
          controller.abort();
          return ok(createAnalysisExecution(["0x2000"], provider));
        }
        throw new Error(`Unexpected operation: ${operation}`);
      },
    });

    const result = await tools.execute(
      "trace_call_path",
      { start: "0x1000", goal: "0x3000" },
      controller.signal,
    );

    expect(calls).toEqual([
      "procedure_address",
      "procedure_address",
      "procedure_callees",
    ]);
    expect(result).toMatchObject({
      ok: false,
      error: { _tag: "AnalysisCancelledError" },
    });
  });
});
