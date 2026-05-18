import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, X } from "lucide-react";
import { MTOP_OUTCOMES, bubbleClassForSub, dotClassForSub } from "@/components/read-only-plan-view";

export function MtopOutcomePicker({
  value,
  onChange,
  label = "MTOP Outcomes",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  function toggle(subId: string) {
    if (value.includes(subId)) {
      onChange(value.filter((id) => id !== subId));
    } else {
      onChange([...value, subId]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[2rem]">
        {value.map((subId) => (
          <span
            key={subId}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${bubbleClassForSub(subId)}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClassForSub(subId)}`} />
            {subId}
            <button
              type="button"
              onClick={() => toggle(subId)}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 flex items-center justify-center transition-colors shrink-0"
              title={`Add ${label}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-2 max-h-[70vh] overflow-y-auto"
            align="start"
            onWheel={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-muted-foreground mb-2 px-1 sticky top-0 bg-white z-10">
              {label}
            </p>
            <div className="space-y-2">
              {MTOP_OUTCOMES.map((o) => (
                <div key={o.id}>
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${o.dot}`} />
                    <span className="text-xs font-semibold">{o.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{o.title}</span>
                  </div>
                  <div className="space-y-0.5 pl-3">
                    {o.sub.map((s) => {
                      const selected = value.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggle(s.id)}
                          className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-start gap-1.5 ${
                            selected
                              ? `${bubbleClassForSub(s.id)} border`
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ${dotClassForSub(s.id)}`} />
                          <span className="font-semibold shrink-0">{s.id}</span>
                          <span className="text-muted-foreground leading-tight">{s.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground italic">None selected — click + to add</span>
        )}
      </div>
    </div>
  );
}
