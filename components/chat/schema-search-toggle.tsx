"use client";

import { DatabaseIcon } from "lucide-react";
import { memo, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveChat } from "@/hooks/use-active-chat";
import { cn } from "@/lib/utils";

function PureSchemaSearchToggle() {
  const { schemaSearchEnabled, setSchemaSearchEnabled } = useActiveChat();

  const handleToggle = useCallback(() => {
    setSchemaSearchEnabled(!schemaSearchEnabled);
  }, [schemaSearchEnabled, setSchemaSearchEnabled]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-pressed={schemaSearchEnabled}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-xl px-2.5 text-xs transition-colors",
            schemaSearchEnabled
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
          )}
          data-testid="schema-search-toggle"
          onClick={handleToggle}
          type="button"
        >
          <DatabaseIcon className="size-3.5" />
          <span className="font-medium">
            Schema {schemaSearchEnabled ? "on" : "off"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {schemaSearchEnabled
          ? "Schema search on: verifies tables and columns against the Fusion catalog before writing SQL"
          : "Schema search off: relies on model knowledge only (unverified table and column names)"}
      </TooltipContent>
    </Tooltip>
  );
}

export const SchemaSearchToggle = memo(PureSchemaSearchToggle);
