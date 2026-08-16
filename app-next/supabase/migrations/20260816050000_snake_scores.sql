-- Scores Koulèv : classement public des meilleures parties authentifiées.
CREATE TABLE IF NOT EXISTS public.snake_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pseudo VARCHAR(30) NOT NULL DEFAULT 'Joueur',
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 100000),
  skin INTEGER NOT NULL DEFAULT 0 CHECK (skin BETWEEN 0 AND 20),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snake_scores_ranking
  ON public.snake_scores(score DESC, played_at ASC);

ALTER TABLE public.snake_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snake_scores_select_public" ON public.snake_scores;
CREATE POLICY "snake_scores_select_public"
  ON public.snake_scores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "snake_scores_insert_own" ON public.snake_scores;
CREATE POLICY "snake_scores_insert_own"
  ON public.snake_scores FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

GRANT SELECT ON public.snake_scores TO anon, authenticated;
GRANT INSERT ON public.snake_scores TO authenticated;
