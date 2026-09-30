import { useRef, useState } from "react";
import { Check, Upload, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { chooseIconSet, uploadIconSet, removeIconSet } from "@/lib/graph.functions";
import { resolveIcon } from "@/lib/fontawesome";
import type { IconSetInfo } from "../SettingsDialog";

interface IconsSectionProps {
  iconSets: IconSetInfo[];
  onIconSetsChange: () => void;
  /** Project of the active environment – selections are scoped to it. */
  project: string;
}

export function IconsSection({ iconSets, onIconSetsChange, project }: IconsSectionProps) {
  const [saving, setSaving] = useState(false);
  const [setName, setSetName] = useState("");
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const changeIcons = useServerFn(chooseIconSet);
  const addIcons = useServerFn(uploadIconSet);
  const deleteIcons = useServerFn(removeIconSet);

  const selectIcons = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await changeIcons({ data: { id, project } });
      onIconSetsChange();
    } finally {
      setSaving(false);
    }
  };

  const deleteSet = async (id: number) => {
    if (saving) return;
    setSaving(true);
    try {
      await deleteIcons({ data: { id } });
      onIconSetsChange();
    } finally {
      setSaving(false);
    }
  };

  const handleIconUpload = async (file: File) => {
    try {
      if (!setName.trim()) throw new Error("Enter a name for this icon set first.");
      await addIcons({
        data: { name: setName.trim(), icons: JSON.parse(await file.text()), project },
      });
      setSetName("");
      if (fileRef.current) fileRef.current.value = "";
      onIconSetsChange();
      setMessage("Icon set imported and applied to the graph.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid icon JSON.");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-sm font-semibold">Icon sets</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose the icon set used when rendering graph nodes. The selection applies to the
          current environment only — each environment keeps its own icon set.
        </p>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
          Set name
          <input
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="My custom icons"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleIconUpload(file);
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          <Upload className="size-4" />
          Upload JSON
        </button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="flex flex-col gap-3">
        {iconSets.map((set) => (
          <div
            key={set.id}
            className={`rounded-lg border p-3 ${
              set.is_selected ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{set.set_name}</span>
                {set.is_default && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {set.is_selected ? (
                  <span className="flex h-8 items-center gap-1.5 rounded-md bg-primary/10 px-3 text-xs font-medium text-primary">
                    <Check className="size-3.5" />
                    Selected
                  </span>
                ) : (
                  <button
                    onClick={() => void selectIcons(set.id)}
                    disabled={saving}
                    className="flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium hover:bg-muted/40 disabled:opacity-50"
                  >
                    Select
                  </button>
                )}
                {!set.is_default && (
                  <button
                    onClick={() => void deleteSet(set.id)}
                    aria-label={`Delete ${set.set_name}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(set.set_custom_icons_json).map(([kind, value]) => {
                const def = resolveIcon(value.icon);
                return (
                  <div key={kind} className="flex items-center gap-2 text-[11px]">
                    <span
                      className="flex size-4 items-center justify-center"
                      style={{ color: value.icon.color }}
                    >
                      {def ? (
                        <FontAwesomeIcon icon={def} className="size-3" />
                      ) : (
                        <span className="size-2 rounded-full bg-current" />
                      )}
                    </span>
                    <span className="truncate text-muted-foreground">{kind}</span>
                    <span className="ml-auto truncate font-mono text-[10px] text-foreground/70">
                      {value.icon.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
