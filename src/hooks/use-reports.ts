import { useCallback, useEffect, useState } from "react";
import {
  fetchReports,
  createReportFn,
  updateReportFn,
  deleteReportFn,
  fetchReportSections,
  createReportSectionFn,
  updateReportSectionFn,
  deleteReportSectionFn,
} from "@/lib/graph.functions";
import type { DbReport, DbReportSection } from "@/lib/env-registry";

export type SectionInput = {
  title: string;
  description: string;
  query: string;
  defaultValue: string;
  inputType: string;
};

/**
 * Owns report/section list state and all registry CRUD calls, keeping the
 * `ReportManager` component focused on presentation. Returns the current lists,
 * a loading flag, and imperative operations that keep those lists in sync.
 */
export function useReports(project: string) {
  const [reports, setReports] = useState<DbReport[]>([]);
  const [sections, setSections] = useState<DbReportSection[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await fetchReports({ data: { project } }));
    } catch (err) {
      console.error("Failed to load reports", err);
    } finally {
      setLoading(false);
    }
  }, [project]);

  const loadSections = useCallback(async (reportId: string) => {
    setLoading(true);
    try {
      setSections(await fetchReportSections({ data: { reportId } }));
    } catch (err) {
      console.error("Failed to load report sections", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const createReport = useCallback(
    (title: string, description: string) =>
      createReportFn({ data: { title, description, project } }),
    [project],
  );

  const updateReport = useCallback(
    (id: string, title: string, description: string) =>
      updateReportFn({ data: { id, title, description } }),
    [],
  );

  const deleteReport = useCallback((id: string) => deleteReportFn({ data: { id } }), []);

  const createSection = useCallback(
    (reportId: string, data: SectionInput) =>
      createReportSectionFn({ data: { reportId, ...data } }),
    [],
  );

  const updateSection = useCallback(
    (id: string, data: SectionInput) => updateReportSectionFn({ data: { id, ...data } }),
    [],
  );

  const deleteSection = useCallback((id: string) => deleteReportSectionFn({ data: { id } }), []);

  return {
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
  };
}
