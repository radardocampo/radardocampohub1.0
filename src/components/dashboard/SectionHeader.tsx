import type { ReactNode } from "react";

export function SectionHeader({
  title,
  description,
  action,
  as: Tag = "h2",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div>
        <Tag className="text-base font-semibold tracking-tight">{title}</Tag>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
