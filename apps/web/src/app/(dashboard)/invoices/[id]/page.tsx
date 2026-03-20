import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/queries/invoices";
import InvoiceDetailClient from "@/components/invoice-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const invoiceId = Number(id);
  if (isNaN(invoiceId)) notFound();

  try {
    const invoice = await getInvoice(invoiceId);
    return <InvoiceDetailClient invoice={invoice} />;
  } catch {
    notFound();
  }
}
