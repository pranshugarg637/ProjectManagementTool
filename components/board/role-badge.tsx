import { CrownIcon, EyeIcon, PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

const ICONS = { owner: CrownIcon, member: PencilIcon, viewer: EyeIcon } as const;

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const Icon = ICONS[role];
  return (
    <Badge variant={role} className={className}>
      <Icon aria-hidden />
      {ROLE_LABELS[role]}
    </Badge>
  );
}
