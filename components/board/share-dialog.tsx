"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, MailPlusIcon, Share2Icon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { useBoard } from "@/components/board/board-context";
import { RoleBadge } from "@/components/board/role-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeMemberRole, inviteMember, removeMember } from "@/lib/actions/members";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  wouldRemoveLastOwner,
  type Role,
} from "@/lib/permissions";
import { avatarColor, initials } from "@/lib/utils";

/**
 * Owner-only dialog: invite people by email, change roles, remove members.
 * The database enforces all of this again (RLS + invite_member + last-owner trigger).
 */
export function ShareDialog() {
  const { state, currentUserId, refresh } = useBoard();
  const boardId = state.board.id;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [pending, startTransition] = useTransition();
  const [busyUser, setBusyUser] = useState<string | null>(null);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteMember({ boardId, email, role });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${email} added as ${ROLE_LABELS[role].toLowerCase()}`);
      setEmail("");
      await refresh();
    });
  }

  async function updateRole(userId: string, newRole: Role) {
    setBusyUser(userId);
    const result = await changeMemberRole({ boardId, userId, role: newRole });
    setBusyUser(null);
    if (!result.ok) toast.error(result.error);
    else toast.success("Role updated");
    await refresh();
  }

  async function remove(userId: string, label: string) {
    setBusyUser(userId);
    const result = await removeMember({ boardId, userId });
    setBusyUser(null);
    if (!result.ok) toast.error(result.error);
    else toast.success(`${label} removed from the board`);
    await refresh();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          <Share2Icon /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{state.board.title}&rdquo;</DialogTitle>
          <DialogDescription>
            Invite people who already have a Flowboard account. They&apos;ll see the board right
            away.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-full sm:w-28" aria-label="Role for the invited person">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={pending || !email}>
            {pending ? <Loader2Icon className="animate-spin" /> : <MailPlusIcon />}
            Invite
          </Button>
        </form>
        <p className="text-muted-foreground -mt-2 text-xs">{ROLE_DESCRIPTIONS[role]}.</p>

        <div className="space-y-1">
          <h3 className="text-sm font-medium">People with access ({state.members.length})</h3>
          <ul className="divide-y rounded-lg border">
            {state.members.map((m) => {
              const isMe = m.user_id === currentUserId;
              const label = m.full_name || m.email;
              const lastOwner = wouldRemoveLastOwner(state.members, m.user_id, null);
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar className="size-8">
                    <AvatarFallback className={avatarColor(m.email)}>
                      {initials(label)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {label} {isMe && <span className="text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">{m.email}</p>
                  </div>
                  {busyUser === m.user_id ? (
                    <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
                  ) : lastOwner ? (
                    <RoleBadge role="owner" />
                  ) : (
                    <>
                      <Select
                        value={m.role}
                        onValueChange={(v) => void updateRole(m.user_id, v as Role)}
                      >
                        <SelectTrigger size="sm" className="w-26" aria-label={`Role of ${label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void remove(m.user_id, label)}
                        aria-label={`Remove ${label}`}
                      >
                        <UserMinusIcon />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground pt-1 text-xs">
            A board always keeps at least one owner — promote someone else before stepping down.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
