import { useState } from 'react';
import { JOURNEY_CHAPTERS, OASIS_JOURNEY, type CityStats } from '@city/shared';
import { formatMoney, formatNumber, useStrings, type Locale } from '@oasis/web/i18n';
import type { GameSession } from '@oasis/web/state/session';
import { useStore } from '@oasis/web/state/store';
import { toolById, type ToolId } from '@oasis/web/tools/tools';
import { costLabel } from '@oasis/web/ui/Toolbar';
import { ToolIcon } from '@oasis/web/ui/icons';
import { AdobeIcon } from '@oasis/web/ui/adobeIcons';
import { oasisJourneyCopy } from './i18n';
import { OasisEra, eraHeading } from './OasisEra';

type Journey = NonNullable<NonNullable<CityStats['oasis']>['journey']>;

/** Tools that answer each chapter, in the order a player would use them. */
const CHAPTER_TOOLS: readonly (readonly ToolId[])[] = [
  ['zoneResLight', 'pipe', 'canal'],
  ['qanat', 'cistern', 'powerLine'],
  ['windbreak', 'powerLine'],
  ['qanat', 'cistern'],
  ['caravanserai', 'road'],
];

interface Row {
  id: 'residents' | 'water' | 'shade' | 'reserves' | 'shelter' | 'caravanserai';
  value: string;
  met: boolean;
}

/** Live goal rows, read from engine statistics; the engine decides completion at month close. */
function rows(stats: CityStats, journey: Journey, locale: Locale): Row[] {
  const j = OASIS_JOURNEY;
  const pct = (v: number) => `${formatNumber(Math.round(v * 100), locale)}%`;
  // With no consumers a share reads 100%; show a dash until someone needs the service.
  const share = (id: Row['id'], served: number, demand: number, target: number): Row =>
    demand > 0
      ? { id, value: `${pct(served)} / ${pct(target)}`, met: served >= target }
      : { id, value: `— / ${pct(target)}`, met: false };
  const water = share('water', stats.water.served, stats.water.demand, j.servedShare);
  switch (journey.chapter) {
    case 0:
      return [
        {
          id: 'residents',
          value: `${formatNumber(stats.population, locale)} / ${formatNumber(j.residents, locale)}`,
          met: stats.population >= j.residents,
        },
        water,
        share('shade', stats.oasis!.data.served, stats.oasis!.data.demand, j.servedShare),
      ];
    case 1:
      return [
        water,
        {
          id: 'reserves',
          value: `${formatNumber(journey.reserves, locale)} / ${formatNumber(j.reserveBanks, locale)}`,
          met: journey.reserves >= j.reserveBanks,
        },
      ];
    case 2:
      return [
        {
          id: 'shelter',
          value: `${pct(stats.oasis!.windbreak)} / ${pct(j.shelter)}`,
          met: stats.oasis!.windbreak >= j.shelter,
        },
      ];
    case 3:
      return [share('water', stats.water.served, stats.water.demand, j.droughtTarget)];
    case 4:
      return [
        {
          id: 'caravanserai',
          value: `${formatNumber(journey.caravanserais, locale)} / 1`,
          met: journey.caravanserais > 0,
        },
      ];
    default:
      return [];
  }
}

/** The collapsed guide's title and subtitle while the journey runs. */
export function journeyHeading(journey: Journey, locale: Locale): { small: string; title: string } {
  const copy = oasisJourneyCopy(locale);
  if (journey.chapter >= JOURNEY_CHAPTERS && journey.era) return eraHeading(journey.era, locale);
  if (journey.chapter >= JOURNEY_CHAPTERS) return { small: copy.label, title: copy.done };
  return {
    small: `${copy.label} · ${copy.progress(formatNumber(journey.chapter + 1, locale))}`,
    title: copy.chapters[journey.chapter]!.title,
  };
}

export function OasisJourney({
  session,
  journey,
  onTool,
}: {
  session: GameSession;
  journey: Journey;
  onTool: (tool: ToolId) => void;
}) {
  const t = useStrings(session.ui);
  const locale = useStore(session.ui, (s) => s.locale);
  const stats = useStore(session.ui, (s) => s.stats);
  const active = useStore(session.ui, (s) => s.tool);
  const [pending, setPending] = useState(false);
  if (!stats?.oasis) return null;
  const copy = oasisJourneyCopy(locale);
  const money = (v: number) => formatMoney(v, locale);
  if (journey.chapter >= JOURNEY_CHAPTERS && journey.era)
    return <OasisEra session={session} era={journey.era} />;
  if (journey.chapter >= JOURNEY_CHAPTERS)
    return (
      <div className="oasis-journey" data-testid="oasis-journey" data-chapter={journey.chapter}>
        <p className="oasis-guide-action">{copy.doneText}</p>
        {journey.droughtOutcome >= 0 && (
          <p className="oasis-journey-note">
            {journey.droughtOutcome === 1 ? copy.droughtHeld : copy.droughtShort}
          </p>
        )}
      </div>
    );
  const chapter = copy.chapters[journey.chapter]!;
  const reward =
    journey.chapter === 3
      ? copy.droughtReward(
          money(OASIS_JOURNEY.rewards[3]!),
          money(OASIS_JOURNEY.droughtShortReward),
        )
      : money(OASIS_JOURNEY.rewards[journey.chapter]!);
  const goals = rows(stats, journey, locale);
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
    <div className="oasis-journey" data-testid="oasis-journey" data-chapter={journey.chapter}>
      <p className="oasis-guide-action" data-testid="oasis-journey-action">
        {chapter.action}
      </p>
      {goals.length > 0 && (
        <ul className="oasis-journey-rows">
          {goals.map((row) => (
            <li key={row.id} data-testid={`oasis-journey-row-${row.id}`} data-met={row.met}>
              <AdobeIcon id={row.met ? 'check' : 'chronicle'} size={16} />
              <span>{copy.rows[row.id]}</span>
              <strong>{row.value}</strong>
            </li>
          ))}
        </ul>
      )}
      {journey.chapter === 3 && (
        <div
          className="oasis-drought"
          data-testid="oasis-drought"
          data-state={journey.droughtMonthsLeft > 0 ? 'active' : 'soon'}
        >
          <strong>
            <AdobeIcon id="warning" size={16} />{' '}
            {journey.droughtMonthsLeft > 0
              ? copy.droughtNow(formatNumber(journey.droughtMonthsLeft, locale))
              : copy.droughtSoon}
          </strong>
          {journey.droughtServed >= 0 && (
            <p data-testid="oasis-drought-served">
              {copy.droughtServed}:{' '}
              <b>{formatNumber(Math.round(journey.droughtServed * 100), locale)}%</b> ·{' '}
              {copy.droughtTarget}
            </p>
          )}
          <button
            type="button"
            className="button small"
            data-testid="oasis-drought-ration"
            aria-pressed={policy.enabled}
            disabled={pending}
            onClick={() => void ration()}
          >
            <AdobeIcon id="settings" size={16} />
            {policy.enabled ? copy.rationOff : copy.rationOn}
          </button>
        </div>
      )}
      <p className="oasis-journey-reward" data-testid="oasis-journey-reward">
        <AdobeIcon id="budget" size={16} /> {copy.reward}: <b>{reward}</b>
      </p>
      <div className="oasis-guide-tools">
        {CHAPTER_TOOLS[journey.chapter]!.map((tool, index) => (
          <button
            key={tool}
            type="button"
            data-testid={`oasis-journey-tool-${tool}`}
            aria-pressed={active === tool}
            className="oasis-guide-tool"
            onClick={() => onTool(tool)}
          >
            <span className="oasis-guide-order" aria-hidden="true">
              {index + 1}
            </span>
            <ToolIcon id={tool} style={session.renderer.theme.style} />
            <span>
              <strong>{t.tools[tool]}</strong>
              <small>{costLabel(toolById(tool), t, locale)}</small>
            </span>
            {active === tool && <AdobeIcon id="check" size={16} />}
          </button>
        ))}
      </div>
      <details className="oasis-guide-details">
        <summary>{copy.why}</summary>
        <p>{chapter.why}</p>
      </details>
    </div>
  );
}
