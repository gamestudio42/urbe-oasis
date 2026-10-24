import {
  BALANCE,
  DEPARTMENTS,
  EXPENSE_CATEGORIES,
  TICKS_PER_MONTH,
  type ZoneBuildingKind,
} from '@city/shared';
import { formatMoney, months, useStrings } from '../i18n';
import type { GameSession } from '../state/session';
import { useStore } from '../state/store';
import { Panel } from './Panel';

const ZONES: ZoneBuildingKind[] = ['residential', 'commercial', 'industrial'];

export function BudgetPanel({ session }: { session: GameSession }) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const stats = useStore(session.ui, (s) => s.stats);
  if (!stats) return null;
  const b = t.budget;
  const money = (value: number) => formatMoney(value, locale);
  const report = stats.lastMonth;
  const revenue = ZONES.reduce((sum, z) => sum + report.revenue[z], 0);
  const expenses = EXPENSE_CATEGORIES.reduce((sum, c) => sum + report.expenses[c], 0);

  const hasReport = stats.tick >= TICKS_PER_MONTH;
  const monthsPerYear = BALANCE.clock.monthsPerYear;
  const previousMonth = (stats.month + monthsPerYear - 1) % monthsPerYear;
  const reportYear = stats.year - (stats.month === 0 ? 1 : 0);
  return (
    <Panel
      title={b.title}
      testId="budget-panel"
      onClose={() => session.closePanel()}
      closeLabel={t.ui.close}
      className="budget-panel"
    >
      {stats.bankrupt && <p className="alert bad">{b.bankrupt}</p>}
      {!stats.bankrupt && stats.monthsInDebt > 0 && (
        <p className="alert warn">{b.debtWarning(stats.monthsInDebt)}</p>
      )}
      <p className="report-period" data-testid="budget-period">
        {hasReport ? `${b.period} · ${months(locale)[previousMonth]} ${reportYear}` : b.noReport}
      </p>
      <div className="budget-overview">
        <div>
          <span>{b.revenue}</span>
          <strong data-testid="budget-revenue">{hasReport ? money(revenue) : '—'}</strong>
        </div>
        <div>
          <span>{b.expenses}</span>
          <strong data-testid="budget-expenses">{hasReport ? money(expenses) : '—'}</strong>
        </div>
        <div className="budget-balance">
          <span>{b.net}</span>
          <strong className={report.net < 0 ? 'bad' : 'good'} data-testid="budget-net">
            {hasReport ? money(report.net) : '—'}
          </strong>
        </div>
      </div>
      <div className="budget-controls">
        <section className="management-section">
          <h3>{b.taxes}</h3>
          <p className="muted small">{b.taxHint}</p>
          {ZONES.map((zone) => (
            <label key={zone} className="slider-row">
              <span>{t.zones[zone]}</span>
              <input
                type="range"
                min={0}
                max={BALANCE.economy.taxMax}
                step={1}
                value={stats.taxes[zone]}
                onChange={(e) =>
                  void session.command({ type: 'setTax', zone, rate: Number(e.target.value) })
                }
                data-testid={`tax-${zone}`}
              />
              <output>{stats.taxes[zone]}%</output>
            </label>
          ))}
        </section>
        <section className="management-section">
          <h3>{b.funding}</h3>
          {DEPARTMENTS.map((department) => (
            <label key={department} className="slider-row">
              <span>{t.departments[department]}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={stats.funding[department]}
                onChange={(e) =>
                  void session.command({
                    type: 'setFunding',
                    department,
                    value: Number(e.target.value),
                  })
                }
                data-testid={`funding-${department}`}
              />
              <output>{stats.funding[department]}%</output>
            </label>
          ))}
        </section>
      </div>
      <div className="budget-columns">
        <table className="ledger">
          <caption>{b.revenue}</caption>
          <tbody>
            {ZONES.map((z) => (
              <tr key={z}>
                <th>{t.zones[z]}</th>
                <td>{money(report.revenue[z])}</td>
              </tr>
            ))}
            <tr className="total">
              <th>{b.total}</th>
              <td>{money(revenue)}</td>
            </tr>
          </tbody>
        </table>
        <table className="ledger">
          <caption>{b.expenses}</caption>
          <tbody>
            {EXPENSE_CATEGORIES.map((c) => (
              <tr key={c}>
                <th>{t.expenses[c]}</th>
                <td>{money(report.expenses[c])}</td>
              </tr>
            ))}
            <tr className="total">
              <th>{b.total}</th>
              <td>{money(expenses)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <dl className="budget-summary">
        <dt>{b.construction}</dt>
        <dd>{money(report.construction)}</dd>
        <dt>
          {b.annualized}
          <small className="fact-note">{b.annualHint}</small>
        </dt>
        <dd className={report.net < 0 ? 'bad' : 'good'}>
          {hasReport ? money(report.net * monthsPerYear) : '—'}
        </dd>
      </dl>
    </Panel>
  );
}
