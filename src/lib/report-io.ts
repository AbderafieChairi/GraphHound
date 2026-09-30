/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Report import/export helpers — pure-ish IO logic kept out of the React tree.
 *
 * These functions own the JSON/HTML shaping and browser-download plumbing so the
 * `ReportManager` component only has to wire them to buttons.
 */
import {
  createReportFn,
  createReportSectionFn,
  fetchReportSections,
  queryGraph,
  activeTheme,
} from "@/lib/graph.functions";
import type { DbReport } from "@/lib/env-registry";
import type { NodeIconSpec } from "@/lib/node-icons";
import { renderQuery } from "@/lib/report-sections";
import { generateStandaloneHtml } from "@/lib/report-export";

const VALID_INPUT_TYPES = ["none", "node", "string", "number", "date"] as const;

/** Trigger a client-side download of `content` as a named file. */
function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Slugify a report title into a safe download filename stem. */
function fileStem(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

/** Create reports (and their sections) from a parsed JSON payload. */
export async function importReportsFromJson(text: string, project: string): Promise<void> {
  const parsed = JSON.parse(text ?? "{}");
  const reportList = Array.isArray(parsed) ? parsed : [parsed];

  for (const repData of reportList) {
    if (!repData.title) continue;
    const createdRep = await createReportFn({
      data: {
        title: String(repData.title),
        description: String(repData.description || ""),
        project,
      },
    });

    if (Array.isArray(repData.sections)) {
      for (const secData of repData.sections) {
        if (!secData.title || !secData.query) continue;
        await createReportSectionFn({
          data: {
            reportId: createdRep.id,
            title: String(secData.title),
            description: String(secData.description || ""),
            query: String(secData.query),
            defaultValue: String(secData.defaultValue || ""),
            inputType: VALID_INPUT_TYPES.includes(secData.inputType) ? secData.inputType : "node",
          },
        });
      }
    }
  }
}

/** Export a report and its sections as a downloadable JSON file. */
export async function exportReportJson(report: DbReport): Promise<void> {
  const secList = await fetchReportSections({ data: { reportId: report.id } });
  const payload = {
    title: report.title,
    description: report.description,
    sections: secList.map((s) => ({
      title: s.title,
      description: s.description,
      query: s.query,
      defaultValue: s.defaultValue,
      inputType: s.inputType,
    })),
  };
  downloadFile(
    JSON.stringify(payload, null, 2),
    `${fileStem(report.title)}-report.json`,
    "application/json",
  );
}

/** Run every section's query and export the report as standalone HTML. */
export async function exportReportHtml(
  report: DbReport,
  project: string,
  icons?: Record<string, NodeIconSpec>,
): Promise<void> {
  const [secList, currentTheme] = await Promise.all([
    fetchReportSections({ data: { reportId: report.id } }),
    activeTheme(),
  ]);

  const queryDataList = [];
  for (const s of secList) {
    const cypher = renderQuery(s.query, s.defaultValue);
    const result = await queryGraph({ data: { cypher, project } });
    const rows = result.ok ? (JSON.parse(result.rowsJson) as any[]) : [];
    queryDataList.push({
      section: {
        id: s.id,
        title: s.title,
        description: s.description,
        query: s.query,
        defaultValue: s.defaultValue,
        inputType: s.inputType as any,
      },
      rows,
    });
  }

  const htmlContent = generateStandaloneHtml(
    report.title,
    report.description,
    queryDataList,
    currentTheme ?? undefined,
    icons,
  );
  downloadFile(htmlContent, `${fileStem(report.title)}-report.html`, "text/html;charset=utf-8");
}
