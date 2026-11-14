import { useState } from "react";
import { formatMoneyInput, parseMoneyInput } from "./moneyFormat";

export default function ProjectBudgetField({ value, onChange, className, label, tourId }: {
  value: number;
  onChange: (value: number) => void;
  className: string;
  label: string;
  tourId?: string;
}) {
  const [text, setText] = useState(() => formatMoneyInput(String(value)));
  return <input
    data-tour={tourId}
    aria-label={label}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={text}
    onChange={(event) => {
      const next = formatMoneyInput(event.target.value);
      setText(next);
      onChange(parseMoneyInput(next));
    }}
    className={className}
  />;
}
