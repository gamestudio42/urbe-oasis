import { useState } from 'react';
import { ERA_RANKS, OASIS_ERA, type CityStats } from '@city/shared';
import { qanatFactor } from '@city/simulation';
import { formatMoney, formatNumber, type Locale } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import { oasisEraCopy, oasisJourneyCopy } from './i18n';

type Era = NonNullable<NonNullable<NonNullable<CityStats['oasis']>['journey']>['era']>;

interface Row {
  id: 'residents' | 'water' | 'shade' | 'shelter' | 'reserves';
  label: string;
  value: string;
  met: boolean;
}

/** The next rank's goals, from engine statistics; the engine decides at the month close. */
function rankRows(stats: CityStats, era: Era, locale: Locale): Row[] {
  const goal = OASIS_ERA.ranks[era.rank];
  if (!goal || !stats.oasis) return [];
  const copy = oasisEraCopy(locale);
  const pct = (v: number) => `${formatNumber(Math.round(v * 100), locale)}%`;
  const rows: Row[] = [
    {
      id: 'residents',
      label: copy.rows.residents,
      value: `${formatNumber(stats.population, locale)} / ${formatNumber(goal.residents, locale)}`,
      met: stats.population >= goal.residents,
    },
    {
      id: 'water',
      label: copy.rows.water,
      value: `${pct(stats.water.served)} / ${pct(goal.water)}`,
      met: stats.water.served >= goal.water,
    },
    {
      id: 'shade',
      label: copy.rows.shade,
      value: `${pct(stats.oasis.data.served)} / ${pct(goal.shade)}`,
      met: stats.oasis.data.served >= goal.shade,
    },
    {
      id: 'shelter',
      label: copy.rows.shelter,
      value: `${pct(stats.oasis.windbreak)} / ${pct(goal.shelter)}`,
      met: stats.oasis.windbreak >= goal.shelter,
    },
  ];
  if (goal.banks > 0)
    rows.push({
      id: 'reserves',
      label: copy.rows.reserves(
        `${formatNumber(era.banks, locale)}/${formatNumber(goal.banks, locale)}`,
      ),
      value: `${pct(era.charge)} / ${pct(goal.charge)}`,
      met: era.banks >= goal.banks && era.charge >= goal.charge,
    });
  return rows;
}

/** The heading of the guide once the journey is over: the city's title. */
export function eraHeading(era: Era, locale: Locale): { small: string; title: string } {
  const copy = oasisEraCopy(locale);
  return { small: copy.label, title: copy.titles[era.rank] ?? copy.titles[ERA_RANKS]! };
}

export function OasisEra({ session, era }: { session: GameSession; era: Era }) {
  const locale = useStore(session.ui, (s) => s.locale);
  const stats = useStore(session.ui, (s) => s.stats);
  const [pending, setPending] = useState(false);
  if (!stats?.oasis) return null;
  const copy = oasisEraCopy(locale);
  const journeyCopy = oasisJourneyCopy(locale);
  const money = (v: number) => formatMoney(v, locale);
  const pct = (v: number) => `${formatNumber(Math.round(v * 100), locale)}%`;
  const goal = OASIS_ERA.ranks[era.rank];
  const rows = rankRows(stats, era, locale);
  const running = era.droughtMonthsLeft > 0;
  const policy = stats.oasis.waterPolicy;
  const ration = async () => {
    setPending(true);
    try {
      await session.command({ type: 'setWaterRationing', enabled: !policy.enabled });
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="oasis-journey" data-testid="oasis-era" data-rank={era.rank}>
      <p className="oasis-guide-action">{goal ? copy.intro : copy.capital}</p>
      {goal && (
        <>
          <strong data-testid="oasis-era-next">{copy.next(copy.titles[era.rank + 1]!)}</strong>
          <ul className="oasis-journey-rows">
            {rows.map((row) => (
              <li key={row.id} data-testid={`oasis-era-row-${row.id}`} data-met={row.met}>
                <AdobeIcon id={row.met ? 'check' : 'chronicle'} size={16} />
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
          <p className="oasis-journey-reward">
            <AdobeIcon id="budget" size={16} /> {copy.reward}: <b>{money(goal.reward)}</b>
          </p>
        </>
      )}
      <div
        className="oasis-drought"
        data-testid="oasis-era-drought"
        data-state={running ? 'active' : era.droughtIn <= 1 ? 'soon' : 'later'}
      >
        <strong>
          <AdobeIcon id="warning" size={16} />{' '}
          {running
            ? copy.droughtNow(formatNumber(era.droughtMonthsLeft, locale))
            : era.droughtIn <= 1
              ? copy.droughtSoon
              : copy.droughtNext(formatNumber(era.droughtIn, locale))}
        </strong>
        <p data-testid="oasis-era-drought-detail">
          {copy.droughtDetail(
            formatNumber(era.droughtLength, locale),
            pct(era.droughtFactor),
            pct(qanatFactor(era.droughtFactor)),
          )}
        </p>
        {running && era.droughtServed >= 0 && (
          <p>
            {copy.droughtServed}: <b>{pct(era.droughtServed)}</b>
          </p>
        )}
        <p>{copy.droughtGrant(money(era.droughtReward))}</p>
        {(running || era.droughtIn <= 1) && (
          <button
            type="button"
            className="button small"
            data-testid="oasis-era-ration"
            aria-pressed={policy.enabled}
            disabled={pending}
            onClick={() => void ration()}
          >
            <AdobeIcon id="settings" size={16} />
            {policy.enabled ? journeyCopy.rationOff : journeyCopy.rationOn}
          </button>
        )}
      </div>
      {era.droughts > 0 && (
        <p className="oasis-journey-note" data-testid="oasis-era-record">
          {copy.record(formatNumber(era.held, locale), formatNumber(era.droughts, locale))}
        </p>
      )}
    </div>
  );
}
