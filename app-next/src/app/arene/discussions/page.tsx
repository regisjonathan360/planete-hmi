import { createClient } from "@/lib/supabase/server";
import { formatRelativeDate } from "@/lib/arene/date-utils";
import styles from "./page.module.css";

/**
 * DiscussionsPage — Page des fils de discussion.
 * Server component qui :
 * - Récupère les threads (discussions libres + liés à des contenus)
 * - Affiche une carte par thread avec : titre/sujet, dernier commentaire,
 *   nombre de commentaires, dernière activité
 *
 * Requirements: 4.1, 4.3, 12.2
 */

interface ThreadSummary {
  thread_type: string;
  thread_id: string;
  title: string;
  comment_count: number;
  latest_comment_body: string | null;
  latest_comment_date: string | null;
}

// Type labels for thread origin
const THREAD_TYPE_LABELS: Record<string, string> = {
  song: "Chanson",
  battle: "Battle",
  challenge: "Défi",
  free: "Discussion libre",
};

export default async function DiscussionsPage() {
  const supabase = await createClient();

  // Fetch active threads by aggregating comments.
  // We fetch unique thread combos with their latest activity and count.
  const { data: threads } = await supabase.rpc("get_discussion_threads", {
    p_limit: 50,
  });

  // Fallback: if the RPC doesn't exist, fetch from comments directly
  let threadList: ThreadSummary[] = [];

  if (threads && Array.isArray(threads)) {
    threadList = threads as ThreadSummary[];
  } else {
    // Fallback query: group comments by thread
    const { data: comments } = await supabase
      .from("comments")
      .select("thread_type, thread_id, body, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(200);

    if (comments && comments.length > 0) {
      // Group by thread
      const threadMap = new Map<string, ThreadSummary>();

      for (const c of comments) {
        const key = `${c.thread_type}:${c.thread_id}`;
        const existing = threadMap.get(key);
        if (existing) {
          existing.comment_count++;
        } else {
          threadMap.set(key, {
            thread_type: c.thread_type,
            thread_id: c.thread_id,
            title: getThreadTitle(c.thread_type, c.thread_id),
            comment_count: 1,
            latest_comment_body: c.body,
            latest_comment_date: c.created_at,
          });
        }
      }

      threadList = Array.from(threadMap.values());
    }
  }

  // Separate free discussions from linked threads
  const freeThreads = threadList.filter((t) => t.thread_type === "free");
  const linkedThreads = threadList.filter((t) => t.thread_type !== "free");

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Discussions</h1>

      {threadList.length === 0 && (
        <p className={styles.emptyMessage}>
          Aucune discussion pour le moment. Lancez la première !
        </p>
      )}

      {/* Linked threads (songs, battles, challenges) */}
      {linkedThreads.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Discussions liées</h2>
          <div className={styles.threadsList}>
            {linkedThreads.map((thread) => (
              <ThreadCard key={`${thread.thread_type}:${thread.thread_id}`} thread={thread} />
            ))}
          </div>
        </section>
      )}

      {/* Free discussions */}
      {freeThreads.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Discussions libres</h2>
          <div className={styles.threadsList}>
            {freeThreads.map((thread) => (
              <ThreadCard key={`${thread.thread_type}:${thread.thread_id}`} thread={thread} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- ThreadCard (server sub-component) ---

function ThreadCard({ thread }: { thread: ThreadSummary }) {
  const typeLabel = THREAD_TYPE_LABELS[thread.thread_type] ?? thread.thread_type;

  return (
    <article className={styles.threadCard} aria-label={`Discussion : ${thread.title}`}>
      <div className={styles.threadHeader}>
        <h3 className={styles.threadTitle}>{thread.title}</h3>
        <span className={styles.threadType}>{typeLabel}</span>
      </div>

      {thread.latest_comment_body && (
        <p className={styles.threadPreview}>
          {thread.latest_comment_body.length > 120
            ? `${thread.latest_comment_body.slice(0, 120)}…`
            : thread.latest_comment_body}
        </p>
      )}

      <div className={styles.threadMeta}>
        <span className={styles.threadMetaItem}>
          💬 {thread.comment_count} commentaire{thread.comment_count !== 1 ? "s" : ""}
        </span>
        {thread.latest_comment_date && (
          <span className={styles.threadMetaItem}>
            🕐 {formatRelativeDate(thread.latest_comment_date)}
          </span>
        )}
      </div>
    </article>
  );
}

// --- Helper ---

function getThreadTitle(threadType: string, threadId: string): string {
  // In a complete implementation, this would fetch the entity title.
  // For now, use a descriptive fallback.
  const prefix = THREAD_TYPE_LABELS[threadType] ?? "Discussion";
  return `${prefix} #${threadId.slice(0, 8)}`;
}
