// Lightweight replacement for class-variance-authority
type ClassValue = string | number | boolean | undefined | null
type ClassArray = ClassValue[]
type ClassObject = Record<string, boolean | undefined | null>

function cn(...inputs: (ClassValue | ClassArray | ClassObject)[]): string {
  const classes: string[] = []

  for (const input of inputs) {
    if (!input) continue

    if (typeof input === "string" || typeof input === "number") {
      classes.push(String(input))
    } else if (Array.isArray(input)) {
      const result = cn(...input)
      if (result) classes.push(result)
    } else if (typeof input === "object") {
      for (const key in input) {
        if (input[key]) classes.push(key)
      }
    }
  }

  return classes.join(" ")
}

type ConfigVariants = Record<string, Record<string, ClassValue>>
type ConfigCompoundVariants = Array<Record<string, any> & { class?: ClassValue; className?: ClassValue }>

interface Config {
  base?: ClassValue
  variants?: ConfigVariants
  compoundVariants?: ConfigCompoundVariants
  defaultVariants?: Record<string, string>
}

export function cva(base?: ClassValue, config?: Config) {
  return (props?: Record<string, any>) => {
    if (!config) return cn(base)

    const { variants, compoundVariants, defaultVariants } = config

    // Start with base classes
    const classes = [base]

    // Apply variant classes
    if (variants && props) {
      for (const variantName in variants) {
        const variantValue = props[variantName] ?? defaultVariants?.[variantName]
        if (variantValue != null) {
          const variantClass = variants[variantName][variantValue]
          if (variantClass) classes.push(variantClass)
        }
      }
    }

    // Apply compound variants
    if (compoundVariants && props) {
      for (const compound of compoundVariants) {
        let matches = true
        for (const key in compound) {
          if (key === "class" || key === "className") continue
          if (props[key] !== compound[key]) {
            matches = false
            break
          }
        }
        if (matches) {
          classes.push(compound.class || compound.className)
        }
      }
    }

    // Apply className prop
    if (props?.className) {
      classes.push(props.className)
    }

    return cn(...classes)
  }
}

export type VariantProps<T extends (...args: any) => any> = Omit<Parameters<T>[0], "class" | "className">
