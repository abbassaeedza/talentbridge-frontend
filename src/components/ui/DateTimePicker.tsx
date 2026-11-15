import type { CalendarDateTime } from '@internationalized/date';
import { useContext, useLayoutEffect, useMemo } from 'react';
import { DateFieldStateContext } from 'react-aria-components/DateField';
import { Calendar } from '@heroui/react/calendar';
import { DateField } from '@heroui/react/date-field';
import { DatePicker } from '@heroui/react/date-picker';
import { Label } from '@heroui/react/label';
import { Description } from '@heroui/react/description';
import { DISPLAY_TIME_ZONE, fromPickerDateTime, toPickerDateTime } from '../../utils/dateTime';

export default function DateTimePicker({ label, value, onChange, onValidityChange, isDisabled = false, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
  isDisabled?: boolean;
  className?: string;
}) {
  const date = useMemo(() => toPickerDateTime(value), [value]);
  return (
    <DatePicker.Root<CalendarDateTime> className={className} granularity='minute' value={date} onChange={(next) => onChange(fromPickerDateTime(next?.set({ second: 0, millisecond: 0 }) ?? null))} isDisabled={isDisabled} isInvalid={!!value && !date}>
      <Label className='truncate text-sm' title={label}>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <>
          <DateField.Segment segment={segment} />
          {segment.type === 'day' && <DateValidity onChange={onValidityChange} />}
        </>}</DateField.Input>
        <DateField.Suffix><DatePicker.Trigger aria-label={`Choose ${label.toLowerCase()}`}><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
      </DateField.Group>
      <Description className='text-xs text-muted'>{DISPLAY_TIME_ZONE} (UTC+05:00)</Description>
      <DatePicker.Popover>
        <Calendar>
          <Calendar.Header><Calendar.NavButton slot='previous' /><Calendar.Heading /><Calendar.NavButton slot='next' /></Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker.Root>
  );
}

function DateValidity({ onChange }: { onChange: (valid: boolean) => void }) {
  const state = useContext(DateFieldStateContext)!;
  const segments = state.segments.filter((segment) => segment.isEditable);
  // Partial edits do not emit DatePicker.onChange, so report their public field state separately.
  const valid = !state.realtimeValidation.isInvalid && (segments.every((segment) => segment.isPlaceholder) ||
    segments.every((segment) => !segment.isPlaceholder && (segment.value == null ||
      ((segment.minValue == null || segment.value >= segment.minValue) && (segment.maxValue == null || segment.value <= segment.maxValue)))));
  useLayoutEffect(() => onChange(valid), [valid, onChange]);
  return null;
}
