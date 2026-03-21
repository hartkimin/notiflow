import { createClient } from "@/lib/supabase/server";
import { getInvoice } from "@/lib/queries/invoices";
import { generateInvoicePdf } from "@/lib/tax-invoice/pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const invoiceId = parseInt(id, 10);

  if (isNaN(invoiceId)) {
    return Response.json(
      { error: "유효하지 않은 세금계산서 ID입니다." },
      { status: 400 }
    );
  }

  try {
    const invoice = await getInvoice(invoiceId);
    const pdfBytes = await generateInvoicePdf(invoice);

    // Sanitize filename — allow only alphanumeric, hyphen, underscore
    const safeName = invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Response(pdfBytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeName}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch {
    return Response.json(
      { error: "세금계산서를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
}
