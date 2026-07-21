export interface ScoreDetail {
  score: number;
  status: 'completed' | 'partial' | 'untracked' | 'insufficient';
  trackedCount: number;
  totalCount: number;
  positives: string[];
  negatives: string[];
  recommendation: string;
}

export interface DailyScores {
  wellness: ScoreDetail;
  discipline: ScoreDetail;
  deen: ScoreDetail;
  overallAlignment: number;
  selfControl?: {
    score: number | 'untracked';
    urgesToday: number;
    resistedToday: number;
    relapsesToday: number;
  };
}
