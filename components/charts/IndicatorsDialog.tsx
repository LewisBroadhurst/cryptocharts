"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";

import {
  clampLength,
  fieldOf,
  INDICATOR_PRESETS,
  LINE_COLORS,
  makeStudy,
  MAX_LENGTH,
  STUDY_FIELDS,
  STUDY_NAMES,
  STUDY_PRESETS,
  STUDY_TITLES,
  studyLabel,
  type Study,
  type StudyField,
  type StudyKind,
} from "@/lib/charts/studies";
import { cn } from "@/lib/utils";
import Modal from "@/components/base/Modal";
import ModalHeader from "@/components/base/ModalHeader";
import { SUBHEAD } from "@/components/base/panelStyles";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ColourPicker } from "@/components/charts/ChartPopover";
import { CloseIcon, EyeIcon } from "@/components/charts/ChartIcons";

const CHIP =
  "rounded-md border border-border px-2.5 py-1 text-xs text-body-foreground tabular-nums transition hover:border-border-strong hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted disabled:opacity-40 disabled:hover:border-border";

const ICON_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring-muted";

function LengthField({
  label,
  name,
  value,
  focus,
  onCommit,
}: {
  label: string;
  name: string;
  value: number;
  focus: boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) input.current?.select();
  }, [focus]);
  const commit = () => {
    const asked = Number(text);
    if (!Number.isFinite(asked) || text.trim() === "") {
      setText(String(value));
      return;
    }
    const length = clampLength(asked);
    setText(String(length));
    if (length !== value) onCommit(length);
  };
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        ref={input}
        variant="control"
        inputMode="numeric"
        aria-label={`${name} ${label.toLowerCase()}`}
        value={text}
        onChange={(event) => setText(event.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className="w-10 px-1.5 text-center text-sm tabular-nums"
      />
    </label>
  );
}

function StudyRow({
  study,
  focus,
  onChange,
  onRemove,
}: {
  study: Study;
  focus: boolean;
  onChange: (next: Study) => void;
  onRemove: () => void;
}) {
  const set = (key: StudyField, value: number) =>
    onChange({ ...study, [key]: value });

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
      <ColourPicker
        label={`${studyLabel(study)} colour`}
        value={study.color}
        colors={LINE_COLORS}
        onPick={(color) => onChange({ ...study, color })}
        className={ICON_BUTTON}
      />
      <span className="w-11 text-sm font-medium text-foreground">
        {STUDY_NAMES[study.kind]}
      </span>
      {STUDY_FIELDS[study.kind].map((field, i) => (
        <LengthField
          key={field.key}
          label={field.label}
          name={studyLabel(study)}
          value={fieldOf(study, field.key)}
          focus={focus && i === 0}
          onCommit={(value) => set(field.key, value)}
        />
      ))}
      <div className="ml-auto flex items-center gap-0.5">
        {([1, 2, 3] as const).map((width) => (
          <button
            key={width}
            type="button"
            aria-label={`${width}px`}
            aria-pressed={study.width === width}
            onClick={() => onChange({ ...study, width })}
            className={cn(
              ICON_BUTTON,
              study.width === width && "bg-secondary text-foreground",
            )}
          >
            <span
              className="w-3.5 rounded-full bg-current"
              style={{ height: width }}
            />
          </button>
        ))}
        <button
          type="button"
          aria-label={`${study.hidden ? "Show" : "Hide"} ${studyLabel(study)}`}
          aria-pressed={!study.hidden}
          onClick={() => onChange({ ...study, hidden: !study.hidden })}
          className={ICON_BUTTON}
        >
          <EyeIcon off={study.hidden} className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${studyLabel(study)}`}
          onClick={onRemove}
          className={cn(ICON_BUTTON, "hover:text-negative")}
        >
          <CloseIcon className="size-4" />
        </button>
      </div>
    </li>
  );
}

export default function IndicatorsDialog({
  studies,
  focusId,
  onChange,
  onClose,
  returnFocusTo,
}: {
  studies: readonly Study[];
  focusId: string | null;
  onChange: (studies: Study[]) => void;
  onClose: () => void;
  returnFocusTo?: RefObject<HTMLElement | null>;
}) {
  const headingId = useId();
  const [kind, setKind] = useState<StudyKind>("ema");
  const [length, setLength] = useState("");
  const asked = Number(length);
  const valid = length !== "" && asked >= 1 && asked <= MAX_LENGTH;

  const add = (addKind: StudyKind, addLength: number) =>
    onChange([...studies, makeStudy(addKind, clampLength(addLength), studies)]);
  const onChart = (preset: { kind: StudyKind; length: number }) =>
    studies.some(
      (study) => study.kind === preset.kind && study.length === preset.length,
    );

  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      dismissOnBackdrop
      className="items-start justify-center p-3 pt-[12dvh] backdrop:bg-black/60 sm:p-6 sm:pt-[12dvh]"
    >
      <DialogContent padding="none" className="flex w-full max-w-lg flex-col">
        <ModalHeader
          id={headingId}
          title="Indicators"
          onClose={onClose}
          className="border-b border-border px-4 py-3"
          titleClassName="text-base font-semibold text-foreground"
        />
        <div className="flex flex-col gap-5 px-4 py-4">
          <section>
            <h3 className={SUBHEAD}>Moving averages</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDY_PRESETS.map((preset) => (
                <button
                  key={`${preset.kind}-${preset.length}`}
                  type="button"
                  disabled={onChart(preset)}
                  onClick={() => add(preset.kind, preset.length)}
                  className={CHIP}
                >
                  {studyLabel(preset)}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!valid) return;
                add(kind, asked);
                setLength("");
              }}
            >
              <div
                role="group"
                aria-label="Average"
                className="flex rounded-md border border-border p-0.5"
              >
                {(["ema", "sma"] as const).map((one) => (
                  <button
                    key={one}
                    type="button"
                    aria-pressed={kind === one}
                    onClick={() => setKind(one)}
                    className={cn(
                      "rounded-sm px-2.5 py-0.5 text-xs font-medium text-subtle-foreground transition",
                      kind === one && "bg-secondary text-foreground",
                    )}
                  >
                    {STUDY_NAMES[one]}
                  </button>
                ))}
              </div>
              <Input
                variant="control"
                inputMode="numeric"
                aria-label="Length"
                placeholder="Any length, 1 to 500"
                value={length}
                onChange={(event) =>
                  setLength(event.target.value.replace(/\D/g, ""))
                }
                className="w-40 text-sm tabular-nums"
              />
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={!valid}
              >
                Add
              </Button>
              <span className="basis-full text-xs text-muted-foreground">
                {STUDY_TITLES[kind]}
                {kind === "ema"
                  ? ": recent prices count for more, so it turns sooner."
                  : ": every price in the window counts the same, so it turns later and smoother."}
              </span>
            </form>
          </section>
          <section>
            <h3 className={SUBHEAD}>Bands and oscillators</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {INDICATOR_PRESETS.map((preset) => (
                <li key={preset.kind} className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={onChart(preset)}
                    onClick={() => add(preset.kind, preset.length)}
                    className={cn(CHIP, "shrink-0")}
                  >
                    {studyLabel(makeStudy(preset.kind, preset.length, []))}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {preset.blurb}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className={SUBHEAD}>On the chart</h3>
            {studies.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No indicators yet. Add one above.
              </p>
            ) : (
              <ul className="mt-1 divide-y divide-border">
                {studies.map((study) => (
                  <StudyRow
                    key={study.id}
                    study={study}
                    focus={study.id === focusId}
                    onChange={(next) =>
                      onChange(
                        studies.map((one) => (one.id === next.id ? next : one)),
                      )
                    }
                    onRemove={() =>
                      onChange(studies.filter((one) => one.id !== study.id))
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Modal>
  );
}
