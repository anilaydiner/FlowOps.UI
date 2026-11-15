import * as React from "react"
import { cn } from "cn"
import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { CheckIcon } from "lucide-react"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border shadow-xs transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:inset-4 after:rounded-full after:bg-background disabled:cursor-not-allowed dark:border-input dark:bg-input/30 dark:after:bg-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary has-data-[state=checked]:shadow-none dark:has-data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none opacity-100 dark:text-primary-foreground [&_svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
