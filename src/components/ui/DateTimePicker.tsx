import { parseDateTime, type CalendarDateTime } from '@internationalized/date';
import { Calendar } from '@heroui/react/calendar';
import { DateField } from '@heroui/react/date-field';
import { DatePicker } from '@heroui/react/date-picker';
import { Label } from '@heroui/react/label';

function parseValue(value: string) {
  if (!value) return null;
  try {
    return parseDateTime(value.slice(0, 19));
  } catch {
    return null;
  }
}

export default function DateTimePicker({ label, value, onChange, isDisabled = false, className }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <DatePicker.Root<CalendarDateTime> className={className} granularity='minute' value={parseValue(value)} onChange={(next) => onChange(next?.toString() ?? '')} isDisabled={isDisabled}>
      <Label className='truncate text-sm' title={label}>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix><DatePicker.Trigger aria-label={`Choose ${label.toLowerCase()}`}><DatePicker.TriggerIndicator /></DatePicker.Trigger></DateField.Suffix>
      </DateField.Group>
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
