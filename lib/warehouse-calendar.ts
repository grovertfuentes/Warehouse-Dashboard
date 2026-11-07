import 'server-only';
import { createCalendarService } from './calendar-service.mjs';
import { readCalendarState,writeCalendarState } from './calendar-store';
import { readFeed } from './feed';
export const warehouseCalendar=createCalendarService({readState:readCalendarState,writeState:writeCalendarState,readFeed});
