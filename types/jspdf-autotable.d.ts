declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export function autoTable(doc: jsPDF, options: Record<string, unknown>): void;
}
