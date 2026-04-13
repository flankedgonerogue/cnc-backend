import { registerEnumType } from '@nestjs/graphql';

export enum DashboardPeriod {
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

registerEnumType(DashboardPeriod, {
  name: 'DashboardPeriod',
  description:
    'WEEK = rolling last 7 days vs prior 7 days; MONTH = rolling last 30 days vs prior 30 days',
});
