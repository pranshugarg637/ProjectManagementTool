"use client";

import { useState } from "react";
import { EyeIcon, Trash2Icon, XIcon } from "lucide-react";
import { useBoard } from "@/components/board/board-context";
import { DueBadge } from "@/components/card/due-badge";
import { LabelChip } from "@/components/card/label-chip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findCard } from "@/lib/board-state";
import { normalizeLabels, SUGGESTED_LABELS } from "@/lib/labels";
import type { Card } from "@/types/app";

/** Card details dialog: edit title, description, due date, labels, or delete. */
export function CardDialog({ cardId, onClose }: { cardId: string | null; onClose: () => void }) {
  const { state } = useBoard();
  const card = cardId ? findCard(state.cardsByList, cardId) : undefined;
  const listTitle = card ? state.lists.find((l) => l.id === card.list_id)?.title : undefined;

  return (
    <Dialog open={Boolean(card)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {/* key: reset the form whenever a different card is opened */}
        {card && <CardForm key={card.id} card={card} listTitle={listTitle} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function CardForm({
  card,
  listTitle,
  onClose,
}: {
  card: Card;
  listTitle?: string;
  onClose: () => void;
}) {
  const { canEdit, editCard, removeCard, today } = useBoard();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [labels, setLabels] = useState<string[]>(card.labels);
  const [labelInput, setLabelInput] = useState("");

  const addLabel = (value: string) => {
    setLabels((prev) => normalizeLabels([...prev, value]));
    setLabelInput("");
  };

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const changes: Parameters<typeof editCard>[1] = {};
    if (title.trim() !== card.title) changes.title = title.trim();
    if ((description.trim() || null) !== card.description)
      changes.description = description.trim() || null;
    if ((dueDate || null) !== card.due_date) changes.due_date = dueDate || null;
    if (labels.join() !== card.labels.join()) changes.labels = labels;
    if (Object.keys(changes).length > 0) void editCard(card.id, changes);
    onClose();
  }

  const suggestions = SUGGESTED_LABELS.filter((l) => !labels.includes(l));

  return (
    <form onSubmit={save} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="sr-only">Card details</DialogTitle>
        <DialogDescription className="flex items-center gap-2">
          in list <span className="text-foreground font-medium">{listTitle ?? "—"}</span>
          {!canEdit && (
            <span className="bg-muted inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs">
              <EyeIcon className="size-3" /> Read-only
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="card-title">Title</Label>
        <Input
          id="card-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={!canEdit}
          required
          className="text-base font-medium"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="card-description">Description</Label>
        <Textarea
          id="card-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          disabled={!canEdit}
          placeholder={canEdit ? "Add more detail…" : "No description"}
          className="min-h-28"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-start sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="card-due">Due date</Label>
          <div className="flex items-center gap-1">
            <Input
              id="card-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && dueDate && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setDueDate("")}
                aria-label="Clear due date"
              >
                <XIcon />
              </Button>
            )}
          </div>
          {dueDate && (
            <div>
              <DueBadge due={dueDate} today={today} />
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="card-label-input">Labels</Label>
          <div className="flex min-h-9 flex-wrap items-center gap-1.5">
            {labels.length === 0 && !canEdit && (
              <span className="text-muted-foreground text-sm">None</span>
            )}
            {labels.map((label) => (
              <LabelChip key={label} label={label} className="text-xs">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setLabels((prev) => prev.filter((l) => l !== label))}
                    aria-label={`Remove label ${label}`}
                    className="rounded-sm opacity-60 hover:opacity-100"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </LabelChip>
            ))}
          </div>
          {canEdit && labels.length < 10 && (
            <>
              <Input
                id="card-label-input"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    if (labelInput.trim()) addLabel(labelInput);
                  }
                }}
                placeholder="Type a label and press Enter"
                maxLength={24}
              />
              <div className="flex flex-wrap gap-1">
                {suggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => addLabel(label)}
                    className="rounded transition-transform hover:scale-105"
                    aria-label={`Add label ${label}`}
                  >
                    <LabelChip label={label}>+</LabelChip>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <DialogFooter className="items-center sm:justify-between">
        {canEdit ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                <Trash2Icon /> Delete card
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this card?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{card.title}&rdquo; will be permanently deleted. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    void removeCard(card.id);
                    onClose();
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={!title.trim()}>
              Save
            </Button>
          )}
        </div>
      </DialogFooter>
    </form>
  );
}
