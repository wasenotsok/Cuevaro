import type { PGlite } from "@electric-sql/pglite";
import type { Actor } from "../../packages/domain/authority";
import type {
  ConfirmedFact,
  Lifecycle,
  Cue,
} from "../../packages/domain/purchase";
import type { ReviewedItem } from "../../packages/domain/review-items";
import { assertActor } from "./development";
const observationSql = `json_build_object('field',o.field_name,'value',o.value,'confidence',o.confidence,'evidenceId',o.evidence_id,'excerpt',o.source_locator->>'excerpt','source',o.source_locator->>'source','version',o.source_locator->>'version','reason',coalesce(o.source_locator->>'reason','requires_review'))::jsonb || case when o.source_locator ? 'pages' and o.source_locator->'pages'<>'null'::jsonb then jsonb_build_object('pages',o.source_locator->'pages') else '{}'::jsonb end || case when o.source_locator ? 'sources' and o.source_locator->'sources'<>'null'::jsonb then jsonb_build_object('sources',o.source_locator->'sources') else '{}'::jsonb end`;
export async function getRecords(db: PGlite, actor: Actor) {
  await assertActor(db, actor);
  const purchases = (
    await db.query<{
      id: string;
      capture_id: string;
      version: number;
      created_at: string;
    }>(
      "select * from purchases where household_id=$1 order by created_at desc limit 100",
      [actor.householdId],
    )
  ).rows;
  return Promise.all(
    purchases.map(async (p) => {
      const history = (
        await db.query<ConfirmedFact>(
          `select f.id,f.field_name as field,f.value,f.authority_type as authority,f.confirmed_by_user_id as "actorId",f.confirmed_at as "confirmedAt",f.supersedes_id as "supersedesId",${observationSql} as observation from fact_assertions f join observations o on o.id=f.source_observation_id and o.household_id=f.household_id where f.purchase_id=$1 and f.household_id=$2 and f.item_id is null order by array_position(array['merchant','purchaseDate','total','currency','item','returnDate','warrantyDate'],f.field_name),f.confirmed_at,f.id`,
          [p.id, actor.householdId],
        )
      ).rows;
      const superseded = new Set(
        history.flatMap((f) => (f.supersedesId ? [f.supersedesId] : [])),
      );
      const items = (
        await db.query<ReviewedItem>(
          `select i.id,f.value #>> '{}' as name,o.source_locator->>'candidateId' as "candidateId",f.authority_type as authority,${observationSql} as observation from items i join fact_assertions f on f.item_id=i.id and f.household_id=i.household_id join observations o on o.id=f.source_observation_id and o.household_id=f.household_id where i.purchase_id=$1 and i.household_id=$2 and not exists(select 1 from fact_assertions n where n.supersedes_id=f.id and n.household_id=f.household_id) order by i.id`,
          [p.id, actor.householdId],
        )
      ).rows;
      const events = (
        await db.query<Lifecycle>(
          `select kind,status,due_date::text as "dueDate",timezone,source_fact_ids as "sourceFactIds",rule_version as "ruleVersion" from lifecycle_events where purchase_id=$1 and household_id=$2 and status<>'superseded'`,
          [p.id, actor.householdId],
        )
      ).rows;
      const cues = (
        await db.query<Cue>(
          `select c.idempotency_key as id,e.kind,c.scheduled_for::text as "scheduledFor",e.due_date::text as "dueDate",c.state from cues c join lifecycle_events e on e.id=c.event_id and e.household_id=c.household_id where e.purchase_id=$1 and c.household_id=$2 order by c.scheduled_for,c.id`,
          [p.id, actor.householdId],
        )
      ).rows;
      return {
        id: p.id,
        captureId: p.capture_id,
        version: p.version,
        createdAt: p.created_at,
        facts: history.filter((f) => !superseded.has(f.id)),
        history,
        items,
        events,
        cues,
      };
    }),
  );
}
