/**
 * Sales amount and invoice number typed on a visit logged from a task. The
 * visit report has no place for them (no migration, see the plan), so they
 * wait here and pre-fill that task's Mark as done, which sends them.
 */
const sales = new Map<number, { sales: string | null; invoiceNo: string | null }>();

export function rememberTaskSales(taskId: number, value: { sales: string | null; invoiceNo: string | null }) {
  if (value.sales || value.invoiceNo) sales.set(taskId, value);
}

export function takeTaskSales(taskId: number): { sales: string | null; invoiceNo: string | null } | null {
  return sales.get(taskId) ?? null;
}

export function clearTaskSales(taskId: number) {
  sales.delete(taskId);
}
