"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps extends Omit<React.ComponentProps<typeof Link>, "href" | "className"> {
  href: string;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
  /** Match only the exact path instead of the path and its sub-routes */
  exact?: boolean;
}

/**
 * Small client island for active-route styling, so layouts that only need the current
 * pathname for a nav highlight can stay Server Components.
 */
export function NavLink({ href, className, activeClassName, inactiveClassName, exact = false, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(className, isActive ? activeClassName : inactiveClassName)}
      {...props}
    />
  );
}
