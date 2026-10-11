"use client";
import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./ui/input";
import { useLanguage } from "./language";
export function PasswordInput({
  id,
  className = "",
  type: _type,
  ...props
}: ComponentProps<"input">) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = useState(false);
  const { t } = useLanguage();
  return (
    <div className="relative">
      <Input
        {...props}
        id={fieldId}
        type={visible ? "text" : "password"}
        className={`pr-12 ${className}`}
      />
      <button
        type="button"
        disabled={props.disabled}
        aria-controls={fieldId}
        aria-pressed={visible}
        aria-label={t(visible ? "Hide password" : "Show password")}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
