"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BookOpen, Database, BarChart3, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export function NavigationMenu() {
  const pathname = usePathname()

  const navItems = [
    {
      href: "/",
      label: "Agent App",
      icon: Home,
    },
    {
      href: "/financial-server",
      label: "Financial Server",
      icon: Database,
    },
    {
      href: "/kpi-server",
      label: "KPI Server",
      icon: BarChart3,
    },
    {
      href: "/api-docs",
      label: "API Docs",
      icon: BookOpen,
    },
  ]

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className={cn("gap-2", isActive && "bg-muted")}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          </Link>
        )
      })}
    </nav>
  )
}
