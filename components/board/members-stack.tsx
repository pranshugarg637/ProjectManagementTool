import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABELS } from "@/lib/permissions";
import { avatarColor, cn, initials } from "@/lib/utils";
import type { Member } from "@/types/app";

/** Overlapping avatars of board members (+N when there are many). */
export function MembersStack({ members, max = 4 }: { members: Member[]; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex -space-x-2" aria-label={`${members.length} members`}>
      {shown.map((m) => (
        <Tooltip key={m.user_id}>
          <TooltipTrigger asChild>
            <Avatar className="ring-background size-7 ring-2">
              <AvatarFallback className={cn("text-[10px]", avatarColor(m.email))}>
                {initials(m.full_name || m.email)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            {m.full_name || m.email} · {ROLE_LABELS[m.role]}
          </TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && (
        <span className="bg-muted ring-background grid size-7 place-items-center rounded-full text-[10px] font-semibold ring-2">
          +{extra}
        </span>
      )}
    </div>
  );
}
