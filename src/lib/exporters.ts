import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { LeadRecord } from '../types/leadin';

export function exportLeadsToExcel(leads: LeadRecord[], filenamePrefix = 'leadin-prospects'): void {
  const rows = leads.map((lead) => ({
    'Account Name': lead.accountName,
    Date: lead.postDate,
    Work: lead.work,
    Post: lead.post,
    Link: lead.link || 'N/A',
    Contact: lead.contact,
    'AI Score': lead.aiScore,
    Platform: lead.platform.toUpperCase(),
    Status: lead.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 24 }, // Account Name
    { wch: 16 }, // Date
    { wch: 28 }, // Work
    { wch: 56 }, // Post
    { wch: 36 }, // Link
    { wch: 28 }, // Contact
    { wch: 10 }, // AI Score
    { wch: 12 }, // Platform
    { wch: 12 }, // Status
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Freelance Leads');

  const highValueLeads = leads.filter((l) => l.aiScore >= 80);
  if (highValueLeads.length > 0) {
    const hvSheet = XLSX.utils.json_to_sheet(
      highValueLeads.map((lead) => ({
        'Account Name': lead.accountName,
        Date: lead.postDate,
        Work: lead.work,
        Post: lead.post,
        Link: lead.link || 'N/A',
        Contact: lead.contact,
        'AI Score': lead.aiScore,
      }))
    );
    hvSheet['!cols'] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 28 },
      { wch: 56 },
      { wch: 36 },
      { wch: 28 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(workbook, hvSheet, 'High Value (80+)');
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}-${stamp}.xlsx`);
}

export function exportLeadsToPdf(
  leads: LeadRecord[],
  options?: {
    reportTitle?: string;
    filterLabel?: string;
    filenamePrefix?: string;
    alertThreshold?: number;
  }
): void {
  const reportTitle = options?.reportTitle || 'Leadin — Freelance Prospect Report';
  const filterLabel = options?.filterLabel || 'All Leads';
  const filenamePrefix = options?.filenamePrefix || 'leadin-prospects';
  const threshold = options?.alertThreshold ?? 80;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header band
  doc.setFillColor(9, 13, 22);
  doc.rect(0, 0, pageWidth, 68, 'F');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(reportTitle, 32, 30);

  doc.setTextColor(52, 211, 153);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const highCount = leads.filter((l) => l.aiScore >= threshold).length;
  const generatedStr = `View: ${filterLabel}  ·  Generated ${new Date().toLocaleDateString()}  ·  ${
    leads.length
  } lead${leads.length === 1 ? '' : 's'}  ·  High-value (${threshold}+): ${highCount}`;
  doc.text(generatedStr, 32, 49);

  // Strict 6-column layout: Account Name, Date, Work, Post, Link, Contact
  const tableRows = leads.map((lead) => [
    lead.accountName,
    lead.postDate,
    lead.work,
    lead.post.length > 320 ? `${lead.post.slice(0, 317)}...` : lead.post,
    lead.link || '—',
    lead.contact,
  ]);

  autoTable(doc, {
    startY: 82,
    head: [['Account Name', 'Date', 'Work', 'Post', 'Link', 'Contact']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 6.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: [17, 24, 39],
      textColor: [248, 250, 252],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 102, fontStyle: 'bold' }, // Account Name
      1: { cellWidth: 70 }, // Date
      2: { cellWidth: 118 }, // Work
      3: { cellWidth: 238 }, // Post
      4: { cellWidth: 128, textColor: [5, 150, 105] }, // Link
      5: { cellWidth: 121 }, // Contact
    },
    margin: { left: 32, right: 32, bottom: 38 },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const rawUrl = leads[data.row.index]?.link;
        if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
            url: rawUrl,
          });
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Leadin Lead Sheet (Account Name · Date · Work · Post · Link · Contact)`,
        32,
        pageHeight - 18
      );
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 32,
        pageHeight - 18,
        { align: 'right' }
      );
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  doc.save(`${filenamePrefix}-${slug || 'all'}-${stamp}.pdf`);
}

export function exportLeadsToJson(leads: LeadRecord[], filenamePrefix = 'leadin-leads'): void {
  const payload = leads.map((l) => ({
    accountName: l.accountName,
    date: l.postDate,
    work: l.work,
    post: l.post,
    link: l.link,
    contact: l.contact,
    platform: l.platform,
    aiScore: l.aiScore,
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
