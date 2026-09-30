import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Plus,
  Trash2,
  ChevronRight,
  ArrowLeft,
  Loader2,
  X,
  Pencil,
  Upload,
  Download,
} from "lucide-react";
import type { DbReport, DbReportSection } from "@/lib/env-registry";
import type { NodeIconSpec } from "@/lib/node-icons";
import { ReportSectionCard } from "./ReportSectionCard";
import { ReportFormModal } from "./ReportFormModal";
import { SectionFormModal } from "./SectionFormModal";
import { useReports, type SectionInput } from "@/hooks/use-reports";
import { importReportsFromJson, exportReportJson, exportReportHtml } from "@/lib/report-io";

interface ReportManagerProps {
  project: string;
  icons?: Record<string, NodeIconSpec>;
}

export function ReportManager({ project, icons }: ReportManagerProps) {
  const {
    reports,
    sections,
    setSections,
    loading,
    setLoading,
    loadReports,
    loadSections,
    createReport,
    updateReport,
    deleteReport,
    createSection,
    updateSection,
    deleteSection,
  } = useReports(project);

  const [selectedReport, setSelectedReport] = useState<DbReport | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DbReport | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<DbReportSection | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importReportsFromJson((await file.text()) ?? "{}", project);
      await loadReports();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Failed to import report JSON", err);
      alert("Failed to parse report JSON file. Please ensure valid JSON formatting.");
    }
  };

  const handleExportJson = async (e: React.MouseEvent, report: DbReport) => {
    e.stopPropagation();
    try {
      await exportReportJson(report);
    } catch (err) {
      console.error("Failed to export report", err);
    }
  };

  const handleExportHtml = async (e: React.MouseEvent, report: DbReport) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await exportReportHtml(report, project, icons);
    } catch (err) {
      console.error("Failed to export HTML report", err);
      alert("Failed to export HTML report: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = (report: DbReport) => {
    setSelectedReport(report);
    loadSections(report.id);
  };

  const openAddReport = () => {
    setEditingReport(null);
    setReportModalOpen(true);
  };

  const openEditReport = (e: React.MouseEvent, report: DbReport) => {
    e.stopPropagation();
    setEditingReport(report);
    setReportModalOpen(true);
  };

  const handleSaveReport = async (title: string, description: string) => {
    try {
      if (editingReport) {
        const updated = await updateReport(editingReport.id, title, description);
        setReportModalOpen(false);
        setEditingReport(null);
        await loadReports();
        setSelectedReport((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
      } else {
        const newRep = await createReport(title, description);
        setReportModalOpen(false);
        await loadReports();
        handleSelectReport(newRep);
      }
    } catch (err) {
      console.error("Failed to save report", err);
    }
  };

  const handleDeleteReport = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this report and all its sections?")) return;
    try {
      await deleteReport(reportId);
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
        setSections([]);
      }
      await loadReports();
    } catch (err) {
      console.error("Failed to delete report", err);
    }
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionModalOpen(true);
  };

  const openEditSection = (sec: DbReportSection) => {
    setEditingSection(sec);
    setSectionModalOpen(true);
  };

  const handleSaveSection = async (data: SectionInput) => {
    if (!selectedReport) return;
    try {
      if (editingSection) {
        await updateSection(editingSection.id, data);
      } else {
        await createSection(selectedReport.id, data);
      }
      setSectionModalOpen(false);
      await loadSections(selectedReport.id);
      await loadReports();
    } catch (err) {
      console.error("Failed to save report section", err);
    }
  };

  const handleDeleteSection = async (secId: string) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      await deleteSection(secId);
      if (selectedReport) {
        await loadSections(selectedReport.id);
        await loadReports();
      }
    } catch (err) {
      console.error("Failed to delete report section", err);
    }
  };

  const handleSaveDefaultValue = async (sec: DbReportSection, newValue: string) => {
    try {
      await updateSection(sec.id, {
        title: sec.title,
        description: sec.description,
        query: sec.query,
        defaultValue: newValue,
        inputType: sec.inputType,
      });
      if (selectedReport) await loadSections(selectedReport.id);
    } catch (err) {
      console.error("Failed to save default value", err);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight uppercase">Analytic Reports</h2>
            <p className="mono text-[10px] text-muted-foreground">
              Saved multi-section report notebooks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer shadow-xs"
              title="Import report from JSON file"
            >
              <Upload className="size-3.5" />
              Import JSON
            </button>
            <button
              onClick={openAddReport}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="size-3.5" />
              Add Report
            </button>
          </div>
        </div>

        {loading && reports.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            No reports found. Click "Add Report" or "Import JSON" to load report notebooks.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reports.map((r) => (
              <ReportListItem
                key={r.id}
                report={r}
                onSelect={() => handleSelectReport(r)}
                onExportHtml={(e) => handleExportHtml(e, r)}
                onExportJson={(e) => handleExportJson(e, r)}
                onEdit={(e) => openEditReport(e, r)}
                onDelete={(e) => handleDeleteReport(e, r.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedReport &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 sm:p-6">
            <div className="panel relative w-full max-w-8xl max-h-[92vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-sidebar/50 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="panel flex h-8 w-8 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors bg-card shadow-xs cursor-pointer"
                    title="Back to reports"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-semibold">{selectedReport.title}</h2>
                    {selectedReport.description && (
                      <p className="text-xs text-muted-foreground">{selectedReport.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => openEditReport(e, selectedReport)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer shadow-xs"
                    title="Edit report title & description"
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleExportHtml(e, selectedReport)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer shadow-xs"
                    title="Export this report as standalone HTML"
                  >
                    <FileText className="size-3.5" />
                    Export HTML
                  </button>
                  <button
                    onClick={(e) => handleExportJson(e, selectedReport)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer shadow-xs"
                    title="Export this report as JSON"
                  >
                    <Download className="size-3.5" />
                    Export JSON
                  </button>
                  <button
                    onClick={openAddSection}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus className="size-3.5" />
                    Add Section
                  </button>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="panel flex h-8 w-8 items-center justify-center rounded-md hover:border-primary text-muted-foreground hover:text-primary transition-colors bg-card shadow-xs cursor-pointer ml-2"
                    title="Close report"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {loading && sections.length === 0 ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="size-8 animate-spin text-primary" />
                  </div>
                ) : sections.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
                    No sections in this report yet. Click "Add Section" to create one.
                  </div>
                ) : (
                  sections.map((sec) => (
                    <ReportSectionCard
                      key={sec.id}
                      section={{
                        id: sec.id,
                        title: sec.title,
                        description: sec.description,
                        query: sec.query,
                        defaultValue: sec.defaultValue,
                        inputType: sec.inputType,
                      }}
                      project={project}
                      icons={icons}
                      onEdit={() => openEditSection(sec)}
                      onDelete={() => handleDeleteSection(sec.id)}
                      onSaveDefaultValue={(newVal) => handleSaveDefaultValue(sec, newVal)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      <ReportFormModal
        open={reportModalOpen}
        editing={editingReport}
        onClose={() => {
          setReportModalOpen(false);
          setEditingReport(null);
        }}
        onSave={handleSaveReport}
      />

      <SectionFormModal
        open={sectionModalOpen}
        editing={editingSection}
        onClose={() => setSectionModalOpen(false)}
        onSave={handleSaveSection}
      />
    </div>
  );
}

interface ReportListItemProps {
  report: DbReport;
  onSelect: () => void;
  onExportHtml: (e: React.MouseEvent) => void;
  onExportJson: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

/** A single report row in the list view. */
function ReportListItem({
  report,
  onSelect,
  onExportHtml,
  onExportJson,
  onEdit,
  onDelete,
}: ReportListItemProps) {
  return (
    <div
      onClick={onSelect}
      className="panel group border border-border bg-card/60 hover:bg-card hover:border-primary/50 p-3.5 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 shadow-xs"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
              {report.title}
            </h3>
            <span className="mono text-[10px] rounded-full bg-muted px-2 py-0.5 font-medium shrink-0">
              {report.sectionCount ?? 0} {report.sectionCount === 1 ? "section" : "sections"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
            {report.description || "No description provided."}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onExportHtml}
          className="control flex h-7 w-7 items-center justify-center rounded hover:border-primary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title="Export report as standalone HTML"
        >
          <FileText className="size-3.5" />
        </button>
        <button
          onClick={onExportJson}
          className="control flex h-7 w-7 items-center justify-center rounded hover:border-primary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title="Export report as JSON"
        >
          <Download className="size-3.5" />
        </button>
        <button
          onClick={onEdit}
          className="control flex h-7 w-7 items-center justify-center rounded hover:border-primary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          title="Edit report title & description"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="control flex h-7 w-7 items-center justify-center rounded hover:border-destructive text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          title="Delete report"
        >
          <Trash2 className="size-3.5" />
        </button>
        <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}
