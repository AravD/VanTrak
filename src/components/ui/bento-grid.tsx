import { type ComponentType, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const BentoGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("grid w-full auto-rows-[22rem] grid-cols-3 gap-4", className)}>
      {children}
    </div>
  );
};

interface BentoCardProps {
  name: string;
  className?: string;
  background?: ReactNode;
  Icon: ComponentType<{ className?: string }>;
  description: string;
  cta: string;
  /** Page-switch handler (this app navigates by state, not URL). */
  onClick?: () => void;
  /** Fallback link target if no onClick is provided. */
  href?: string;
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  cta,
  onClick,
  href,
}: BentoCardProps) => (
  <div
    className={cn(
      "group relative flex flex-col justify-between overflow-hidden rounded-xl",
      "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      className,
    )}
  >
    <div>{background}</div>
    <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-10">
      <Icon className="h-10 w-10 origin-left transform-gpu text-gray-700 transition-all duration-300 ease-in-out group-hover:scale-75" />
      <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
      <p className="max-w-lg text-sm text-gray-500">{description}</p>
    </div>

    <div className="pointer-events-none absolute bottom-0 flex w-full translate-y-10 transform-gpu flex-row items-center p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
      <Button
        variant="ghost"
        asChild={!onClick}
        size="sm"
        onClick={onClick}
        className="pointer-events-auto"
      >
        {onClick ? (
          <span className="inline-flex items-center">
            {cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        ) : (
          <a href={href ?? "#"}>
            {cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        )}
      </Button>
    </div>
    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03]" />
  </div>
);

export { BentoCard, BentoGrid };
