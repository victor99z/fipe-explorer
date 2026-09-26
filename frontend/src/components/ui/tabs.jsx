import * as React from "react"
import { cn } from "../../lib/utils"

const TabsContext = React.createContext({ value: "", onValueChange: () => {} })

const Tabs = React.forwardRef(({ value, onValueChange, className, children, ...props }, ref) => (
  <TabsContext.Provider value={{ value, onValueChange }}>
    <div ref={ref} className={cn("w-full", className)} {...props}>
      {children}
    </div>
  </TabsContext.Provider>
))
Tabs.displayName = "Tabs"

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950/80 p-1.5 text-slate-400 border border-slate-800 shadow-xl",
      className
    )}
    {...props}
  />
))
TabsList.displayName = "TabsList"

const TabsTrigger = React.forwardRef(({ value, className, children, ...props }, ref) => {
  const { value: selectedValue, onValueChange } = React.useContext(TabsContext)
  const isSelected = selectedValue === value

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isSelected}
      onClick={() => onValueChange && onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer gap-2",
        isSelected
          ? "bg-slate-800 text-white shadow-lg border border-slate-700/60"
          : "text-slate-400 hover:text-slate-100 hover:bg-slate-900/50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
TabsTrigger.displayName = "TabsTrigger"

const TabsContent = React.forwardRef(({ value, className, children, ...props }, ref) => {
  const { value: selectedValue } = React.useContext(TabsContext)
  if (selectedValue !== value) return null

  return (
    <div
      ref={ref}
      role="tabpanel"
      className={cn("mt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
})
TabsContent.displayName = "TabsContent"

export { Tabs, TabsList, TabsTrigger, TabsContent }
