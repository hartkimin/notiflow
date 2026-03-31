import { describe, it, expect } from "vitest";

// Import the guard helper we will extract in step 6:
import { assertOrderNotAlreadyInvoiced } from "../service";

// Mock shape matches the query in assertOrderNotAlreadyInvoiced:
// supabase.from().select().eq().maybeSingle()
function makeMock(data: unknown) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data, error: null }),
        }),
      }),
    }),
  };
}

describe("assertOrderNotAlreadyInvoiced", () => {
  it("resolves without error when no linked invoice exists", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(makeMock(null) as never, 42),
    ).resolves.toBeUndefined();
  });

  it("resolves when the linked invoice is cancelled", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 7, tax_invoices: { status: "cancelled" } }) as never,
        42,
      ),
    ).resolves.toBeUndefined();
  });

  it("throws when an active (issued) invoice already exists for the order", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 7, tax_invoices: { status: "issued" } }) as never,
        42,
      ),
    ).rejects.toThrow("이미 발행된 세금계산서가 있습니다");
  });

  it("throws when a draft invoice is linked (draft is also active)", async () => {
    await expect(
      assertOrderNotAlreadyInvoiced(
        makeMock({ invoice_id: 3, tax_invoices: { status: "draft" } }) as never,
        42,
      ),
    ).rejects.toThrow("이미 발행된 세금계산서가 있습니다");
  });
});
