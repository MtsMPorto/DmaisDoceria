import { useMemo, useState } from "react";
import { ClipboardList, ExternalLink, Plus, RotateCcw, Search } from "lucide-react";
import { useProducts } from "@/contexts/ProductsContext";
import { CUSTOMERS_KEY, QUOTES_KEY, SALES_KEY } from "@/config/constants";
import { genCustomerCode } from "@/lib/customers";
import { getSPNow, getSPToday } from "@/lib/dates";
import { calcTotals, genQuoteCode } from "@/lib/quotes";
import { loadLS, saveLS } from "@/lib/storage";
import type { Customer, PaymentMethod, Quote, QuoteStatus, Sale } from "@/types";
import { ConvertModal } from "@/components/admin/quotes/ConvertModal";
import { QuoteCard } from "@/components/admin/quotes/QuoteCard";
import { QuoteFormModal, type QuoteFormState } from "@/components/admin/quotes/QuoteFormModal";
import { WhatsAppModal } from "@/components/admin/quotes/WhatsAppModal";

export default function AdminQuotes() {
  const { products } = useProducts();

  const [quotes, setQuotes] = useState<Quote[]>(() => loadLS(QUOTES_KEY, []));
  const [customers, setCustomers] = useState<Customer[]>(() => loadLS(CUSTOMERS_KEY, []));

  const [formOpen, setFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [whatsappQuote, setWhatsappQuote] = useState<Quote | null>(null);
  const [convertQuote, setConvertQuote] = useState<Quote | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | QuoteStatus>("all");
  const [dateFilter, setDateFilter] = useState("");

  function persist(updated: Quote[]) {
    setQuotes(updated);
    saveLS(QUOTES_KEY, updated);
  }

  function persistCustomers(updated: Customer[]) {
    setCustomers(updated);
    saveLS(CUSTOMERS_KEY, updated);
  }

  // Filtered + sorted quotes
  const displayed = useMemo(() => {
    return [...quotes]
      .filter(q => {
        if (statusFilter !== "all" && q.status !== statusFilter) return false;
        if (dateFilter && !q.createdAt.startsWith(dateFilter)) return false;
        if (search) {
          const s = search.toLowerCase();
          return q.customerName.toLowerCase().includes(s) || q.code.toLowerCase().includes(s);
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [quotes, statusFilter, dateFilter, search]);

  function openNew() {
    setEditingQuote(null);
    setFormOpen(true);
  }

  function openEdit(q: Quote) {
    setEditingQuote(q);
    setFormOpen(true);
  }

  function handleSave(form: QuoteFormState, editing: Quote | null): string | null {
    let finalCustomerId = form.customerId;
    let finalCustomerName = form.customerName;
    let finalCustomerPhone = form.customerPhone;

    // Create new customer if needed
    if (form.isNewCustomer) {
      const newCust: Customer = {
        id: crypto.randomUUID(),
        code: genCustomerCode(customers),
        personType: "fisica",
        name: form.newName.trim(),
        phone: form.newPhone.trim(),
        createdAt: getSPNow(),
      };
      const updated = [...customers, newCust];
      persistCustomers(updated);
      finalCustomerId = newCust.id;
      finalCustomerName = newCust.name;
      finalCustomerPhone = newCust.phone;
    }

    const { subtotal, discountAmount, total } = calcTotals(
      form.items, form.discountType, form.discountValue, form.deliveryFee
    );

    if (editing) {
      // Update existing
      const newStatus: QuoteStatus = form.markNotClosed && editing.status === "em_aberto"
        ? "nao_fechado"
        : editing.status === "nao_fechado" && !form.markNotClosed
        ? "em_aberto" // allow reopening by unchecking
        : editing.status;

      const updated = quotes.map(q =>
        q.id !== editing.id ? q : {
          ...q,
          customerId: finalCustomerId,
          customerName: finalCustomerName,
          customerPhone: finalCustomerPhone,
          items: form.items,
          subtotal, discountType: form.discountType,
          discountValue: form.discountValue, discountAmount,
          deliveryFee: form.deliveryFee, total,
          validity: form.validity, deliveryDate: form.deliveryDate,
          paymentTerms: form.paymentTerms, customerNotes: form.customerNotes,
          internalNotes: form.internalNotes,
          status: newStatus,
          closedReason: form.closedReason,
          closedAt: newStatus !== "em_aberto" && !q.closedAt ? getSPNow() : q.closedAt,
        }
      );
      persist(updated);
    } else {
      // Create new
      const newQuote: Quote = {
        id: crypto.randomUUID(),
        code: genQuoteCode(quotes),
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        customerPhone: finalCustomerPhone,
        items: form.items,
        subtotal, discountType: form.discountType,
        discountValue: form.discountValue, discountAmount,
        deliveryFee: form.deliveryFee, total,
        validity: form.validity, deliveryDate: form.deliveryDate,
        paymentTerms: form.paymentTerms, customerNotes: form.customerNotes,
        internalNotes: form.internalNotes,
        status: "em_aberto",
        closedReason: "", closedAt: "", convertedSaleId: "",
        createdAt: getSPNow(),
      };
      persist([...quotes, newQuote]);
    }
    setFormOpen(false);
    return null;
  }

  function handleDuplicate(q: Quote) {
    const newQuote: Quote = {
      ...q,
      id: crypto.randomUUID(),
      code: genQuoteCode(quotes),
      status: "em_aberto",
      closedReason: "", closedAt: "", convertedSaleId: "",
      createdAt: getSPNow(),
    };
    persist([...quotes, newQuote]);
    setFormOpen(false);
    // Open the duplicate for editing
    setTimeout(() => { setEditingQuote(newQuote); setFormOpen(true); }, 50);
  }

  function handleDelete(id: string) {
    persist(quotes.filter(q => q.id !== id));
  }

  function handleReopen(q: Quote) {
    persist(quotes.map(x => x.id !== q.id ? x : { ...x, status: "em_aberto", closedAt: "", closedReason: "" }));
  }

  function handleConvertConfirm(paymentMethod: PaymentMethod) {
    if (!convertQuote) return;
    if (convertQuote.convertedSaleId) { setConvertQuote(null); return; }

    const sales: Sale[] = loadLS(SALES_KEY, []);
    const newSale: Sale = {
      id: crypto.randomUUID(),
      customerId: convertQuote.customerId,
      date: getSPToday(),
      items: convertQuote.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        productBrand: i.productBrand,
        productUnit: i.productUnit,
        unitPrice: i.unitPrice,
        qty: i.qty,
        subtotal: i.subtotal,
      })),
      discount: convertQuote.discountAmount,
      deliveryFee: convertQuote.deliveryFee,
      subtotal: convertQuote.subtotal,
      total: convertQuote.total,
      paymentMethod,
      paymentStatus: "pendente",
      saleStatus: "em_andamento",
      notes: [convertQuote.internalNotes, convertQuote.customerNotes].filter(Boolean).join(" | ") || undefined,
      createdAt: getSPNow(),
      quoteId: convertQuote.id,
    };
    saveLS(SALES_KEY, [...sales, newSale]);

    // Update quote status
    persist(quotes.map(q =>
      q.id !== convertQuote.id ? q : {
        ...q, status: "fechado", convertedSaleId: newSale.id, closedAt: getSPNow(),
      }
    ));

    setConvertQuote(null);
    setFormOpen(false);
  }

  const productList = products.map(p => ({ id: p.id, name: p.name, brand: p.brand, unit: p.unit, price: p.price, active: p.active }));

  const STATUS_TABS: Array<{ key: "all" | QuoteStatus; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "em_aberto", label: "Em aberto" },
    { key: "fechado", label: "Fechados" },
    { key: "nao_fechado", label: "Não fechados" },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar por nome do cliente ou código..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white" />
        </div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          className="px-3 py-2.5 text-xs border border-border rounded-xl outline-none focus:border-primary bg-white" />
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-colors whitespace-nowrap">
          <Plus size={14} /> Novo orçamento
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl overflow-x-auto">
        {STATUS_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap px-3 ${statusFilter === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-primary"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Gallery */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
          {quotes.length === 0 ? (
            <>
              <p className="font-black text-sm text-foreground mb-1">Nenhum orçamento cadastrado</p>
              <p className="text-xs mb-4">Crie propostas para seus clientes e acompanhe aqui.</p>
              <button onClick={openNew}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-colors">
                <Plus size={14} /> Criar primeiro orçamento
              </button>
            </>
          ) : (
            <p className="text-sm font-bold">Nenhum orçamento encontrado com os filtros aplicados.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(q => (
            <div key={q.id} className="relative">
              <QuoteCard quote={q} onClick={() => openEdit(q)} />
              {q.status === "nao_fechado" && (
                <button
                  onClick={e => { e.stopPropagation(); handleReopen(q); }}
                  className="absolute bottom-3 right-3 flex items-center gap-1 text-[10px] font-bold text-primary bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-100 transition-colors">
                  <RotateCcw size={9} /> Reabrir
                </button>
              )}
              {q.convertedSaleId && (
                <div className="absolute bottom-3 right-3">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                    <ExternalLink size={9} /> Ver pedido
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {formOpen && (
        <QuoteFormModal
          open={formOpen}
          editingQuote={editingQuote}
          customers={customers}
          products={productList}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          onWhatsApp={q => { setFormOpen(false); setWhatsappQuote(q); }}
          onConvert={q => { setConvertQuote(q); }}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          allQuotes={quotes}
        />
      )}

      {whatsappQuote && (
        <WhatsAppModal quote={whatsappQuote} onClose={() => { setWhatsappQuote(null); }} />
      )}

      {convertQuote && (
        <ConvertModal
          quote={convertQuote}
          onClose={() => setConvertQuote(null)}
          onConfirm={handleConvertConfirm}
        />
      )}
    </div>
  );
}
