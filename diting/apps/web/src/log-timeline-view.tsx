import { useMemo, useState } from "react";
import { useI18n } from "./i18n";
import {
  sortLogTimelineItems,
  type LogTimelineItem,
  type LogTimelineSortDirection
} from "./log-timeline";

export function LogTimelineView(props: {
  items: LogTimelineItem[];
  defaultDirection?: LogTimelineSortDirection;
  formatDate(value: string): string;
  loading?: boolean;
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
}) {
  const { t } = useI18n();
  const [sortDirection, setSortDirection] = useState<LogTimelineSortDirection>(props.defaultDirection ?? "desc");
  const sortedItems = useMemo(
    () => sortLogTimelineItems(props.items, sortDirection),
    [props.items, sortDirection]
  );

  return (
    <section className="log-timeline-section">
      <div className="subpanel-header log-timeline-header">
        <div>
          <h3>{props.title ?? t("logTimeline.title")}</h3>
          <p className="meta log-timeline-subtitle">{props.subtitle ?? t("logTimeline.subtitle")}</p>
        </div>
        <div className="log-timeline-controls">
          <span className="log-timeline-count">{sortedItems.length}</span>
          <button
            className="secondary-button log-timeline-sort-toggle"
            onClick={() => setSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
            type="button"
          >
            {sortDirection === "desc" ? t("logTimeline.viewFromStart") : t("logTimeline.viewLatestFirst")}
          </button>
        </div>
      </div>
      {props.loading ? <p className="meta">{t("tasks.loadingDetail")}</p> : null}
      <div className="log-timeline-list">
        {sortedItems.map((item) => (
          <article className={`log-timeline-item log-timeline-tone-${item.tone}`} key={item.id}>
            <div className="log-timeline-item-body">
              <div className="log-timeline-item-head">
                <p className="log-timeline-item-title">{item.title}</p>
                <span className={`log-timeline-source log-timeline-source-${item.source}`}>
                  {t(`logTimeline.source.${item.source}`)}
                </span>
                <span className={`event-pill event-${item.tone}`}>{item.tone}</span>
              </div>
              <p className="meta log-timeline-item-message">{item.message}</p>
              {item.context.length > 0 ? (
                <p className="mono log-timeline-item-context">{item.context.join(" · ")}</p>
              ) : null}
            </div>
            <p className="mono log-timeline-item-time">
              {item.occurredAt ? props.formatDate(item.occurredAt) : t("common.live")}
            </p>
          </article>
        ))}
        {sortedItems.length === 0 && !props.loading ? (
          <div className="empty-state">{props.emptyMessage ?? t("logTimeline.empty")}</div>
        ) : null}
      </div>
    </section>
  );
}
