import jsPDF from "jspdf";

/**
 * Handles page breaks when content overflows.
 */
export const HandlePageBreaks = (pageBreakHandler: () => void, doc: jsPDF) => {
    pageBreakHandler();
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(51, 51, 51);
};