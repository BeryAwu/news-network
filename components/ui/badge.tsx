import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
export const badgeVariants = cva("badge", { variants: { variant: { default: "", secondary: "", success: "badge-green", warning: "badge-yellow", destructive: "badge-red", outline: "" } }, defaultVariants: { variant: "default" } });
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
