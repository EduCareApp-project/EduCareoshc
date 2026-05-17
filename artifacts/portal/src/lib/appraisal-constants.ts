export const COMPETENCIES = [
  { key: "initiative", label: "Initiative", description: "Implies the ability to actively influence events rather than passively accept things, to see opportunities and act on them." },
  { key: "self_motivation", label: "Self-Motivation", description: "The ability to drive yourself to achieve success and organise your workload to meet deadlines and desired outcomes." },
  { key: "team_work", label: "Team Work", description: "Implies a willingness to participate as a full member of a team in which you are not necessarily the leader." },
  { key: "planning", label: "Planning", description: "Has the ability to establish efficiently an appropriate course of action for yourself and others to accomplish a goal." },
  { key: "integrity", label: "Integrity", description: "Implies the ability and willingness to model the highest standards of personal and professional behaviour in all job related activities." },
  { key: "time_management", label: "Time Management", description: "Implies the ability to manage time effectively to meet deadlines without having to sacrifice work quality or output." },
  { key: "commitment", label: "Commitment", description: "Have belief in your role and its value to the organisation. Make an extra effort, though it may not always be in your own self interest." },
  { key: "sociability", label: "Sociability", description: "Implies a level of social confidence and ease when with others. Talkative, outgoing and participative." },
  { key: "verbal_communication", label: "Verbal Communication", description: "A clear, effective speaker, able to express your point of view with clarity and succinctness." },
  { key: "written_communication", label: "Written Communication", description: "Has the ability to express ideas clearly in writing, using good grammatical form, and in such a way as to be clearly understood." },
  { key: "adaptability", label: "Adaptability", description: "Implies the ability to remain effective within a changing environment such as when faced with new tasks, responsibilities or people." },
] as const;

export const POSITION_REVIEW = [
  { key: "optimal_care", label: "Optimal Care", description: "Ensure that all children attending are provided optimal care at all times with a focus on a safe and secure environment delivered through a structured, well balanced Program." },
  { key: "implement_procedures", label: "Implement Procedures", description: "Implement daily format according to all operating procedures, standards, guidelines and policies; and as instructed by the Program Manager." },
  { key: "supervise_children", label: "Supervise & Assist", description: "Supervise and assist the children in the program activities supporting their development and enjoyment." },
  { key: "clean_environment", label: "Environment Standards", description: "At all times, ensure the working environment is kept clean, tidy, hygienic and safe for all children, staff, parents and visitors to the Program." },
  { key: "punctuality", label: "Punctuality & Readiness", description: "Always turn up to work on time and ready to start the Program." },
] as const;

export const PERFORMANCE_DEV_QUESTIONS = [
  { key: "like_most", question: "What do you like most about your role?" },
  { key: "like_least", question: "What do you like least about your role?" },
  { key: "achievements", question: "What do you feel your major achievements have been in the last 12 months?" },
  { key: "could_do_better", question: "What do you feel you could have done better in the last 12 months?" },
] as const;

export const UPWARD_APPRAISAL_SECTIONS = [
  {
    key: "manager",
    label: "Your Manager",
    statements: [
      { key: "acts_on_suggestions", statement: "Is interested and acts on my suggestions and/or ideas for improvement." },
      { key: "communicates_priorities", statement: "Communicates and explains priorities and expectations around my work." },
      { key: "fair_respectful", statement: "Is fair and respectful of me and my position." },
      { key: "values_position", statement: "Values my position within the business." },
      { key: "understands_targets", statement: "Helps me to understand company targets and goals." },
      { key: "excellent_leadership", statement: "Provides excellent leadership." },
    ],
  },
  {
    key: "team",
    label: "Your Team",
    statements: [
      { key: "team_works_well", statement: "My team works well together." },
      { key: "good_team_spirit", statement: "We have a good team spirit." },
      { key: "team_respects", statement: "Everyone in the team respects and values my role within the business." },
      { key: "morale_high", statement: "Morale is high at the moment." },
    ],
  },
  {
    key: "organisation",
    label: "Organisation & Senior Management",
    statements: [
      { key: "innovative", statement: "Implement new and innovative ways of doing things." },
      { key: "committed_to_business", statement: "Are committed to developing the business." },
      { key: "invest_in_team", statement: "Invest in the team to ensure that we are as good as we can be." },
      { key: "understand_vision", statement: "I understand and support the company vision and direction of the business." },
      { key: "policies_clear", statement: "Company policies are available and give clear guidelines and direction." },
      { key: "seek_input", statement: "Actively seek input from all team members." },
      { key: "senior_support", statement: "I feel that senior managers support the work that I do here." },
      { key: "better_than_year_ago", statement: "This is a better place to work for now than a year ago (if you have worked here for a year or more)." },
      { key: "great_org", statement: "This is a great organisation to work for." },
      { key: "treat_fairly", statement: "I will always be treated fairly." },
      { key: "trust", statement: "Trust is part of the way we do things around here." },
      { key: "rewards_risk", statement: "The organisation rewards risk taking." },
      { key: "mistakes_tolerated", statement: "Mistakes are tolerated here." },
      { key: "serious_quality", statement: "The organisation is serious about quality." },
    ],
  },
  {
    key: "workArea",
    label: "Your Work Area",
    statements: [
      { key: "clean_appropriate", statement: "My work area is clean and appropriate." },
      { key: "plenty_space", statement: "I have plenty of work space." },
      { key: "equipment_provided", statement: "I am provided with all the equipment/resources I need to do my job." },
      { key: "security", statement: "Security is satisfactory." },
    ],
  },
] as const;

export const LIKERT_OPTIONS = [
  { value: 7, label: "Strongly Agree" },
  { value: 6, label: "Agree" },
  { value: 5, label: "Slightly Agree" },
  { value: 4, label: "Neutral" },
  { value: 3, label: "Slightly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 1, label: "Strongly Disagree" },
] as const;

export const RATING_SCALE = [
  { value: 5, label: "5 – Exceptional" },
  { value: 4, label: "4 – Above Average" },
  { value: 3, label: "3 – Average" },
  { value: 2, label: "2 – Below Average" },
  { value: 1, label: "1 – Unsatisfactory" },
] as const;

export const PREVIOUS_ACTIONS_QUESTIONS = [
  { key: "achieved_actions", question: "Have you achieved all of the actions that were set out in your previous appraisal?" },
  { key: "barriers", question: "What barriers prevented you achieving any of your goals? What could be done to overcome these?" },
  { key: "success_level", question: "How successful were you at meeting those objectives?" },
] as const;

export const TRAINING_REVIEW_QUESTIONS = [
  { key: "training_done", question: "What training have you done over the past 12 months and how effective do you feel this training was to your development?" },
  { key: "additional_skills", question: "What additional skills, training or experience would assist you to become more successful in your current role?" },
] as const;

export const APPRAISAL_TYPES = [
  { value: "educator_appraisal", label: "Educator Appraisal & Development Plan", frequency: "Every 6 months" },
] as const;

export type CompetencyKey = typeof COMPETENCIES[number]["key"];
export type PositionReviewKey = typeof POSITION_REVIEW[number]["key"];
export type PerformanceDevKey = typeof PERFORMANCE_DEV_QUESTIONS[number]["key"];

export interface CompetencyEntry {
  key: string;
  rating?: number;
  comment?: string;
  actionRequired?: boolean;
}

export interface PositionReviewEntry {
  key: string;
  rating?: number;
  comment?: string;
  actionRequired?: boolean;
}

export interface PerformanceDevEntry {
  key: string;
  comment?: string;
  feedback?: string;
  actionRequired?: boolean;
}

export interface Stage1Data {
  submittedAt?: string;
  competencies: CompetencyEntry[];
  positionReview: PositionReviewEntry[];
  performanceDev: PerformanceDevEntry[];
}

export interface LikertEntry {
  key: string;
  rating?: number;
}

export interface Stage2Data {
  submittedAt?: string;
  manager: LikertEntry[];
  team: LikertEntry[];
  organisation: LikertEntry[];
  workArea: LikertEntry[];
}

export interface ReviewQuestion {
  key: string;
  employeeComment?: string;
  reviewerFeedback?: string;
  actionRequired?: boolean;
}

export interface AppraisalGoal {
  id: string;
  source: "auto" | "manual";
  sourceLabel?: string;
  action: string;
  possibleObstacles?: string;
  isSmart?: boolean;
  dateForCompletion?: string;
}

export interface AdditionalNote {
  id: string;
  areaOfDiscussion: string;
  responsibility: string;
}

export interface Stage3Data {
  submittedAt?: string;
  previousActionsReview: ReviewQuestion[];
  trainingReview: ReviewQuestion[];
  goals: AppraisalGoal[];
  overview: { employeeComments?: string; reviewerComments?: string };
  additionalNotes: AdditionalNote[];
  signatures: {
    reviewerSigned?: boolean;
    reviewerSignedAt?: string;
    employeeSigned?: boolean;
    employeeSignedAt?: string;
  };
}

export function buildEmptyStage1(): Stage1Data {
  return {
    competencies: COMPETENCIES.map((c) => ({ key: c.key })),
    positionReview: POSITION_REVIEW.map((p) => ({ key: p.key })),
    performanceDev: PERFORMANCE_DEV_QUESTIONS.map((q) => ({ key: q.key })),
  };
}

export function buildEmptyStage2(): Stage2Data {
  return {
    manager: UPWARD_APPRAISAL_SECTIONS[0].statements.map((s) => ({ key: s.key })),
    team: UPWARD_APPRAISAL_SECTIONS[1].statements.map((s) => ({ key: s.key })),
    organisation: UPWARD_APPRAISAL_SECTIONS[2].statements.map((s) => ({ key: s.key })),
    workArea: UPWARD_APPRAISAL_SECTIONS[3].statements.map((s) => ({ key: s.key })),
  };
}

export function buildEmptyStage3(autoActions: AppraisalGoal[] = []): Stage3Data {
  return {
    previousActionsReview: PREVIOUS_ACTIONS_QUESTIONS.map((q) => ({ key: q.key })),
    trainingReview: TRAINING_REVIEW_QUESTIONS.map((q) => ({ key: q.key })),
    goals: autoActions,
    overview: {},
    additionalNotes: [],
    signatures: {},
  };
}

export function collectAutoActions(
  employeeStage1?: Stage1Data | null,
  reviewerStage1?: Stage1Data | null,
): AppraisalGoal[] {
  const actions: AppraisalGoal[] = [];

  const processEntries = (
    entries: (CompetencyEntry | PositionReviewEntry | PerformanceDevEntry)[],
    labelMap: Record<string, string>,
    prefix: string,
    who: "Employee" | "Reviewer",
  ) => {
    for (const e of entries) {
      if (e.actionRequired) {
        actions.push({
          id: crypto.randomUUID(),
          source: "auto",
          sourceLabel: `${labelMap[e.key] ?? e.key} (${prefix} — ${who})`,
          action: "",
          possibleObstacles: "",
          isSmart: undefined,
          dateForCompletion: "",
        });
      }
    }
  };

  const competencyLabels = Object.fromEntries(COMPETENCIES.map((c) => [c.key, c.label]));
  const positionLabels = Object.fromEntries(POSITION_REVIEW.map((p) => [p.key, p.label]));
  const pdLabels = Object.fromEntries(PERFORMANCE_DEV_QUESTIONS.map((q) => [q.key, q.question]));

  if (employeeStage1) {
    processEntries(employeeStage1.competencies, competencyLabels, "Competency", "Employee");
    processEntries(employeeStage1.positionReview, positionLabels, "Position Review", "Employee");
    processEntries(employeeStage1.performanceDev, pdLabels, "Performance Dev", "Employee");
  }
  if (reviewerStage1) {
    processEntries(reviewerStage1.competencies, competencyLabels, "Competency", "Reviewer");
    processEntries(reviewerStage1.positionReview, positionLabels, "Position Review", "Reviewer");
    processEntries(reviewerStage1.performanceDev, pdLabels, "Performance Dev", "Reviewer");
  }

  return actions;
}
