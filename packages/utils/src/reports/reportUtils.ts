import type {
  HotelReportResponse,
  ReportFilterPreset,
} from "@hotel/types";

export interface ResolvedDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startDateTime: Date;
  endDateTime: Date;
}

/** Formats date into local Indian / ISO date string YYYY-MM-DD */
export function formatISODateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves filter preset into explicit start and end date boundaries.
 */
export function resolveReportDateRange(
  preset: ReportFilterPreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date(),
): ResolvedDateRange {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let start: Date;
  let end: Date;

  switch (preset) {
    case "today": {
      start = new Date(current);
      end = new Date(current);
      break;
    }
    case "yesterday": {
      start = new Date(current);
      start.setDate(start.getDate() - 1);
      end = new Date(start);
      break;
    }
    case "current-week": {
      // Monday as week start
      start = new Date(current);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end = new Date(current);
      break;
    }
    case "current-month": {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
      end = new Date(current);
      break;
    }
    case "custom": {
      if (customStart) {
        start = new Date(customStart);
        if (isNaN(start.getTime())) start = new Date(current);
      } else {
        start = new Date(current);
      }

      if (customEnd) {
        end = new Date(customEnd);
        if (isNaN(end.getTime())) end = new Date(current);
      } else {
        end = new Date(current);
      }

      // Ensure start <= end
      if (start > end) {
        const temp = start;
        start = end;
        end = temp;
      }
      break;
    }
    default: {
      start = new Date(current);
      end = new Date(current);
    }
  }

  const startDateTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  const endDateTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  return {
    startDate: formatISODateOnly(start),
    endDate: formatISODateOnly(end),
    startDateTime,
    endDateTime,
  };
}

/**
 * Generates an RFC 4180 compliant CSV string from a report response.
 */
export function generateReportCSV(report: HotelReportResponse): string {
  const lines: string[] = [];

  // Report Title and Metadata
  lines.push(`"${escapeCSV(report.title)}"`);
  lines.push(`"Generated At: ${report.generatedAt}"`);
  lines.push(`"Date Range: ${report.filter.startDate} to ${report.filter.endDate} (${report.filter.preset})"`);
  lines.push("");

  // Summary KPI block
  if (report.summary && report.summary.length > 0) {
    lines.push('"EXECUTIVE SUMMARY"');
    for (const item of report.summary) {
      lines.push(`"${escapeCSV(item.label)}","${escapeCSV(String(item.value))}"`);
    }
    lines.push("");
  }

  // Column Headers
  const headers = report.columns.map((c) => `"${escapeCSV(c.label)}"`);
  lines.push(headers.join(","));

  // Detailed Data Rows
  for (const row of report.rows) {
    const rowValues = report.columns.map((c) => {
      const val = row[c.key];
      if (val === undefined || val === null) return '""';
      return `"${escapeCSV(String(val))}"`;
    });
    lines.push(rowValues.join(","));
  }

  // Totals Row
  if (report.totals && Object.keys(report.totals).length > 0) {
    const totalRow = report.columns.map((c, index) => {
      if (index === 0) return `"TOTAL"`;
      const val = report.totals[c.key];
      if (val === undefined || val === null) return '""';
      return `"${escapeCSV(String(val))}"`;
    });
    lines.push(totalRow.join(","));
  }

  return lines.join("\r\n");
}

function escapeCSV(str: string): string {
  return str.replace(/"/g, '""');
}

/**
 * Generates an Excel-compatible XML Spreadsheet document.
 * Opens natively in Microsoft Excel, Google Sheets, and LibreOffice Calc.
 */
export function generateReportExcelXML(report: HotelReportResponse): string {
  const escapeXML = (val: string) =>
    val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="16" ss:Color="#0F172A" ss:Bold="1"/>
  </Style>
  <Style ss:ID="SubTitle">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#64748B" ss:Italic="1"/>
  </Style>
  <Style ss:ID="Total">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94A3B8"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#94A3B8"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Right"/>
  </Style>
  <Style ss:ID="CurrencyCell">
   <Alignment ss:Horizontal="Right"/>
   <NumberFormat ss:Format="₹#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table>`;

  // Title
  xml += `
   <Row ss:Height="24">
    <Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXML(report.title)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="SubTitle"><Data ss:Type="String">Date Range: ${report.filter.startDate} to ${report.filter.endDate} | Generated: ${escapeXML(report.generatedAt)}</Data></Cell>
   </Row>
   <Row ss:Height="10"/>`;

  // Summary block
  if (report.summary && report.summary.length > 0) {
    xml += `
   <Row><Cell><Data ss:Type="String">Executive Summary:</Data></Cell></Row>`;
    for (const item of report.summary) {
      xml += `
   <Row>
    <Cell><Data ss:Type="String">${escapeXML(item.label)}</Data></Cell>
    <Cell><Data ss:Type="String">${escapeXML(String(item.value))}</Data></Cell>
   </Row>`;
    }
    xml += `
   <Row ss:Height="10"/>`;
  }

  // Header row
  xml += `
   <Row ss:Height="20">`;
  for (const col of report.columns) {
    xml += `
    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXML(col.label)}</Data></Cell>`;
  }
  xml += `
   </Row>`;

  // Data rows
  for (const row of report.rows) {
    xml += `
   <Row>`;
    for (const col of report.columns) {
      const val = row[col.key];
      const isNum = typeof val === "number";
      const styleId = col.format === "currency" ? ' ss:StyleID="CurrencyCell"' : isNum ? ' ss:StyleID="NumberCell"' : "";
      const type = isNum ? "Number" : "String";
      const cleanVal = val === null || val === undefined ? "" : String(val);

      xml += `
    <Cell${styleId}><Data ss:Type="${type}">${isNum ? val : escapeXML(cleanVal)}</Data></Cell>`;
    }
    xml += `
   </Row>`;
  }

  // Totals row
  if (report.totals && Object.keys(report.totals).length > 0) {
    xml += `
   <Row ss:Height="20">`;
    for (let i = 0; i < report.columns.length; i++) {
      const col = report.columns[i]!;
      if (i === 0) {
        xml += `
    <Cell ss:StyleID="Total"><Data ss:Type="String">TOTAL</Data></Cell>`;
      } else {
        const val = report.totals[col.key];
        const isNum = typeof val === "number";
        const type = isNum ? "Number" : "String";
        const cleanVal = val === null || val === undefined ? "" : String(val);
        xml += `
    <Cell ss:StyleID="Total"><Data ss:Type="${type}">${isNum ? val : escapeXML(cleanVal)}</Data></Cell>`;
      }
    }
    xml += `
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}
