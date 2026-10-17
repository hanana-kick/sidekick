import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <Field orientation="horizontal" className="color-field">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <div className="color-value"><span>{value.toUpperCase()}</span><Input id={id} type="color" value={value} aria-label={label} onInput={event => onChange(event.currentTarget.value)} /></div>
  </Field>;
}
export function RangeField({ id, label, value, min, max, step = 1, suffix = '', format, onChange, description }: {
  id: string; label: string; value: number; min: number; max: number; step?: number; suffix?: string;
  format?: (value: number) => string; onChange: (value: number) => void; description?: ReactNode;
}) {
  const formatted = format ? format(value) : `${Math.round(value)}${suffix}`;
  return <Field className="range-field">
    <div className="range-heading"><FieldLabel id={`${id}-label`} htmlFor={id}>{label}</FieldLabel><output htmlFor={id}>{formatted}</output></div>
    <Slider id={`${id}-root`} thumbProps={{ id, "aria-labelledby": `${id}-label`, "aria-valuetext": formatted }} value={[value]} min={min} max={max} step={step} onValueChange={values => { if (values[0] !== undefined) onChange(values[0]); }} />
    {description && <FieldDescription>{description}</FieldDescription>}
  </Field>;
}
export function ChoiceField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: readonly { value: string; label: string; disabled?: boolean }[] }) {
  return <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{options.map(option => <SelectItem key={option.value} value={option.value} data-value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>
  </Field>;
}
