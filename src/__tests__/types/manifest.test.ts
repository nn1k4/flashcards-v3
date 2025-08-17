import { describe, expect, it } from "vitest";
import { ZManifest, computeManifestInvariants, computeSignature } from "../../types/manifest";

describe("Manifest contracts", () => {
  it("parses valid manifest and respects invariants", () => {
    const manifestJson = {
      batchId: "batch-1",
      source: "A B C",
      createdAt: new Date().toISOString(),
      version: "1.0",
      items: [
        { sid: 0, lv: "A", sig: "", chunkIndex: 0 },
        { sid: 1, lv: "B", sig: "", chunkIndex: 0 },
        { sid: 2, lv: "C", sig: "", chunkIndex: 1 },
      ],
    };
    // дописываем корректные сигнатуры
    manifestJson.items = manifestJson.items.map((it: any) => ({
      ...it,
      sig: computeSignature(it.lv, it.sid),
    }));

    const parsed = ZManifest.parse(manifestJson);
    const inv = computeManifestInvariants(parsed);

    expect(inv.noEmptyItems).toBe(true);
    expect(inv.sidSequential).toBe(true);
    expect(inv.signaturesValid).toBe(true);
    expect(inv.sourceMatches).toBe(true);
  });

  it("rejects invalid manifest (empty lv)", () => {
    const bad = {
      batchId: "b",
      source: " ",
      createdAt: new Date().toISOString(),
      items: [{ sid: 0, lv: "", sig: "x", chunkIndex: 0 }],
    };
    expect(() => ZManifest.parse(bad)).toThrow();
  });
});
